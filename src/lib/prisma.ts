import { PrismaClient } from '@prisma/client'
import { fieldEncryptionExtension } from 'prisma-field-encryption'
// import { withOptimize } from "@prisma/extension-optimize";

const globalForPrisma = globalThis as unknown as {
  prisma: any | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient().$extends(
  fieldEncryptionExtension({
    encryptionKey: process.env.PRISMA_FIELD_ENCRYPTION_KEY!,
  })
)

// .$extends(withOptimize({ apiKey: process.env.OPTIMIZE_API_KEY! }))


if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma 
 globalForPrisma.prisma = prisma 

// export default prisma