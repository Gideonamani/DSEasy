/**
 * Format a number with commas (e.g., 1,234.56)
 * @param {number} num 
 * @param {object} options Intl.NumberFormat options
 * @returns {string}
 */
export const formatNumber = (num, options = {}) => {
    if (num === null || num === undefined) return "-";
    return num.toLocaleString(undefined, options);
};

/**
 * Format large numbers with suffixes (K, M, B, T)
 * @param {number} num 
 * @returns {string}
 */
export const formatLargeNumber = (num) => {
    if (!num && num !== 0) return "-";
    if (Math.abs(num) >= 1e12) return (num / 1e12).toFixed(2) + "T";
    if (Math.abs(num) >= 1e9) return (num / 1e9).toFixed(2) + "B";
    if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(2) + "M";
    if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(2) + "K";
    return num.toLocaleString();
};
