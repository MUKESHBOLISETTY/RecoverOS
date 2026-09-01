export class MoneyParser {
    /**
     * @param {string|number} amountStr 
     * @returns {bigint}
     */
    static parseDecimalToMinorUnits(amountStr) {
        if (amountStr === null || amountStr === undefined) return 0n;

        const str = String(amountStr).trim();
        if (str === "") return 0n;

        let isNegative = false;
        let numStr = str;
        if (numStr.startsWith('-')) {
            isNegative = true;
            numStr = numStr.substring(1);
        }

        const parts = numStr.split('.');
        let major = parts[0] || '0';
        let minor = parts[1] || '';

        if (minor.length === 0) {
            minor = '00';
        } else if (minor.length === 1) {
            minor = minor + '0';
        } else if (minor.length > 2) {
            minor = minor.substring(0, 2);
        }

        const combined = major + minor;
        const result = BigInt(combined);

        return isNegative ? -result : result;
    }
}
