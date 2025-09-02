'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertCircle, CheckCircle, Clock, X } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast, ToastContainer } from 'react-toastify';
import { usePrivy } from '@privy-io/react-auth';
import { createWithdrawalOrder, getUSDCTokenInfo, validateSolanaWalletAddress, type CreateWithdrawalOrderData, type OrderUpdate } from '@/app/actions/withdraw';
import { getUserStats } from '@/app/actions/stats';
import { Spinner } from '@/components/ui/spinner';
import 'react-toastify/dist/ReactToastify.css';

// Socket.IO for real-time updates
import { io, Socket } from 'socket.io-client';

interface WithdrawalOrder {
  id: string;
  accountNumber: string;
  accountName: string;
  fiatAmount: number;
  bank: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
}

export default function WithdrawPage() {
  const router = useRouter();
  const { user } = usePrivy();
  const [amount, setAmount] = useState('');
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [withdrawalOrder, setWithdrawalOrder] = useState<WithdrawalOrder | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [orderStatus, setOrderStatus] = useState<'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | null>(null);
  const [userBalance, setUserBalance] = useState('0.00');
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);

  // Fetch user balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (!user?.wallet?.address) return;
      
      try {
        setIsLoadingBalance(true);
        const result = await getUserStats(user.wallet.address);
        
        if (result.success && result.stats) {
          setUserBalance(result.stats.usdcBalance);
        }
      } catch (error) {
        console.error('Error fetching balance:', error);
      } finally {
        setIsLoadingBalance(false);
      }
    };

    fetchBalance();
  }, [user?.wallet?.address]);

  // Initialize socket connection for order updates
  useEffect(() => {
    if (withdrawalOrder && !socket) {
      // Initialize socket connection based on environment
      const socketUrl = process.env.NODE_ENV === 'production' 
        ? 'wss://api.pajramp.com' 
        : 'wss://staging-api.pajramp.com';
      
      const newSocket = io(socketUrl, {
        transports: ['websocket'],
        autoConnect: false
      });

      newSocket.on('connect', () => {
        console.log('Connected to PAJ Ramp socket');
        // Join the order room
        newSocket.emit('join_order', withdrawalOrder.id);
      });

      newSocket.on('ORDER_UPDATE', (data: OrderUpdate) => {
        console.log('Order update received:', data);
        setOrderStatus(data.status);
        
        // Update local order status
        setWithdrawalOrder(prev => prev ? { ...prev, status: data.status } : null);

        // Show appropriate toast based on status
        switch (data.status) {
          case 'processing':
            toast.info('Your withdrawal is being processed...', {
              position: 'top-right',
              autoClose: 5000,
              theme: 'dark',
            });
            break;
          case 'completed':
            toast.success('Withdrawal completed successfully!', {
              position: 'top-right',
              autoClose: 10000,
              theme: 'dark',
            });
            break;
          case 'failed':
            toast.error('Withdrawal failed. Please contact support.', {
              position: 'top-right',
              autoClose: 10000,
              theme: 'dark',
            });
            break;
          case 'cancelled':
            toast.warning('Withdrawal was cancelled.', {
              position: 'top-right',
              autoClose: 5000,
              theme: 'dark',
            });
            break;
        }
      });

      newSocket.on('ERROR', (error: any) => {
        console.error('Socket error:', error);
        toast.error('Connection error. Please refresh the page.', {
          position: 'top-right',
          autoClose: 5000,
          theme: 'dark',
        });
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from PAJ Ramp socket');
      });

      newSocket.connect();
      setSocket(newSocket);
    }

    // Cleanup socket on unmount
    return () => {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    };
  }, [withdrawalOrder, socket]);

  const handleCreateWithdrawal = async () => {
    if (!amount.trim()) {
      toast.error('Please enter an amount');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const availableBalance = parseFloat(userBalance);
    if (numAmount > availableBalance) {
      toast.error('Insufficient balance');
      return;
    }

    if (!user?.wallet?.address) {
      toast.error('Wallet not connected');
      return;
    }

    // Validate Solana wallet address
    const isValidAddress = await validateSolanaWalletAddress(user.wallet.address);
    if (!isValidAddress) {
      toast.error('Invalid Solana wallet address');
      return;
    }

    setIsCreatingOrder(true);

    try {
      // For demo purposes, we'll use a mock verification token
      // In production, this should be obtained through proper verification flow
      const verificationToken = 'demo_token_' + Date.now();

      const orderData: CreateWithdrawalOrderData = {
        fiatAmount: numAmount,
        currency: 'NGN', // Currently only Nigeria is supported
        recipient: user.wallet.address,
        token: verificationToken
      };

      const result = await createWithdrawalOrder(orderData);

      if (result.success && result.order) {
        setWithdrawalOrder({
          ...result.order,
          status: 'pending'
        });
        setOrderStatus('pending');
        
        toast.success('Withdrawal order created successfully!', {
          position: 'top-right',
          autoClose: 5000,
          theme: 'dark',
        });

        // Clear form
        setAmount('');
      } else {
        toast.error(result.error || 'Failed to create withdrawal order');
      }
    } catch (error: any) {
      console.error('Error creating withdrawal:', error);
      toast.error(error.message || 'Failed to create withdrawal order');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handleBack = () => {
    router.push('/dashboard');
  };

  const handleNewWithdrawal = () => {
    setWithdrawalOrder(null);
    setOrderStatus(null);
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
  };

  const getStatusIcon = () => {
    switch (orderStatus) {
      case 'pending':
        return <Clock className="w-8 h-8 text-yellow-400" />;
      case 'processing':
        return <Spinner size="lg" className="text-blue-400" />;
      case 'completed':
        return <CheckCircle className="w-8 h-8 text-green-400" />;
      case 'failed':
      case 'cancelled':
        return <X className="w-8 h-8 text-red-400" />;
      default:
        return <Clock className="w-8 h-8 text-yellow-400" />;
    }
  };

  const getStatusText = () => {
    switch (orderStatus) {
      case 'pending':
        return 'Waiting for payment confirmation';
      case 'processing':
        return 'Processing your withdrawal...';
      case 'completed':
        return 'Withdrawal completed successfully!';
      case 'failed':
        return 'Withdrawal failed';
      case 'cancelled':
        return 'Withdrawal was cancelled';
      default:
        return 'Processing...';
    }
  };

  const getStatusColor = () => {
    switch (orderStatus) {
      case 'pending':
        return 'text-yellow-400';
      case 'processing':
        return 'text-blue-400';
      case 'completed':
        return 'text-green-400';
      case 'failed':
      case 'cancelled':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
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
              <h1 className="text-2xl font-bold text-white">Withdraw to Bank</h1>
              <p className="text-gray-400">Convert crypto to Naira (NGN)</p>
            </div>
          </div>

          {/* Show withdrawal form or order status */}
          {!withdrawalOrder ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="space-y-6"
            >
              {/* Balance Display */}
              <Card className="bg-gradient-to-br from-gray-900/90 via-black/80 to-gray-900/90 border border-white/10 text-white overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/3 via-transparent to-blue-500/3 opacity-40"></div>
                <CardContent className="relative z-10 p-4">
                  <div className="text-center">
                    <div className="text-sm text-white/70 mb-1">Available Balance</div>
                    <div className="text-2xl font-bold text-white">
                      {isLoadingBalance ? (
                        <Spinner size="sm" className="mx-auto" />
                      ) : (
                        `${userBalance} USDC`
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Withdrawal Form */}
              <Card className="bg-gradient-to-br from-gray-900/90 via-black/80 to-gray-900/90 border border-white/10 text-white overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/3 via-transparent to-purple-500/3 opacity-40"></div>

                <CardHeader className="relative z-10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <h3 className="text-lg text-white font-semibold">
                      Withdrawal Details
                    </h3>
                  </div>
                </CardHeader>

                <CardContent className="relative z-10 pt-0 space-y-5">
                  {/* Notice */}
                  <div className="p-3 bg-orange-500/20 rounded-lg border border-orange-500/30">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-orange-200">
                        <p className="font-medium mb-1">Nigeria Only</p>
                        <p>Currently, withdrawals are only available to Nigerian bank accounts (NGN).</p>
                      </div>
                    </div>
                  </div>

                  {/* Token Info Display */}
                  <div className="space-y-3">
                    <Label className="text-white/80 text-sm font-medium uppercase tracking-wider">
                      Token & Network
                    </Label>
                    <div className="p-3 bg-white/5 rounded-lg border border-white/15">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-white font-medium">USDC - USD Coin</div>
                          <div className="text-white/60 text-sm">Solana Network</div>
                        </div>
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">$</span>
                        </div>
                      </div>
                    </div>
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
                      max={userBalance}
                      className="bg-white/5 border border-white/15 text-white placeholder:text-white/40 rounded-lg h-12 px-4 focus:border-green-500/50 focus:bg-white/8 transition-all duration-200"
                    />
                    <div className="text-xs text-white/60">
                      Available: {userBalance} USDC
                    </div>
                  </div>

                  {/* Create Order Button */}
                  <Button
                    onClick={handleCreateWithdrawal}
                    disabled={isCreatingOrder || !amount.trim() || isLoadingBalance}
                    className="w-full h-12 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium text-white transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-green-500/25"
                  >
                    {isCreatingOrder ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span className="font-medium">Creating Order...</span>
                      </div>
                    ) : (
                      <span className="font-medium">Create Withdrawal Order</span>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            /* Order Status Display */
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="space-y-6"
            >
              {/* Status Card */}
              <Card className="bg-gradient-to-br from-gray-900/90 via-black/80 to-gray-900/90 border border-white/10 text-white overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/3 via-transparent to-blue-500/3 opacity-40"></div>
                
                <CardContent className="relative z-10 p-6">
                  <div className="text-center space-y-4">
                    {getStatusIcon()}
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">
                        Withdrawal Order Created
                      </h3>
                      <p className={`text-lg ${getStatusColor()}`}>
                        {getStatusText()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Bank Details Card */}
              <Card className="bg-gradient-to-br from-gray-900/90 via-black/80 to-gray-900/90 border border-white/10 text-white overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/3 via-transparent to-blue-500/3 opacity-40"></div>
                
                <CardHeader className="relative z-10 pb-4">
                  <h3 className="text-lg text-white font-semibold">
                    Bank Transfer Details
                  </h3>
                </CardHeader>
                
                <CardContent className="relative z-10 pt-0 space-y-4">
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-white/70">Bank:</span>
                        <span className="text-white font-medium">{withdrawalOrder.bank}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Account Name:</span>
                        <span className="text-white font-medium">{withdrawalOrder.accountName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Account Number:</span>
                        <span className="text-white font-mono">{withdrawalOrder.accountNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Amount:</span>
                        <span className="text-white font-bold">₦{withdrawalOrder.fiatAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Order ID:</span>
                        <span className="text-white font-mono text-sm">{withdrawalOrder.id}</span>
                      </div>
                    </div>
                  </div>

                  {orderStatus === 'pending' && (
                    <div className="p-3 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
                      <div className="text-sm text-yellow-200">
                        <p className="font-medium mb-1">Next Steps:</p>
                        <p>Please transfer the exact amount to the bank account details above. Your withdrawal will be processed once payment is confirmed.</p>
                      </div>
                    </div>
                  )}

                  {orderStatus === 'completed' && (
                    <Button
                      onClick={handleNewWithdrawal}
                      className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg font-medium text-white transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-blue-500/25"
                    >
                      Create New Withdrawal
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </AppLayout>
    </>
  );
}
