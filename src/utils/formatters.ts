/**
 * Format a number with commas (e.g., 1,234.56)
 * @param {number | null | undefined} num 
 * @param {Intl.NumberFormatOptions} options Intl.NumberFormat options
 * @returns {string}
 */
export const formatNumber = (num?: number | null, options: Intl.NumberFormatOptions = {}): string => {
    if (num === null || num === undefined) return "-";
    return num.toLocaleString(undefined, options);
};

/**
 * Format large numbers with suffixes (K, M, B, T)
 * @param {number | null | undefined} num 
 * @param {boolean} spellOut Whether to spell out the suffix (e.g., Billion instead of B)
 * @returns {string}
 */
export const formatLargeNumber = (num?: number | null, spellOut: boolean = false): string => {
    if (num === null || num === undefined) return "-";
    
    // In JavaScript, 0 is falsy, but we still want to format it as "0"
    const absNum = Math.abs(num);
    
    if (absNum >= 1e12) return (num / 1e12).toFixed(2) + (spellOut ? " Trillion" : "T");
    if (absNum >= 1e9) return (num / 1e9).toFixed(2) + (spellOut ? " Billion" : "B");
    if (absNum >= 1e6) return (num / 1e6).toFixed(2) + (spellOut ? " Million" : "M");
    if (absNum >= 1e3) return (num / 1e3).toFixed(2) + (spellOut ? " Thousand" : "K");
    return num.toLocaleString();
};
