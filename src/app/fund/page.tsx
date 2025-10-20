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
import { toast, ToastContainer } from 'react-toastify';
import { usePrivy } from '@privy-io/react-auth';
import { getUserStats } from '@/app/actions/stats';
import { Spinner } from '@/components/ui/spinner';
import 'react-toastify/dist/ReactToastify.css';

// Real-time updates handled by PAJ Ramp observer

interface FundingOrder {
  id: string;
  accountNumber: string;
  accountName: string;
  fiatAmount: number;
  bank: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
}

export default function FundPage() {
  const router = useRouter();
  const { user } = usePrivy();
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [fundingOrder, setFundingOrder] = useState<FundingOrder | null>(null);
  const [orderStatus, setOrderStatus] = useState<'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | null>(null);
  const [userBalance, setUserBalance] = useState('0.00');
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);

  // PAJ Session Management State
  const [sessionStep, setSessionStep] = useState<'form' | 'checking' | 'initiate' | 'verify' | 'creating' | 'tracking'>('form');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [isInitiatingSession, setIsInitiatingSession] = useState(false);
  const [isVerifyingSession, setIsVerifyingSession] = useState(false);
  const [ngnAmount, setNgnAmount] = useState('');
  const [usdcAmount, setUsdcAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState<number>(1550); // Default fallback rate
  const [isFundingInProgress, setIsFundingInProgress] = useState(false);

  // console.log('rate', exchangeRate)
  // console.log(user, 'user')
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

  // Fetch exchange rate from PAJ Ramp - COMMENTED OUT
  // useEffect(() => {
  //   const fetchExchangeRate = async () => {
  //     try {
  //       const rateResult = await getExchangeRate();
  //       console.log('rateResult', rateResult)
  //       // if (rateResult.success) {
  //       //   setExchangeRate(rateResult);
  //       // }
  //     } catch (error) {
  //       console.error('Error fetching exchange rate:', error);
  //       // Keep default rate on error
  //     }
  //   };

  //   fetchExchangeRate();
  // }, []);

  // Convert NGN to USDC using dynamic rate
  const convertNgnToUsdc = (ngnValue: string) => {
    if (!ngnValue || isNaN(parseFloat(ngnValue))) return '';
    const usdValue = parseFloat(ngnValue) / exchangeRate;
    return usdValue.toFixed(2);
  };

  // Handle NGN amount change
  const handleNgnAmountChange = (value: string) => {
    setNgnAmount(value);
    setUsdcAmount(convertNgnToUsdc(value));
  };

  // Order status observer - COMMENTED OUT
  // const startOrderObserver = async (orderId: string) => {
  //   try {
  //     const result = await observeOrder(orderId);
      
  //     if (result.success && result.observer) {
  //       console.log('Order observer started for:', orderId);
        
  //       // PAJ Ramp observer might have different callback structure
  //       // For now, we'll implement basic polling as fallback
  //       const pollOrderStatus = async () => {
  //         try {
  //           // This would typically be replaced with actual PAJ Ramp status checking
  //           console.log('Polling order status for:', orderId);
            
  //           // Simulate status updates (in production this would call PAJ API)
  //           setTimeout(() => {
  //             toast.info('Your funding is being processed...', {
  //               position: 'top-right',
  //               autoClose: 5000,
  //               theme: 'dark',
  //             });
  //           }, 2000);
  //         } catch (error) {
  //           console.error('Error polling order status:', error);
  //         }
  //       };
        
  //       pollOrderStatus();
  //     } else {
  //       console.error('Failed to start order observer:', result.error);
  //     }
  //   } catch (error) {
  //     console.error('Error starting order observer:', error);
  //   }
  // };

  // Handle session initiation - COMMENTED OUT
  // const handleInitiateSession = async () => {
  //   if (!user?.email) {
  //     toast.error('User email not found');
  //     return;
  //   }

  //   setIsInitiatingSession(true);

  //   try {
  //     const result = await initiateSession({ email: user.email.address });

  //     if (result.success) {
  //       toast.success('OTP sent to your email. Please check and enter it below.');
  //       setSessionStep('verify');
  //     } else {
  //       toast.error(result.error || 'Failed to initiate session');
  //     }
  //   } catch (error: any) {
  //     console.error('Error initiating session:', error);
  //     toast.error('Failed to initiate session');
  //   } finally {
  //     setIsInitiatingSession(false);
  //   }
  // };

  // Handle session verification - COMMENTED OUT
  // const handleVerifySession = async () => {
  //   if (!user?.email || !otp.trim()) {
  //     toast.error('Please enter the OTP');
  //     return;
  //   }

  //   setIsVerifyingSession(true);

  //   try {
  //     const userAgent = navigator.userAgent;
  //     const deviceInfo = await getDeviceInfo(user.email.address, userAgent);

  //     if (!deviceInfo) {
  //       toast.error('Failed to get device information');
  //       return;
  //     }

  //     const result = await verifySession({
  //       email: user.email.address,
  //       otp: otp.trim(),
  //       uuid: deviceInfo.uuid,
  //       device: deviceInfo.device
  //     });

  //     if (result.success && result.data?.token) {
  //       setSessionToken(result.data.token);
  //       setOtp('');
  //       toast.success('Session verified successfully!');
        
  //       // Continue with order creation
  //       const amount = parseFloat(ngnAmount);
  //       await createOrderWithToken(result.data.token, amount);
  //     } else {
  //       toast.error(result.error || 'Failed to verify session');
  //     }
  //   } catch (error: any) {
  //     console.error('Error verifying session:', error);
  //     toast.error('Failed to verify session');
  //   } finally {
  //     setIsVerifyingSession(false);
  //   }
  // };

  // Handle create funding - COMMENTED OUT (PAJ functions disabled)
  const handleCreateFunding = async () => {
    toast.info('Funding functionality is temporarily disabled for testing.');
    return;
    
    // // Set loading state immediately
    // setIsFundingInProgress(true);

    // try {
    //   if (!ngnAmount.trim()) {
    //     toast.error('Please enter an amount in NGN');
    //     return;
    //   }

    //   const numAmount = parseFloat(ngnAmount);
    //   if (isNaN(numAmount) || numAmount <= 0) {
    //     toast.error('Please enter a valid amount');
    //     return;
    //   }

    //   // Minimum check (5 USDC equivalent in NGN using dynamic rate)
    //   const minNgnAmount = 5 * exchangeRate; // 5 USDC * current NGN/USD rate
    //   if (numAmount < minNgnAmount) {
    //     toast.error(`Minimum amount is ₦${minNgnAmount.toLocaleString()} (≈ 5 USDC)`);
    //     return;
    //   }

    //   if (!user?.wallet?.address) {
    //     toast.error('Wallet not connected');
    //     return;
    //   }

    //   if (!user?.email) {
    //     toast.error('User email not found');
    //     return;
    //   }

    //   // Validate Solana wallet address
    //   const isValidAddress = await validateSolanaWalletAddress(user.wallet.address);
    //   if (!isValidAddress) {
    //     toast.error('Invalid Solana wallet address');
    //     return;
    //   }

    //   // Start session flow
    //   setSessionStep('checking');
    //   setIsFundingInProgress(false); // Clear button loading, show step loading
      
    //   // Check if user already has an active session
    //   try {
    //     const sessionStatus = await checkSessionStatus(user.email.address);
        
    //     if (sessionStatus.success && sessionStatus.isActive && sessionStatus.token) {
    //       // User has active session, proceed to create order
    //       setSessionToken(sessionStatus.token);
    //       await createOrderWithToken(sessionStatus.token, numAmount);
    //     } else {
    //       // Need to initiate new session
    //       setSessionStep('initiate');
    //       await handleInitiateSession();
    //     }
    //   } catch (error) {
    //     console.error('Error checking session status:', error);
    //     setSessionStep('initiate');
    //     await handleInitiateSession();
    //   }
    // } catch (error) {
    //   console.error('Error in funding process:', error);
    //   toast.error('Something went wrong. Please try again.');
    //   setSessionStep('form');
    // } finally {
    //   // Only clear loading if we're still on the form step (error occurred)
    //   if (sessionStep === 'form') {
    //     setIsFundingInProgress(false);
    //   }
    // }
  };

  // Create order with verified token - COMMENTED OUT
  // const createOrderWithToken = async (token: string, amount: number) => {
  //   setSessionStep('creating');
  //   setIsCreatingOrder(true);

  //   try {
  //     const orderData: CreateFundingOrderData = {
  //       fiatAmount: amount,
  //       currency: 'NGN',
  //       recipient: user!.wallet!.address,
  //       token: token
  //     };

  //     const result = await createFundingOrder(orderData);

  //     if (result.success && result.order) {
  //       setFundingOrder({
  //         ...result.order,
  //         status: 'pending'
  //       });
  //       setOrderStatus('pending');
  //       setSessionStep('tracking');

  //       toast.success('Funding order created successfully!', {
  //         position: 'top-right',
  //         autoClose: 5000,
  //         theme: 'dark',
  //       });

  //       // Start observing order status
  //       startOrderObserver(result.order.id);

  //       // Clear form
  //       setNgnAmount('');
  //       setUsdcAmount('');
  //     } else {
  //       toast.error(result.error || 'Failed to create funding order');
  //       setSessionStep('form');
  //     }
  //   } catch (error: any) {
  //     console.error('Error creating funding:', error);
  //     toast.error(error.message || 'Failed to create funding order');
  //     setSessionStep('form');
  //   } finally {
  //     setIsCreatingOrder(false);
  //   }
  // };

  const handleBack = () => {
    router.push('/dashboard');
  };

  const handleNewFunding = () => {
    setFundingOrder(null);
    setOrderStatus(null);
    setSessionStep('form');
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
        return 'Processing your funding...';
      case 'completed':
        return 'Funding completed successfully!';
      case 'failed':
        return 'Funding failed';
      case 'cancelled':
        return 'Funding was cancelled';
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
              <h1 className="text-2xl font-bold text-white">Fund Account</h1>
              <p className="text-gray-400">Buy USDC with Naira (NGN)</p>
            </div>
          </div>

          {/* Show different steps based on session status */}
          {!fundingOrder ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="space-y-6"
            >
              {/* Default Form - Always show first */}
              {sessionStep === 'form' && (
                <Card className="bg-gradient-to-br from-gray-900/90 via-black/80 to-gray-900/90 border border-white/10 text-white overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/3 via-transparent to-purple-500/3 opacity-40"></div>

                  <CardHeader className="relative z-10 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <h3 className="text-lg text-white font-semibold">Fund Your Account</h3>
                    </div>
                  </CardHeader>

                  <CardContent className="relative z-10 pt-0 space-y-5">
                    {/* Notice */}
                    <div className="p-3 bg-orange-500/20 rounded-lg border border-orange-500/30">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-orange-200">
                          <p className="font-medium mb-1">Nigeria Only</p>
                          <p>Currently, funding is only available from Nigerian bank accounts (NGN).</p>
                        </div>
                      </div>
                    </div>

                    {/* NGN Amount Input */}
                    <div className="space-y-3">
                      <Label htmlFor="ngnAmount" className="text-white/80 text-sm font-medium uppercase tracking-wider">
                        Amount to Deposit (NGN)
                      </Label>
                      <Input
                        id="ngnAmount"
                        type="number"
                        value={ngnAmount}
                        onChange={(e) => handleNgnAmountChange(e.target.value)}
                        placeholder="0.00"
                        step="100"
                        min="0"
                        className="bg-white/5 border border-white/15 text-white placeholder:text-white/40 rounded-lg h-12 px-4 focus:border-green-500/50 focus:bg-white/8 transition-all duration-200"
                      />
                      <div className="text-xs text-white/60">
                        Minimum Deposit: ₦{(5 * exchangeRate).toLocaleString()} (≈ 5 USDC)
                      </div>
                    </div>

                    {/* USDC Equivalent Display */}
                    {usdcAmount && (
                      <div className="space-y-3">
                        <Label className="text-white/80 text-sm font-medium uppercase tracking-wider">
                          You Will Receive (Approximate)
                        </Label>
                        <div className="p-3 bg-white/5 rounded-lg border border-white/15">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-white font-medium">≈ {usdcAmount} USDC</div>
                              <div className="text-white/60 text-sm">USD Coin on Solana</div>
                            </div>
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs font-bold">$</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Fund Account Button */}
                    <Button
                      onClick={handleCreateFunding}
                      disabled={true}
                      className="w-full h-12 bg-gradient-to-r from-gray-600 to-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium text-white transition-all duration-200 shadow-lg relative"
                    >
                      <span className="font-medium">Fund Account</span>
                      <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs px-1 py-0.5 rounded-full font-bold shadow-lg text-[9px]">
                        Coming Soon
                      </span>
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Session Step: Checking */}
              {sessionStep === 'checking' && (
                <Card className="bg-gradient-to-br from-gray-900/90 via-black/80 to-gray-900/90 border border-white/10 text-white overflow-hidden relative">
                  <CardContent className="relative z-10 p-6">
                    <div className="text-center space-y-4">
                      <Spinner size="lg" className="text-blue-400" />
                      <p className="text-white/80">Checking session status...</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Session Step: Initiate */}
              {sessionStep === 'initiate' && (
                <Card className="bg-gradient-to-br from-gray-900/90 via-black/80 to-gray-900/90 border border-white/10 text-white overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/3 via-transparent to-purple-500/3 opacity-40"></div>

                  <CardContent className="relative z-10 p-6">
                    <div className="text-center space-y-4">
                      <Spinner size="lg" className="text-blue-400" />
                      <div>
                        <h3 className="text-lg text-white font-semibold mb-2">
                          {isInitiatingSession ? 'Sending Verification Code' : 'Initializing Session'}
                        </h3>
                        <p className="text-white/80">
                          {isInitiatingSession 
                            ? "We're sending an OTP to your email address..." 
                            : "Setting up your verification session..."
                          }
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Session Step: Verify */}
              {sessionStep === 'verify' && (
                <Card className="bg-gradient-to-br from-gray-900/90 via-black/80 to-gray-900/90 border border-white/10 text-white overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/3 via-transparent to-blue-500/3 opacity-40"></div>

                  <CardHeader className="relative z-10 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <h3 className="text-lg text-white font-semibold">Enter Verification Code</h3>
                    </div>
                  </CardHeader>

                  <CardContent className="relative z-10 pt-0 space-y-5">
                    <div className="p-3 bg-green-500/20 rounded-lg border border-green-500/30">
                      <div className="text-sm text-green-200">
                        <p className="font-medium mb-1">OTP Sent</p>
                        <p>Please check your email and enter the verification code below.</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="otp" className="text-white/80 text-sm font-medium uppercase tracking-wider">
                        Verification Code
                      </Label>
                      <Input
                        id="otp"
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="Enter 6-digit code"
                        maxLength={6}
                        className="bg-white/5 border border-white/15 text-white placeholder:text-white/40 rounded-lg h-12 px-4 focus:border-green-500/50 focus:bg-white/8 transition-all duration-200"
                      />
                    </div>

                    <Button
                      onClick={() => toast.info('OTP verification is temporarily disabled.')}
                      disabled={true}
                      className="w-full h-12 bg-gradient-to-r from-gray-600 to-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium text-white transition-all duration-200 shadow-lg"
                    >
                      {isVerifyingSession ? (
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span className="font-medium">Verifying...</span>
                        </div>
                      ) : (
                        <span className="font-medium">Verify Code</span>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Session Step: Creating Order */}
              {sessionStep === 'creating' && (
                <Card className="bg-gradient-to-br from-gray-900/90 via-black/80 to-gray-900/90 border border-white/10 text-white overflow-hidden relative">
                  <CardContent className="relative z-10 p-6">
                    <div className="text-center space-y-4">
                      <Spinner size="lg" className="text-green-400" />
                      <div>
                        <h3 className="text-lg text-white font-semibold mb-2">Creating Funding Order</h3>
                        <p className="text-white/80">Please wait while we process your request...</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
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
                        Funding Order Created
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
                        <span className="text-white font-medium">{fundingOrder?.bank}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Account Name:</span>
                        <span className="text-white font-medium">{fundingOrder?.accountName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Account Number:</span>
                        <span className="text-white font-mono">{fundingOrder?.accountNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Amount:</span>
                        <span className="text-white font-bold">₦{fundingOrder?.fiatAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Order ID:</span>
                        <span className="text-white font-mono text-sm">{fundingOrder?.id}</span>
                      </div>
                    </div>
                  </div>

                  {orderStatus === 'pending' && (
                    <div className="p-3 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
                      <div className="text-sm text-yellow-200">
                        <p className="font-medium mb-1">Next Steps:</p>
                        <p>Please transfer the exact amount to the bank account details above. Your USDC will be credited to your wallet once payment is confirmed.</p>
                      </div>
                    </div>
                  )}

                  {orderStatus === 'completed' && (
                    <Button
                      onClick={handleNewFunding}
                      className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg font-medium text-white transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-blue-500/25"
                    >
                      Create New Funding Order
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
