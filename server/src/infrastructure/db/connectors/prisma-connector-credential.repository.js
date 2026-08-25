import ConnectorCredentialRepository from '../../../domain/connectors/connector-credential.repository.js';

class PrismaConnectorCredentialRepository extends ConnectorCredentialRepository {
  /**
   * @param {import('@prisma/client').PrismaClient} prisma 
   */
  constructor(prisma) {
    super();
    this.prisma = prisma;
  }

  async findByUserAndConnector(userId, connectorId) {
    return this.prisma.connectorCredential.findFirst({
      where: { userId, connectorId }
    });
  }

  async findById(id) {
    return this.prisma.connectorCredential.findUnique({
      where: { id }
    });
  }

  async findFirstByConnectorId(connectorId) {
    return this.prisma.connectorCredential.findFirst({
      where: { connectorId }
    });
  }

  async findIdsByConnectorId(connectorId) {
    return this.prisma.connectorCredential.findMany({
      where: { connectorId },
      select: {
        id: true,
        userId: true,
        connectorId: true
      }
    });
  }

  async create(data) {
    return this.prisma.connectorCredential.create({
      data: {
        userId: data.userId,
        connectorId: data.connectorId,
        category: data.category,
        name: data.name,
        encryptedData: data.encryptedData,
        iv: data.iv,
        authTag: data.authTag
      }
    });
  }

  async listByUser(userId) {
    return this.prisma.connectorCredential.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async delete(id, userId) {
    return this.prisma.connectorCredential.deleteMany({
      where: { id, userId }
    });
  }
}

export default PrismaConnectorCredentialRepository;
