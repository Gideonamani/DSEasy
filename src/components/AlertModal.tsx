import React, { useState, useEffect, FormEvent } from "react";
import { Link } from "react-router-dom";
import { X, Bell, Loader2, CheckCircle } from "lucide-react";
import { functions } from "../firebase";
import { httpsCallable } from "firebase/functions";

export interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  currentPrice: number;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  onClose,
  symbol,
  currentPrice,
}) => {
  const [targetPrice, setTargetPrice] = useState<string | number>(
    currentPrice || 0,
  );
  const [condition, setCondition] = useState<"ABOVE" | "BELOW">("ABOVE");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [roundToFive, setRoundToFive] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTargetPrice(currentPrice || 0);
      setCondition("ABOVE");
      setStatus("idle");
    }
  }, [isOpen, currentPrice]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus("idle");

    try {
      // FCM tokens are now registered centrally in AuthContext on login,
      // so alerts no longer need to carry a token.
      const createAlert = httpsCallable(functions, "createAlert");
      const result = await createAlert({
        symbol,
        targetPrice: parseFloat(targetPrice as string),
        condition,
      });

      if (!(result.data as any).success)
        throw new Error((result.data as any).error || "Unknown error");

      setStatus("success");
      setTimeout(() => {
        onClose();
        setStatus("idle");
      }, 4000); // 4 seconds delay to allow reading summary/clicking link
    } catch (err: any) {
      console.error(err);
      alert("Error: " + err.message);
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  // Input formatting helpers
  const formatWithCommas = (val: string | number) => {
    const num = String(val).replace(/,/g, "");
    if (!num || isNaN(Number(num))) return num;
    return Number(num).toLocaleString();
  };

  const stripCommas = (val: string) => val.replace(/,/g, "");

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const stripped = stripCommas(e.target.value);
    if (stripped === "" || /^\d+$/.test(stripped)) {
      setTargetPrice(stripped);
    }
  };

  const toggleRoundToFive = (checked: boolean) => {
    setRoundToFive(checked);
    if (checked && targetPrice) {
      const num = Number(stripCommas(String(targetPrice)));
      if (!isNaN(num)) {
        setTargetPrice(Math.round(num / 5) * 5);
      }
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: "var(--z-modal)",
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: "400px",
          padding: "var(--space-6)",
          borderRadius: "var(--radius-xl)",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "none",
            border: "none",
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          <X size={20} />
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "var(--space-6)",
          }}
        >
          <div
            style={{
              padding: "10px",
              borderRadius: "12px",
              background: "var(--accent-primary)",
              display: "flex",
            }}
          >
            <Bell size={24} color="#fff" />
          </div>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: "var(--text-lg)",
                fontWeight: "var(--font-bold)",
              }}
            >
              Set Price Alert
            </h3>
            <p
              style={{
                margin: 0,
                color: "var(--text-secondary)",
                fontSize: "var(--text-sm)",
              }}
            >
              for {symbol}
            </p>
          </div>
        </div>

        {status === "success" ? (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <CheckCircle
              size={48}
              color="var(--accent-success)"
              style={{ marginBottom: "16px" }}
            />
            <p
              style={{
                fontSize: "var(--text-lg)",
                fontWeight: "var(--font-medium)",
                marginBottom: "8px",
              }}
            >
              Alert Set Successfully!
            </p>
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--text-secondary)",
                marginBottom: "24px",
              }}
            >
              We'll notify you when{" "}
              <strong style={{ color: "var(--text-primary)" }}>{symbol}</strong>{" "}
              goes{" "}
              <strong
                style={{
                  color:
                    condition === "ABOVE"
                      ? "var(--accent-success)"
                      : "var(--accent-danger)",
                }}
              >
                {condition.toLowerCase()}
              </strong>{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                {targetPrice}
              </strong>{" "}
              TZS.
            </p>
            <Link
              to="/notifications"
              onClick={onClose}
              style={{
                display: "inline-block",
                padding: "10px 20px",
                borderRadius: "var(--radius-lg)",
                background: "var(--bg-elevated)",
                color: "var(--accent-primary)",
                textDecoration: "none",
                fontWeight: "var(--font-medium)",
                fontSize: "var(--text-sm)",
                border: "1px solid var(--glass-border)",
                transition: "all 0.2s",
              }}
            >
              View in Notifications
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "var(--space-4)" }}>
              <label
                style={{
                  display: "block",
                  color: "var(--text-secondary)",
                  fontSize: "var(--text-xs)",
                  marginBottom: "8px",
                }}
              >
                Target Price (TZS)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formatWithCommas(targetPrice)}
                onChange={handlePriceChange}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--glass-border)",
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  fontSize: "var(--text-base)",
                  outline: "none",
                }}
              />
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  marginTop: "12px",
                  flexWrap: "wrap",
                }}
              >
                {[
                  { label: "-10%", value: 0.9 },
                  { label: "-5%", value: 0.95 },
                  { label: "+5%", value: 1.05 },
                  { label: "+10%", value: 1.1 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      if (currentPrice) {
                        const rawTarget = currentPrice * preset.value;
                        const finalTarget = roundToFive
                          ? Math.round(rawTarget / 5) * 5
                          : Math.round(rawTarget);

                        setTargetPrice(finalTarget);
                        setCondition(preset.value > 1 ? "ABOVE" : "BELOW");
                      }
                    }}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "12px",
                      border: "1px solid var(--glass-border)",
                      background: "var(--bg-elevated)",
                      color: "var(--text-secondary)",
                      fontSize: "var(--text-xs)",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = "var(--text-primary)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = "var(--text-secondary)")
                    }
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginTop: "12px",
                }}
              >
                <input
                  type="checkbox"
                  id="roundToFive"
                  checked={roundToFive}
                  onChange={(e) => toggleRoundToFive(e.target.checked)}
                  style={{
                    cursor: "pointer",
                    width: "16px",
                    height: "16px",
                    accentColor: "var(--accent-primary)",
                  }}
                />
                <label
                  htmlFor="roundToFive"
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  Round to nearest 5 TZS
                </label>
              </div>
            </div>

            <div style={{ marginBottom: "var(--space-6)" }}>
              <label
                style={{
                  display: "block",
                  color: "var(--text-secondary)",
                  fontSize: "var(--text-xs)",
                  marginBottom: "8px",
                }}
              >
                Condition
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setCondition("ABOVE")}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "var(--radius-lg)",
                    cursor: "pointer",
                    background:
                      condition === "ABOVE"
                        ? "rgba(34, 197, 94, 0.2)"
                        : "var(--bg-input)",
                    color:
                      condition === "ABOVE"
                        ? "var(--accent-success)"
                        : "var(--text-secondary)",
                    border:
                      condition === "ABOVE"
                        ? "1px solid var(--accent-success)"
                        : "1px solid transparent",
                    fontWeight: "var(--font-medium)",
                  }}
                >
                  Goes Above
                </button>
                <button
                  type="button"
                  onClick={() => setCondition("BELOW")}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "var(--radius-lg)",
                    cursor: "pointer",
                    background:
                      condition === "BELOW"
                        ? "rgba(239, 68, 68, 0.2)"
                        : "var(--bg-input)",
                    color:
                      condition === "BELOW"
                        ? "var(--accent-danger)"
                        : "var(--text-secondary)",
                    border:
                      condition === "BELOW"
                        ? "1px solid var(--accent-danger)"
                        : "1px solid transparent",
                    fontWeight: "var(--font-medium)",
                  }}
                >
                  Goes Below
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={
                loading || Number(stripCommas(String(targetPrice))) <= 0
              }
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "var(--radius-lg)",
                border: "none",
                background: "var(--accent-primary)",
                color: "white",
                fontWeight: "var(--font-bold)",
                cursor:
                  loading || Number(stripCommas(String(targetPrice))) <= 0
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  loading || Number(stripCommas(String(targetPrice))) <= 0
                    ? 0.5
                    : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "all 0.2s",
              }}
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? "Creating alert..." : "Create Alert"}
            </button>
            {loading ? (
              <p
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text-secondary)",
                  textAlign: "center",
                  marginTop: "12px",
                }}
              >
                This may take a few seconds while we secure your connection...
              </p>
            ) : (
              <p
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text-secondary)",
                  textAlign: "center",
                  marginTop: "12px",
                }}
              >
                Needs Notification Permission
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
