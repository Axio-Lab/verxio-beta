import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const { reference } = await params;
    const { status, signature } = await request.json();

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

    // Update payment record status
    const updatedPayment = await prisma.paymentRecord.update({
      where: { reference },
      data: {
        status: status as any,
        ...(signature && { signature, updatedAt: new Date() }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Payment status updated to ${status}`,
      payment: {
        reference: updatedPayment.reference,
        status: updatedPayment.status,
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