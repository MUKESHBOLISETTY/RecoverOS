/**
 * @typedef {import('@prisma/client').PrismaClient} PrismaClient
 */

export class AuditService {
    /**
     * @param {PrismaClient} prisma
     */
    constructor(prisma) {
        this.prisma = prisma;
    }

    /**
     * Get paginated audit events for a specific merchant.
     * @param {string} userId
     * @param {Object} options
     * @param {number} [options.page=1]
     * @param {number} [options.pageSize=20]
     * @param {string} [options.eventType]
     * @param {string} [options.search]
     * @returns {Promise<Object>}
     */
    async getAuditEvents(userId, options = {}) {
        if (!userId) {
            throw new Error('AuditService: userId is required');
        }

        const { page = 1, pageSize = 20, eventType, search } = options;
        const skip = (page - 1) * pageSize;

        const whereClause = {
            actor: userId
        };

        if (eventType && eventType !== 'ALL') {
            whereClause.action = eventType;
        }

        if (search) {
            whereClause.entityId = {
                contains: search,
                mode: 'insensitive'
            };
        }

        const [events, total] = await Promise.all([
            this.prisma.auditEvent.findMany({
                where: whereClause,
                orderBy: { createdAt: 'desc' },
                skip,
                take: Number(pageSize)
            }),
            this.prisma.auditEvent.count({
                where: whereClause
            })
        ]);

        return {
            events,
            pagination: {
                total,
                page: Number(page),
                pageSize: Number(pageSize),
                totalPages: Math.ceil(total / pageSize)
            }
        };
    }
}

export default AuditService;
