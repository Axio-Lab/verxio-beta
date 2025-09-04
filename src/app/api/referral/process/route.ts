import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const FIVE_MIN_MS = 5 * 60 * 1000

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { referredWalletAddress, referralCode } = body || {}

    if (!referredWalletAddress || typeof referredWalletAddress !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid referredWalletAddress' }, { status: 400 })
    }
    if (!referralCode || typeof referralCode !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid referralCode' }, { status: 400 })
    }

    // Get referred user
    const referredUser = await prisma.user.findUnique({
      where: { walletAddress: referredWalletAddress },
      select: { id: true, createdAt: true }
    })
    if (!referredUser) {
      return NextResponse.json({ success: false, error: 'Referred user not found' }, { status: 404 })
    }

    // New user check (<= 5 minutes old)
    const userAgeMs = Date.now() - new Date(referredUser.createdAt).getTime()
    if (userAgeMs > FIVE_MIN_MS) {
      return NextResponse.json({ success: false, error: 'Sign up bonus only available for new users' }, { status: 200 })
    }

    // Find referrer by referralCode
    const referrer = await prisma.user.findUnique({
      where: { referralCode },
      select: { id: true, walletAddress: true }
    })
    if (!referrer) {
      return NextResponse.json({ success: false, error: 'Invalid referral code' }, { status: 200 })
    }

    // Check for existing successful referral
    const existingSuccessful = await prisma.referral.findFirst({
      where: { referredUserId: referredUser.id, status: 'SUCCESS' }
    })
    if (existingSuccessful) {
      return NextResponse.json({ success: false, error: 'User already has a successful referral relationship' }, { status: 200 })
    }

    // Check for existing pending referral and update it
    const existingPending = await prisma.referral.findFirst({
      where: { referredUserId: referredUser.id, status: 'PENDING' }
    })
    if (existingPending) {
      const updated = await prisma.referral.update({
        where: { id: existingPending.id },
        data: { referrerId: referrer.id }
      })
      return NextResponse.json({ success: true, referral: updated, updatedPending: true })
    }

    // Create a new pending referral
    const referral = await prisma.referral.create({
      data: {
        referrerId: referrer.id,
        referredUserId: referredUser.id,
        status: 'PENDING'
      }
    })

    // Increment referrer's pending count
    await prisma.user.update({
      where: { id: referrer.id },
      data: { pendingReferralCount: { increment: 1 } }
    })

    return NextResponse.json({ success: true, referral })
  } catch (error) {
    console.error('API process referral error:', error)
    return NextResponse.json({ success: false, error: 'Failed to process referral' }, { status: 500 })
  }
}


