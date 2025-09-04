import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { walletAddress, email, name } = body || {}

    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid walletAddress' }, { status: 400 })
    }

    const user = await prisma.user.upsert({
      where: { walletAddress },
      update: {
        email: email || undefined,
        name: name || undefined,
        updatedAt: new Date(),
      },
      create: {
        walletAddress,
        email: email || undefined,
        name: name || undefined,
      },
      select: {
        id: true,
        walletAddress: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ success: true, user })
  } catch (error) {
    console.error('API upsert user error:', error)
    return NextResponse.json({ success: false, error: 'Failed to upsert user' }, { status: 500 })
  }
}


