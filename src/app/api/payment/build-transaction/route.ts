import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  Transaction
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getMint,
} from "@solana/spl-token";
import { USDC_MINT } from "@/lib/utils";

// Treasury wallet address (you can set this in environment variables)
const TREASURY_WALLET = process.env.TREASURY_WALLET!;
const TREASURY_FEE_PERCENTAGE = 0.005; // 0.5%

export async function POST(request: NextRequest) {
  try {
    const { reference, amount, recipient, userWallet } = await request.json();

    if (!reference || !amount || !recipient || !userWallet) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const RPC_ENDPOINT = `${process.env.RPC_URL}?api-key=${process.env.HELIUS_API_KEY}`;
    const connection = new Connection(RPC_ENDPOINT, 'confirmed');
    const tokenMint = new PublicKey(USDC_MINT);

    const paymentAmount = parseFloat(amount);
    const treasuryFee = paymentAmount * TREASURY_FEE_PERCENTAGE;

    const mintInfo = await getMint(connection, tokenMint);
    const decimals = mintInfo.decimals;

    // Calculate amounts in smallest units
    const paymentAmountSmallest = Math.round(paymentAmount * Math.pow(10, decimals));
    const treasuryFeeSmallest = Math.round(treasuryFee * Math.pow(10, decimals));

    // Create transaction
    const transaction = new Transaction();

    // Get associated token accounts
    const userATA = await getAssociatedTokenAddress(
      tokenMint,
      new PublicKey(userWallet),
    );

    const recipientATA = await getAssociatedTokenAddress(
      tokenMint,
      new PublicKey(recipient),
    );

    const treasuryATA = await getAssociatedTokenAddress(
      tokenMint,
      new PublicKey(TREASURY_WALLET),
    );

    // Check if recipient ATA exists, create if not
    const recipientAccountInfo = await connection.getAccountInfo(recipientATA);
    if (!recipientAccountInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          new PublicKey(userWallet),
          recipientATA,
          new PublicKey(recipient),
          tokenMint
        )
      );
    }

    // Check if treasury ATA exists, create if not
    const treasuryAccountInfo = await connection.getAccountInfo(treasuryATA);
    if (!treasuryAccountInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          new PublicKey(userWallet),
          treasuryATA,
          new PublicKey(TREASURY_WALLET),
          tokenMint
        )
      );
    }

    // Add transfer to recipient (full amount)
    transaction.add(
      createTransferInstruction(
        userATA,
        recipientATA,
        new PublicKey(userWallet),
        paymentAmountSmallest
      )
    );

    // Add transfer to treasury (fee amount)
    transaction.add(
      createTransferInstruction(
        userATA,
        treasuryATA,
        new PublicKey(userWallet),
        treasuryFeeSmallest
      )
    );

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = new PublicKey(userWallet);

    // Serialize transaction for frontend signing
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    return NextResponse.json({
      success: true,
      transaction: serializedTransaction.toString('base64'),
      instructions: transaction.instructions.length,
      connection: {
        endpoint: RPC_ENDPOINT,
        commitment: "confirmed"
      }
    });

  } catch (error) {
    console.error("Error building transaction:", error);
    return NextResponse.json(
      { error: "Failed to build transaction" },
      { status: 500 }
    );
  }
} 