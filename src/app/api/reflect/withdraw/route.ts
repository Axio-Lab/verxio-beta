import { NextResponse } from 'next/server'
import { withdrawFromEarnPool } from '@/app/actions/reflect'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { voucherAddress, amountUsdcPlus } = body || {}
    if (!voucherAddress || typeof amountUsdcPlus !== 'number') {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 })
    }
    const result = await withdrawFromEarnPool({ voucherAddress, amountUsdcPlus })
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 })
  }
}


