'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Send } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast, ToastContainer } from 'react-toastify';
import { usePrivy } from '@privy-io/react-auth';
import { useSolanaWallets, useSendTransaction } from '@privy-io/react-auth/solana';
import { sendTokens } from '@/app/actions/send';
import { Transaction, Connection } from '@solana/web3.js';
import { updateTransferStatus } from '@/app/actions/send';
import 'react-toastify/dist/ReactToastify.css';

export default function SendPage() {
  const router = useRouter();
  const { user } = usePrivy();
  const { sendTransaction } = useSendTransaction();
  const { wallets } = useSolanaWallets();
  const [sendType, setSendType] = useState<'verxio' | 'external'>('verxio');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!recipient.trim() || !amount.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!user?.wallet?.address) {
      toast.error('Wallet not connected');
      return;
    }

    setIsSending(true);

    try {
      // Send tokens using unified backend action
      const result = await sendTokens({
        sendType,
        recipient: recipient.trim(),
        amount: numAmount,
        senderWalletAddress: user.wallet.address
      });

      if (result.success && result.recipientWalletAddress) {
        try {
          // Build the transfer transaction using server action
          const { buildPaymentTransaction } = await import('@/app/actions/payment');
          const buildResult = await buildPaymentTransaction({
            reference: `transfer_${result.transferId}`,
            amount: amount,
            recipient: result.recipientWalletAddress,
            userWallet: user.wallet.address
          });

          if (!buildResult.success || !buildResult.transaction) {
            throw new Error(buildResult.error || 'Failed to build transaction');
          }

          // Deserialize the transaction
          const transaction = Transaction.from(Buffer.from(buildResult.transaction, 'base64'));

          // Sign and send transaction using Privy Solana wallet
          if (!wallets || wallets.length === 0) {
            throw new Error('No Solana wallets available');
          }

          const txResult = await sendTransaction({
            transaction: transaction,
            connection: new Connection(buildResult.connection.endpoint, 'confirmed'),
            address: wallets[0].address
          });

          await updateTransferStatus(result.transferId, txResult.signature);
          toast.success(`Transfer successful!`);

          // Reset form
          setRecipient('');
          setAmount('');

          // Navigate back to dashboard after a short delay
          setTimeout(() => router.push('/dashboard'), 1500);
        } catch (txError) {
          console.error('Transaction signing failed:', txError);
          toast.error('Transaction signing failed. Please try again.');
        }
      } else {
        setRecipient('');
        setAmount('');
        toast.error(result.error || 'Failed to send tokens');
      }
    } catch (error) {
      console.error('Error sending tokens:', error);
      toast.error('Failed to send tokens. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleBack = () => {
    router.push('/dashboard');
  };

  return (
    <>
      <div className="fixed top-20 right-6 z-50">
        <ToastContainer
          position="top-right"
          autoClose={3000}
          theme="dark"
          toastStyle={{
            marginTop: '20px',
            zIndex: 9999
          }}
        />
      </div>
      <AppLayout currentPage="dashboard">
        <div className="max-w-md mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center space-x-3">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-800 to-gray-900 border border-white/10 rounded-lg hover:border-white/20 hover:bg-white/5 transition-all duration-200 text-white/80 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Send Tokens</h1>
              <p className="text-gray-400">Loyalty native stablecoin transfer</p>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="space-y-6"
          >
            {/* Send Type Toggle */}
            <Card className="bg-gradient-to-br from-gray-900/90 via-black/80 to-gray-900/90 border border-white/10 text-white overflow-hidden relative mb-6">
              {/* Subtle background pattern */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/3 via-transparent to-blue-500/3 opacity-40"></div>

              <CardContent className="relative z-10 p-4">
                <div className="space-y-3">
                  <Label className="text-white/80 text-sm font-medium">Send To</Label>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={sendType === 'verxio'}
                        onCheckedChange={(checked) => {
                          setSendType(checked ? 'verxio' : 'external');
                          setRecipient('');
                        }}
                      />
                      <Label className="text-white text-sm">Verxio User</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={sendType === 'external'}
                        onCheckedChange={(checked) => {
                          setSendType(checked ? 'external' : 'verxio');
                          setRecipient('');
                        }}
                      />
                      <Label className="text-white text-sm">External Wallet</Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Send Form */}
            <Card className="bg-gradient-to-br from-gray-900/90 via-black/80 to-gray-900/90 border border-white/10 text-white overflow-hidden relative">
              {/* Subtle background pattern */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/3 via-transparent to-purple-500/3 opacity-40"></div>

              <CardHeader className="relative z-10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                  <h3 className="text-lg text-white font-semibold">
                    Transfer Details
                  </h3>
                </div>
              </CardHeader>

              <CardContent className="relative z-10 pt-0 space-y-5">
                {/* Recipient Field */}
                <div className="space-y-3">
                  <Label htmlFor="recipient" className="text-white/80 text-sm font-medium uppercase tracking-wider">
                    {sendType === 'verxio' ? 'Recipient Email' : 'Recipient Wallet Address'}
                  </Label>
                  <Input
                    id="recipient"
                    type={sendType === 'verxio' ? 'email' : 'text'}
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder={sendType === 'verxio' ? 'Enter email address' : 'Enter solana wallet address'}
                    className="bg-white/5 border border-white/15 text-white placeholder:text-white/40 rounded-lg h-12 px-4 focus:border-blue-500/50 focus:bg-white/8 transition-all duration-200"
                  />
                </div>

                {/* Amount */}
                <div className="space-y-3">
                  <Label htmlFor="amount" className="text-white/80 text-sm font-medium uppercase tracking-wider">
                    Amount (USDC)
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="bg-white/5 border border-white/15 text-white placeholder:text-white/40 rounded-lg h-12 px-4 focus:border-blue-500/50 focus:bg-white/8 transition-all duration-200"
                  />
                </div>

                {/* Send Button */}
                <Button
                  onClick={handleSend}
                  disabled={isSending || !recipient.trim() || !amount.trim()}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium text-white transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-blue-500/25"
                >
                  {isSending ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span className="font-medium">Sending...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Send className="w-5 h-5" />
                      <span className="font-medium">
                        {sendType === 'verxio' ? 'Send to Verxio User' : 'Send to External Wallet'}
                      </span>
                    </div>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </AppLayout>
    </>
  );
}
