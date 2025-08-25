import { PrismaClient } from '@prisma/client'
import { fieldEncryptionExtension } from 'prisma-field-encryption'
import { withOptimize } from "@prisma/extension-optimize";

const prisma = new PrismaClient()

// Add encryption extension
prisma.$extends(
  fieldEncryptionExtension({
    encryptionKey: process.env.PRISMA_FIELD_ENCRYPTION_KEY,
  })
)

// Add optimize extension
prisma.$extends(withOptimize({ apiKey: process.env.OPTIMIZE_API_KEY! }))

export default prisma