import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    // 仅在开发环境输出警告，生产环境不应暴露配置信息
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[DB] WARNING: DATABASE_URL is not set! Prisma will not be able to connect.')
      console.warn('[DB] In standalone mode, ensure .env file is in the working directory or set env vars via PM2.')
    }
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query'],
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
