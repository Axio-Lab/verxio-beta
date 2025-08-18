import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reference } = body;

    if (!reference) {
      return NextResponse.json({ 
        error: 'Missing required field: reference' 
      }, { status: 400 });
    }

    // Get payment record from database
    const paymentRecord = await prisma.paymentRecord.findUnique({
      where: { reference },
      select: {
        id: true,
        reference: true,
        amount: true,
        recipient: true,
        status: true,
        signature: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!paymentRecord) {
      return NextResponse.json({
        success: false,
        verified: false,
        error: 'Payment record not found'
      }, { status: 404 });
    }

    // Check if payment is successful
    if (paymentRecord.status === 'SUCCESS') {
      return NextResponse.json({
        success: true,
        verified: true,
        reference: paymentRecord.reference,
        amount: paymentRecord.amount,
        status: paymentRecord.status,
        signature: paymentRecord.signature,
        recipient: paymentRecord.recipient,
        createdAt: paymentRecord.createdAt,
        updatedAt: paymentRecord.updatedAt
      });
    } else {
      return NextResponse.json({
        success: false,
        verified: false,
        reference: paymentRecord.reference,
        status: paymentRecord.status,
        message: `Payment is in ${paymentRecord.status.toLowerCase()} status`
      });
    }

  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reference = searchParams.get('reference');

    if (!reference) {
      return NextResponse.json({ 
        error: 'Reference parameter is required' 
      }, { status: 400 });
    }

    // Get payment record from database
    const paymentRecord = await prisma.paymentRecord.findUnique({
      where: { reference },
      select: {
        id: true,
        reference: true,
        amount: true,
        recipient: true,
        status: true,
        signature: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!paymentRecord) {
      return NextResponse.json({
        success: false,
        verified: false,
        error: 'Payment record not found'
      }, { status: 404 });
    }

    // Check if payment is successful
    if (paymentRecord.status === 'SUCCESS') {
      return NextResponse.json({
        success: true,
        verified: true,
        reference: paymentRecord.reference,
        amount: paymentRecord.amount,
        status: paymentRecord.status,
        signature: paymentRecord.signature,
        recipient: paymentRecord.recipient,
        createdAt: paymentRecord.createdAt,
        updatedAt: paymentRecord.updatedAt
      });
    } else {
      return NextResponse.json({
        success: false,
        verified: false,
        reference: paymentRecord.reference,
        status: paymentRecord.status,
        message: `Payment is in ${paymentRecord.status.toLowerCase()} status`
      });
    }

  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 