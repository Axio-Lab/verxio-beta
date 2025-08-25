'use server'

import { prisma } from '@/lib/prisma'

export interface CreateLoyaltyPassData {
  programAddress: string
  recipient: string
  passPublicKey: string
  passPrivateKey: string
  signature: string
}

export const saveLoyaltyPass = async (data: CreateLoyaltyPassData) => {
  try {
    const loyaltyPass = await prisma.loyaltyPass.create({
      data: {
        programAddress: data.programAddress,
        recipient: data.recipient,
        passPublicKey: data.passPublicKey,
        passPrivateKey: data.passPrivateKey,
        signature: data.signature,
      }
    })

    return { success: true, data: loyaltyPass }
  } catch (error) {
    console.error('Error saving loyalty pass:', error)
    return { success: false, error: 'Failed to save loyalty pass' }
  }
}

export const getLoyaltyPassesByProgram = async (programAddress: string) => {
  try {
    const passes = await prisma.loyaltyPass.findMany({
      where: {
        programAddress: programAddress
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return { success: true, passes }
  } catch (error) {
    console.error('Error fetching loyalty passes:', error)
    return { success: false, error: 'Failed to fetch loyalty passes' }
  }
}

export const getLoyaltyPassByRecipient = async (recipient: string, programAddress: string) => {
  try {
    const pass = await prisma.loyaltyPass.findFirst({
      where: {
        recipient: recipient,
        programAddress: programAddress
      }
    })

    return { success: true, pass }
  } catch (error) {
    console.error('Error fetching loyalty pass:', error)
    return { success: false, error: 'Failed to fetch loyalty pass' }
  }
}
