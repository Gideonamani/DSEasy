import * as admin from "firebase-admin";
import { db } from "../config/firebase";
import type { CorporateAction } from "../types";
import { getDateInTimeZone } from "../utils/corporateActions";

const EAT_TIME_ZONE = "Africa/Dar_es_Salaam";
const PAUSED_STATUS = "PAUSED_CORPORATE_ACTION";

export function isCorporateAction(value: unknown): value is CorporateAction {
  if (!value || typeof value !== "object") return false;
  const action = value as Partial<CorporateAction>;
  return action.actionType === "share_split" &&
    typeof action.id === "string" &&
    typeof action.ticker === "string" &&
    typeof action.ratioNew === "number" &&
    typeof action.ratioOld === "number" &&
    typeof action.effectiveDate === "string";
}

export async function fetchCorporateActions(): Promise<CorporateAction[]> {
  const config = await db.collection("config").doc("app").get();
  const values: unknown[] = config.data()?.corporateActions ?? [];
  return values.filter(isCorporateAction);
}

/**
 * Pauses economically stale alerts during a ticker suspension, then adjusts
 * and resumes them on the effective date. The applied action IDs make this
 * safe to run on every intraday-monitor invocation.
 */
export async function reconcileCorporateActionAlerts(
  currentDate: string,
  actions?: CorporateAction[],
): Promise<void> {
  const configuredActions = actions ?? await fetchCorporateActions();
  const activeActions = configuredActions.filter(
    (action) => action.status === "approved",
  );

  for (const action of activeActions) {
    const inSuspension = !!action.suspensionStart &&
      !!action.suspensionEnd &&
      currentDate >= action.suspensionStart &&
      currentDate <= action.suspensionEnd;
    const isEffective = currentDate >= action.effectiveDate;
    if (!inSuspension && !isEffective) continue;

    const alerts = await db
      .collection("alerts")
      .where("symbol", "==", action.ticker)
      .get();
    if (alerts.empty) continue;

    const batch = db.batch();
    let updateCount = 0;
    for (const alertDoc of alerts.docs) {
      const alert = alertDoc.data();
      const createdAt = alert.createdAt?.toDate?.();
      const createdDate = createdAt instanceof Date
        ? getDateInTimeZone(createdAt, EAT_TIME_ZONE)
        : null;
      const adjustmentIds: string[] = Array.isArray(alert.corporateActionAdjustmentIds)
        ? alert.corporateActionAdjustmentIds
        : [];

      if (inSuspension && alert.status === "ACTIVE") {
        batch.update(alertDoc.ref, {
          status: PAUSED_STATUS,
          pausedForCorporateAction: action.id,
          corporateActionUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        updateCount++;
        continue;
      }

      if (!isEffective || !["ACTIVE", PAUSED_STATUS].includes(alert.status)) {
        continue;
      }

      // Alerts created on or after the effective date already use the new
      // price scale, so only adjust when we can trust the target's scale.
      // Resuming from pause is independent of this: an alert must never stay
      // stuck at PAUSED_STATUS just because we can't confidently rescale it.
      const canAdjustTarget = createdDate !== null &&
        createdDate < action.effectiveDate &&
        typeof alert.targetPrice === "number" &&
        alert.targetPrice > 0;
      const alreadyAdjusted = adjustmentIds.includes(action.id);
      const update: { [key: string]: unknown } = {};
      if (canAdjustTarget && !alreadyAdjusted) {
        const adjustedTarget = alert.targetPrice *
          (action.ratioOld / action.ratioNew);
        update.targetPrice = adjustedTarget;
        update.corporateActionAdjustmentIds =
          admin.firestore.FieldValue.arrayUnion(action.id);
        update.corporateActionAdjustmentHistory =
          admin.firestore.FieldValue.arrayUnion({
            actionId: action.id,
            originalTargetPrice: alert.targetPrice,
            adjustedTargetPrice: adjustedTarget,
            adjustedOn: currentDate,
          });
      }
      if (alert.status === PAUSED_STATUS) {
        update.status = "ACTIVE";
        update.pausedForCorporateAction = admin.firestore.FieldValue.delete();
      }
      if (Object.keys(update).length > 0) {
        update.corporateActionUpdatedAt =
          admin.firestore.FieldValue.serverTimestamp();
        batch.update(alertDoc.ref, update);
        updateCount++;
      }
    }

    if (updateCount > 0) {
      await batch.commit();
      console.log(
        `Reconciled ${updateCount} ${action.ticker} alert(s) for ${action.id}.`,
      );
    }
  }
}
