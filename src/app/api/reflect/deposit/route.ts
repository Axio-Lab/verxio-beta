import { NextResponse } from 'next/server'
import { depositToEarnPool } from '@/app/actions/reflect'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { voucherAddress, amountUsdc } = body || {}
    if (!voucherAddress || typeof amountUsdc !== 'number') {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 })
    }
    const result = await depositToEarnPool({ voucherAddress, amountUsdc })
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 })
  }
}


