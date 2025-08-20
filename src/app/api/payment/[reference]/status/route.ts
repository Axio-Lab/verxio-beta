import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const { reference } = await params;
    const { status, signature, loyaltyDiscount, amount } = await request.json();

    if (!reference || !status) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status value' },
        { status: 400 }
      );
    }

    // Validate loyaltyDiscount if provided
    if (loyaltyDiscount !== undefined && (isNaN(parseFloat(loyaltyDiscount)) || parseFloat(loyaltyDiscount) < 0)) {
      return NextResponse.json(
        { error: 'Invalid loyalty discount amount' },
        { status: 400 }
      );
    }

    // Validate amount if provided
    if (amount !== undefined && (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: any = {
      status: status as any,
      updatedAt: new Date(),
    };

    // Add optional fields if provided
    if (signature) updateData.signature = signature;
    if (loyaltyDiscount !== undefined) updateData.loyaltyDiscount = loyaltyDiscount;
    if (amount !== undefined) updateData.amount = amount;

    // Update payment record status and additional fields
    const updatedPayment = await prisma.paymentRecord.update({
      where: { reference },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: `Payment status updated to ${status}`,
      payment: {
        reference: updatedPayment.reference,
        status: updatedPayment.status,
        amount: updatedPayment.amount,
        loyaltyDiscount: updatedPayment.loyaltyDiscount,
        updatedAt: updatedPayment.updatedAt,
      },
    });

  } catch (error: any) {
    console.error('Payment status update error:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Payment record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 