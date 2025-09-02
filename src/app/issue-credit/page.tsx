'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { motion } from 'framer-motion';
import { CreditCard, LogOut, Wallet, AlertCircle, Check } from 'lucide-react';
import { Tiles } from '@/components/layout/backgroundTiles';
import Image from 'next/image';
import { giveVerxioCredits } from '@/app/actions/verxio-credit';
import { getVerxioConfig } from '@/app/actions/loyalty';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';
import { UserVerification } from '@/components/auth/user-verification';

export default function IssueCreditPage() {
  const { authenticated, ready, user, login, logout } = usePrivy();
  const [userAddress, setUserAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const [authorizedAddress, setAuthorizedAddress] = useState<string>('');
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{userAddress: string, amount: string} | null>(null);

  // Check if user is authorized (only after config is loaded)
  const isAuthorized = isConfigLoaded && authenticated && user?.wallet?.address === authorizedAddress;

  // Fetch config on component mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await getVerxioConfig();
        if (config.authorizedAddress) {
          setAuthorizedAddress(config.authorizedAddress);
        }
        setIsConfigLoaded(true);
      } catch (error) {
        console.error('Failed to fetch config:', error);
      }
    };
    fetchConfig();
  }, []);

  const handleIssueCredits = async () => {
    if (!userAddress || !amount || parseFloat(amount) <= 0) {
      setMessage('Please enter a valid address and amount');
      setMessageType('error');
      return;
    }

    setIsProcessing(true);
    setMessage('');

    try {
      const result = await giveVerxioCredits(userAddress, parseFloat(amount));
      
      if (result.success) {
        setSuccessData({ userAddress, amount });
        setShowSuccess(true);
        setUserAddress('');
        setAmount('');
      } else {
        setMessage(result.error || 'Failed to issue credits');
        setMessageType('error');
      }
    } catch (error) {
      setMessage('An error occurred while issuing credits');
      setMessageType('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const clearMessage = () => {
    setMessage('');
    setMessageType('');
  };

  // Clear message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(clearMessage, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden">
        <Tiles rows={50} cols={50} tileSize="md" />
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <VerxioLoaderWhite size="lg" />
            <p className="text-white mt-4 text-lg">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <UserVerification>
      <div className="min-h-screen bg-black relative overflow-hidden">
        <Tiles rows={50} cols={50} tileSize="md" />
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between p-4 border-b border-white/10 bg-black/80 backdrop-blur-sm">
        <div className="relative w-10 h-10">
          <Image
            src="/logo/verxioIconWhite.svg"
            alt="Verxio"
            width={40}
            height={40}
            className="w-full h-full"
          />
        </div>
        
        <div className="flex items-center gap-4">
          {authenticated && (
            <>
              <span className="text-white text-sm">
                {user?.wallet?.address?.slice(0, 6)}...{user?.wallet?.address?.slice(-4)}
              </span>
              <button
                onClick={logout}
                className="flex items-center gap-2 text-white hover:text-red-400 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen pt-20 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md mx-auto"
        >
          <div className="bg-black border border-zinc-800 p-6 max-w-md w-full rounded-xl relative overflow-hidden">
            <div className="relative">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Issue Verxio Credits</h2>
                <p className="text-zinc-400 text-sm">Issue loyalty points to users</p>
              </div>

              {!authenticated ? (
                <div className="text-center py-8">
                  <Wallet className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
                  <p className="text-white mb-4">Please connect your wallet to continue</p>
                  <button
                    onClick={login}
                    className="bg-gradient-to-r from-[#00adef] to-[#056f96] hover:from-[#0098d1] hover:to-[#0088c1] text-white py-3 px-6 rounded-lg font-medium transition-all duration-200"
                  >
                    Connect Wallet
                  </button>
                </div>
              ) : !isConfigLoaded ? (
                <div className="text-center py-8">
                  <VerxioLoaderWhite size="md" />
                  <p className="text-white mb-2">Loading Configuration...</p>
                  <p className="text-zinc-400 text-sm">Please wait while we verify your access</p>
                </div>
              ) : !isAuthorized ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                  <p className="text-white mb-2">Access Denied</p>
                  <p className="text-zinc-400 text-sm">
                    Only authorized addresses can issue Verxio credits
                  </p>
                  <p className="text-zinc-500 text-xs mt-2">
                    Your address: {user?.wallet?.address?.slice(0, 6)}...{user?.wallet?.address?.slice(-4)}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <label className="block text-white text-sm font-medium mb-2">
                      User Address
                    </label>
                    <input
                      type="text"
                      value={userAddress}
                      onChange={(e) => setUserAddress(e.target.value)}
                      placeholder="Enter wallet address"
                      className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-[#00adef] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-white text-sm font-medium mb-2">
                      Amount
                    </label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Enter credit amount"
                      min="0"
                      step="0.01"
                      className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-[#00adef] transition-colors"
                    />
                  </div>

                  {message && messageType === 'error' && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-red-400">{message}</p>
                    </div>
                  )}

                  <button
                    onClick={handleIssueCredits}
                    disabled={isProcessing || !userAddress || !amount}
                    className="w-full bg-gradient-to-r from-[#00adef] to-[#056f96] hover:from-[#0098d1] hover:to-[#0088c1] text-white disabled:opacity-50 py-3 px-6 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl shadow-[#00adef]/25 hover:shadow-[#00adef]/40 transform hover:scale-105 disabled:hover:scale-100"
                  >
                    {isProcessing ? (
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        Issuing Credits...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 justify-center">
                        <CreditCard className="w-4 h-4" />
                        Issue Credits
                      </div>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Success Page */}
      {showSuccess && successData && (
        <div className="fixed inset-0 z-50 bg-black">
          <Tiles rows={50} cols={50} tileSize="md" />
          <div className="relative z-10 flex items-center justify-center min-h-screen pt-20 px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-md mx-auto"
            >
              <div className="bg-black border border-zinc-800 p-6 max-w-md w-full rounded-xl relative overflow-hidden">
                <div className="relative">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center space-y-4"
                  >
                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
                      <Check className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white">Credits Issued Successfully</h3>
                    <p className="text-white/80">Verxio credits have been issued to the user!</p>
                    
                    <div className="p-4 bg-black/20 rounded-lg border border-white/10">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-white">Amount:</span>
                        <span className="text-white font-medium">{successData.amount} Verxio Credits</span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-white">Recipient:</span>
                        <span className="text-white font-mono text-sm truncate max-w-32">
                          {successData.userAddress.slice(0, 8)}...{successData.userAddress.slice(-8)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="pt-4">
                      <button
                        onClick={() => setShowSuccess(false)}
                        className="w-full bg-gradient-to-r from-[#00adef] to-[#056f96] hover:from-[#0098d1] hover:to-[#0088c1] text-white py-3 px-6 rounded-lg font-medium transition-all duration-200"
                      >
                        Issue More Credits
                      </button>
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}
      </div>
    </UserVerification>
  );
}
