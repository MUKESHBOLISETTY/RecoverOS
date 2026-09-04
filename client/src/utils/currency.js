/**
 * Formats a monetary value (stored in minor units) into INR currency.
 * 
 * @param {string|number|BigInt|null|undefined} amountString - The amount in minor units (e.g. paisa for INR)
 */
export const formatMoney = (amountString) => {
    if (amountString === null || amountString === undefined || amountString === '') return '—';
    
    let minorUnits;
    if (typeof amountString === 'string') {
        minorUnits = parseInt(amountString, 10);
    } else if (typeof amountString === 'number') {
        minorUnits = amountString;
    } else if (typeof amountString === 'bigint') {
        minorUnits = Number(amountString);
    } else {
        minorUnits = 0;
    }

    if (isNaN(minorUnits)) {
        return '—';
    }

    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(minorUnits / 100);
};

/**
 * Formats a percentage value.
 * 
 * @param {number} rate - The percentage rate
 * @returns {string} The formatted percentage string
 */
export const formatPercent = (rate) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'percent',
        maximumFractionDigits: 1
    }).format(rate);
};
