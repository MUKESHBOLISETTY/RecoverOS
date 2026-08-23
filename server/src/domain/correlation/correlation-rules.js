export class CorrelationRules {
    static EVALUATION_WEIGHTS = {
        TIME_OVERLAP: 0.30,
        METHOD_MATCH: 0.20,
        BANK_MATCH: 0.30,
        ISSUER_MATCH: 0.30,
        NETWORK_MATCH: 0.30,
        PSP_MATCH: 0.30,
        VPA_MATCH: 0.30,
        ERROR_SOURCE_BANK: 0.10,
        SEVERITY_HIGH: 0.05
    };

    /**
     * @param {Object} payment - payment object
     * @param {Object} downtime - payment downtime object
     * @returns {Object} { score, matchedSignals }
     */
    static evaluate(payment, downtime) {
        const matchedSignals = [];
        let score = 0;

        if (this._isTimeOverlap(payment, downtime)) {
            matchedSignals.push('TIME_OVERLAP');
            score += this.EVALUATION_WEIGHTS.TIME_OVERLAP;
        }

        if (payment.method === downtime.method) {
            matchedSignals.push('METHOD_MATCH');
            score += this.EVALUATION_WEIGHTS.METHOD_MATCH;
        }

        const instrumentSignals = this._evaluateInstrument(payment, downtime);
        if (instrumentSignals.length > 0) {
            matchedSignals.push(...instrumentSignals);
            instrumentSignals.forEach(signal => {
                score += this.EVALUATION_WEIGHTS[signal] || 0;
            });
        }

        if (payment.errorSource === 'bank' || payment.errorSource === 'issuer') {
            matchedSignals.push('ERROR_SOURCE_BANK');
            score += this.EVALUATION_WEIGHTS.ERROR_SOURCE_BANK;
        }

        if (downtime.severity && downtime.severity.toLowerCase() === 'high') {
            matchedSignals.push('SEVERITY_HIGH');
            score += this.EVALUATION_WEIGHTS.SEVERITY_HIGH;
        }

        if (matchedSignals.length >= 3) {
            matchedSignals.push('MULTI_SIGNAL');
        }

        return {
            score: Math.min(score, 1.0),
            matchedSignals
        };
    }

    static getConfidence(score) {
        if (score >= 0.70) return 'HIGH';
        if (score >= 0.40) return 'MEDIUM';
        return 'LOW';
    }

    static _isTimeOverlap(payment, downtime) {
        const paymentTime = new Date(payment.paymentCreatedAt).getTime();
        const downtimeBegin = new Date(downtime.begin).getTime();
        const downtimeEnd = downtime.end ? new Date(downtime.end).getTime() : Date.now();

        console.log(`[DEBUG] _isTimeOverlap: paymentTime=${paymentTime} (${new Date(paymentTime)}), begin=${downtimeBegin} (${new Date(downtimeBegin)}), end=${downtimeEnd} (${new Date(downtimeEnd)})`);

        return paymentTime >= downtimeBegin && paymentTime <= downtimeEnd;
    }

    static _evaluateInstrument(payment, downtime) {
        const signals = [];
        const instrument = downtime.instrument || {};

        if (instrument.bank && payment.bank === instrument.bank) {
            signals.push('BANK_MATCH');
        }

        if (instrument.issuer && payment.bank === instrument.issuer) {
            signals.push('ISSUER_MATCH');
        }

        if (instrument.network && payment.acquirerData?.network === instrument.network) {
            signals.push('NETWORK_MATCH');
        }

        if (instrument.psp && payment.vpa?.includes(instrument.psp)) {
            signals.push('PSP_MATCH');
        }

        if (instrument.vpa && payment.vpa === instrument.vpa) {
            signals.push('VPA_MATCH');
        }

        return signals;
    }
}
