// Shim to satisfy packages importing '@solana-program/token' by mapping
// to equivalent APIs in '@solana/spl-token'

export {
    // Equivalent of findAssociatedTokenPda -> getAssociatedTokenAddress
    getAssociatedTokenAddress as findAssociatedTokenPda,
    // Equivalent of getCreateAssociatedTokenIdempotentInstruction
    createAssociatedTokenAccountIdempotentInstruction as getCreateAssociatedTokenIdempotentInstruction,
    // Equivalent of getTransferInstruction
    createTransferInstruction as getTransferInstruction,
    // Also re-export common types/utilities just in case
    getMint,
    getAccount,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  } from '@solana/spl-token'