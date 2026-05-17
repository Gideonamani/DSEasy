/**
 * Parse a market-cap value into a number. The backend now stores market
 * caps as uniformly scaled full numbers, but historical documents may
 * still arrive as comma-formatted strings. Returns `0` for missing or
 * unparseable input so downstream sums and sorts stay numeric.
 */
export const normalizeMcap = (mcap: unknown): number => {
  if (mcap === undefined || mcap === null) return 0;

  const parsed =
    typeof mcap === "string"
      ? parseFloat(mcap.replace(/,/g, ""))
      : Number(mcap);

  return isNaN(parsed) ? 0 : parsed;
};
