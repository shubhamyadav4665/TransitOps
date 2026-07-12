/**
 * Shared currency formatter — all monetary values in the app use this.
 * Default: INR (₹). Change CURRENCY_SYMBOL + locale here to affect everywhere.
 */
export const CURRENCY_SYMBOL = '₹';
export const CURRENCY_LOCALE = 'en-IN';

/**
 * formatCurrency(1234.5)  → "₹1,234.50"
 * formatCurrency(0)       → "₹0.00"
 */
export const formatCurrency = (value, decimals = 2) => {
  const n = parseFloat(value) || 0;
  return `${CURRENCY_SYMBOL}${n.toLocaleString(CURRENCY_LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
};

/**
 * formatCurrencyCompact(12500)  → "₹12.5K"
 */
export const formatCurrencyCompact = (value) => {
  const n = parseFloat(value) || 0;
  if (n >= 1_00_000) return `${CURRENCY_SYMBOL}${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000)    return `${CURRENCY_SYMBOL}${(n / 1_000).toFixed(1)}K`;
  return formatCurrency(n);
};
