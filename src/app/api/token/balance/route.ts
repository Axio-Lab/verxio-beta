import { NextRequest, NextResponse } from 'next/server'
import { Connection, PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddress, getAccount, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token'
import { getVerxioConfig } from '@/app/actions/loyalty'

export async function POST(req: NextRequest) {
  try {
    const { owner, mint } = await req.json()
    if (!owner || !mint) {
      return NextResponse.json({ success: false, error: 'Missing owner or mint' }, { status: 400 })
    }

    const config = await getVerxioConfig()
    if (!config.rpcEndpoint) {
      return NextResponse.json({ success: false, error: 'RPC endpoint not configured' }, { status: 500 })
    }

    const connection = new Connection(config.rpcEndpoint, 'confirmed')
    const ownerPk = new PublicKey(owner)
    const mintPk = new PublicKey(mint)
    // Try Token-2022 first, then legacy Token program
    let balance = 0
    const tryPrograms = [TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID]

    for (const programId of tryPrograms) {
      try {
        const ata = await getAssociatedTokenAddress(mintPk, ownerPk, true, programId)
        const account = await getAccount(connection, ata, 'confirmed', programId)
        balance = Number(account.amount) / 1_000_000
        return NextResponse.json({ success: true, balance })
      } catch (e) {
        // continue to next program variant
      }
    }

    // No account found on either program; return zero gracefully
    return NextResponse.json({ success: true, balance: 0 })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed to fetch token balance' }, { status: 500 })
  }
}


