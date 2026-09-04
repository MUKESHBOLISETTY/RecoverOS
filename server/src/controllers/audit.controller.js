export class AuditController {
    /**
     * @param {import('../domain/audit/audit.service.js').AuditService} auditService
     */
    constructor(auditService) {
        this.auditService = auditService;
        this.getAuditEvents = this.getAuditEvents.bind(this);
    }

    async getAuditEvents(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const { page, pageSize, eventType, search } = req.query;

            const result = await this.auditService.getAuditEvents(userId, {
                page: page ? parseInt(page, 10) : 1,
                pageSize: pageSize ? parseInt(pageSize, 10) : 20,
                eventType,
                search
            });

            res.status(200).json(result);
        } catch (error) {
            console.error('[AuditController] Error fetching audit events:', error);
            res.status(500).json({ error: 'Unable to load audit activity.' });
        }
    }
}
