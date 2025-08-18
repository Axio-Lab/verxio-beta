import { NextRequest, NextResponse } from 'next/server';
import { Keypair } from '@solana/web3.js';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recipientAddress, amount, loyaltyDetails } = body;
    if (!recipientAddress || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const ref = new Keypair().publicKey.toBase58();

    // Store payment record in Prisma database
    const paymentRecord = await prisma.paymentRecord.create({
      data: {
        reference: ref,
        amount: amount,
        recipient: recipientAddress,
        splToken: 'USDC',
        status: 'PENDING',
        loyaltyProgramAddress: loyaltyDetails?.loyaltyProgramAddress || null,
        loyaltyProgramName: loyaltyDetails?.loyaltyProgramName || null,
        loyaltyDiscount: loyaltyDetails?.loyaltyDiscount || '0',
      },
    });

    return NextResponse.json({
      reference: ref,
      recipient: recipientAddress,
      amount,
      createdAt: paymentRecord.createdAt.toISOString(),
      status: 'PENDING',
      url: `/pay/${ref}`,
      loyaltyProgramAddress: paymentRecord.loyaltyProgramAddress,
      loyaltyProgramName: paymentRecord.loyaltyProgramName,
      loyaltyDiscount: paymentRecord.loyaltyDiscount,
    });

  } catch (error) {
    console.error('Payment creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reference = searchParams.get('reference');

    if (!reference) {
      return NextResponse.json({ error: 'Reference parameter is required' }, { status: 400 });
    }

    if (!/^[A-Za-z0-9]{32,44}$/.test(reference)) {
      return NextResponse.json({ error: 'Invalid reference format' }, { status: 400 });
    }

    // Retrieve payment record from Prisma database
    const paymentRecord = await prisma.paymentRecord.findUnique({
      where: { reference },
    });

    if (paymentRecord) {
      return NextResponse.json({
        reference: paymentRecord.reference,
        recipient: paymentRecord.recipient,
        amount: paymentRecord.amount,
        createdAt: paymentRecord.createdAt.toISOString(),
        status: paymentRecord.status,
        signature: paymentRecord.signature,
        loyaltyProgramAddress: paymentRecord.loyaltyProgramAddress,
        loyaltyProgramName: paymentRecord.loyaltyProgramName,
        loyaltyDiscount: paymentRecord.loyaltyDiscount,
      });
    }

    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  } catch (error) {
    console.error('Payment retrieval error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 