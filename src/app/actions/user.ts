'use server'

import { prisma } from '@/lib/prisma'

export interface CreateUserData {
  walletAddress: string
  email?: string
  name?: string
}

export interface UpdateUserData {
  email?: string
  name?: string
  bio?: string
  avatar?: string
}

export const createOrUpdateUser = async (data: CreateUserData) => {
  try {
    const user = await prisma.user.upsert({
      where: {
        walletAddress: data.walletAddress
      },
      update: {
        email: data.email,
        name: data.name,
        updatedAt: new Date()
      },
      create: {
        walletAddress: data.walletAddress,
        email: data.email,
        name: data.name
      }
    })
    return { success: true, user }
  } catch (error) {
    console.error('Error creating/updating user:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    return { success: false, error: 'Failed to create/update user' }
  }
}

export const updateUserProfile = async (walletAddress: string, data: UpdateUserData) => {
  try {
    const user = await prisma.user.update({
      where: {
        walletAddress: walletAddress
      },
      data: {
        ...data,
        updatedAt: new Date()
      }
    })

    return { success: true, user }
  } catch (error) {
    console.error('Error updating user profile:', error)
    return { success: false, error: 'Failed to update user profile' }
  }
}

export const getUserByWallet = async (walletAddress: string) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        walletAddress: walletAddress
      }
    })

    return { success: true, user }
  } catch (error) {
    console.error('Error fetching user:', error)
    return { success: false, error: 'Failed to fetch user' }
  }
}

export const getAllUsers = async () => {
  try {
    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    })

    return { success: true, users }
  } catch (error) {
    console.error('Error fetching all users:', error)
    return { success: false, error: 'Failed to fetch users' }
  }
}
