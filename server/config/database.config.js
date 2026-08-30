import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function withTransaction(callback) {
  try {
    return await prisma.$transaction(async (tx) => {
      return await callback(tx);
    }, {
      maxWait: 7000,
      timeout: 10000,
    });
  } catch (error) {
    console.error('Transaction failed:', error);
    throw error;
  }
}

export async function connectDB() {
  try {
    await prisma.$connect();
    console.log('Successfully connected to the PostgreSQL database.');
  } catch (error) {
    console.error('Failed to connect to the database:', error);
    process.exit(1);
  }
}

export async function disconnectDB() {
  try {
    await prisma.$disconnect();
    await pool.end();
    console.log('Disconnected from the PostgreSQL database.');
  } catch (error) {
    console.error('Error disconnecting from the database:', error);
  }
}

export default prisma;
