export class ShopifyHeuristicCorrelationService {
    /**
     * Evaluates heuristic signals to find an existing active CART_ABANDONMENT case.
     * @param {Object} payment The payment object (from webhook or DB).
     * @param {Object} rawBody The raw webhook body.
     * @param {string} connectionId The connection ID (tenant).
     * @param {Array<Object>} activeCases Candidate recovery cases.
     * @returns {Object} Result { matched, caseId, confidence, score, reasons }
     */
    static evaluate(payment, rawBody, connectionId, activeCases) {
        if (process.env.SHOPIFY_HEURISTIC_CORRELATION_ENABLED !== 'true') {
            return { matched: false, confidence: 'UNKNOWN', reason: 'heuristic_correlation_disabled' };
        }

        if (!activeCases || activeCases.length === 0) {
            return { matched: false, confidence: 'UNKNOWN', reason: 'no_active_cases' };
        }

        const paymentEmail = (payment.contactEmail || rawBody?.payload?.payment?.entity?.email || '').toLowerCase();
        const paymentPhone = payment.contactPhone || rawBody?.payload?.payment?.entity?.contact || '';
        const paymentAmount = payment.amount || (rawBody?.payload?.payment?.entity?.amount / 100);
        
        // Base timestamp of payment or current time
        const paymentTime = payment.createdAt ? new Date(payment.createdAt).getTime() : Date.now();
        const WINDOW_MS = 15 * 60 * 1000; // 15 mins

        const scoredCandidates = activeCases.map(candidate => {
            let score = 30; // base score for same connection/store (we assume the caller already filtered by this)
            const reasons = ['same_connection'];

            const customer = candidate.contextSnapshot?.customer || {};
            const checkoutData = candidate.contextSnapshot?.checkoutData || {};
            
            const normalizeEmail = (str) => typeof str === 'string' && str.trim() !== '' ? str.trim().toLowerCase() : null;
            const normalizePhone = (str) => typeof str === 'string' && str.trim() !== '' ? str.replace(/[^\d+]/g, '') : null;

            const caseEmail = normalizeEmail(customer.email || checkoutData.email);
            const casePhone = normalizePhone(customer.phone || checkoutData.phone);
            
            const caseAmount = parseFloat(candidate.contextSnapshot?.cartValue || candidate.contextSnapshot?.totalPrice || checkoutData.total_price || 0);
            
            const caseTime = new Date(candidate.createdAt).getTime();

            const pEmail = normalizeEmail(paymentEmail);
            if (pEmail && caseEmail && pEmail === caseEmail) {
                score += 25;
                reasons.push('customer_email_match');
            }

            const pPhone = normalizePhone(paymentPhone);
            if (pPhone && casePhone && pPhone === casePhone) {
                score += 20;
                reasons.push('customer_contact_match');
            }

            if (paymentAmount && caseAmount) {
                const diff = Math.abs(paymentAmount - caseAmount);
                // 2% tolerance
                if (diff <= (caseAmount * 0.02)) {
                    score += 15;
                    reasons.push('amount_match');
                }
            }

            // Check if checkout activity is recent relative to the payment time
            if (paymentTime - caseTime >= 0 && paymentTime - caseTime <= WINDOW_MS) {
                score += 10;
                reasons.push('recent_checkout_activity');
            }

            return {
                caseId: candidate.id,
                score,
                reasons,
                createdAt: caseTime
            };
        });

        // Sort by score descending
        scoredCandidates.sort((a, b) => b.score - a.score);

        const topCandidate = scoredCandidates[0];
        const secondCandidate = scoredCandidates.length > 1 ? scoredCandidates[1] : null;

        if (topCandidate.score < 70) {
            return { matched: false, confidence: 'UNKNOWN', reason: 'score_below_threshold', score: topCandidate.score };
        }

        if (secondCandidate && (topCandidate.score - secondCandidate.score < 15)) {
            return { matched: false, confidence: 'UNKNOWN', reason: 'multiple_heuristic_candidates', score: topCandidate.score };
        }

        return {
            matched: true,
            caseId: topCandidate.caseId,
            confidence: 'HEURISTIC',
            score: topCandidate.score,
            reasons: topCandidate.reasons
        };
    }
}
