export class MoneyFormatter {
    /**
     * @param {number} amountInMinorUnits 
     * @param {string} currencyCode ('INR', 'USD')
     * @returns {string}
     */
    static format(amountInMinorUnits, currencyCode) {
        if (typeof amountInMinorUnits !== 'number' || isNaN(amountInMinorUnits)) {
            return '';
        }

        const currency = (currencyCode || 'INR').toUpperCase();
        let decimalPlaces = 2;
        if (['JPY', 'KRW', 'VND'].includes(currency)) decimalPlaces = 0;
        if (['BHD', 'KWD', 'OMR', 'JOD'].includes(currency)) decimalPlaces = 3;

        const amount = amountInMinorUnits / Math.pow(10, decimalPlaces);

        try {
            return new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: currency,
                minimumFractionDigits: decimalPlaces,
                maximumFractionDigits: decimalPlaces
            }).format(amount);
        } catch (error) {
            return `${currency} ${amount.toFixed(decimalPlaces)}`;
        }
    }
}
