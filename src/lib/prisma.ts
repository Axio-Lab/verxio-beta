import { PrismaClient } from '@prisma/client'
import { fieldEncryptionExtension } from 'prisma-field-encryption'
// import { withOptimize } from "@prisma/extension-optimize";

const globalForPrisma = globalThis as unknown as {
  prisma: any | undefined
}

// Prefer DIRECT_DATABASE_URL at runtime to bypass Accelerate for application queries
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasourceUrl: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
}).$extends(
  fieldEncryptionExtension({
    encryptionKey: process.env.PRISMA_FIELD_ENCRYPTION_KEY!,
  })
)

// .$extends(withOptimize({ apiKey: process.env.OPTIMIZE_API_KEY! }))


if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma 

// export default prisma