'use client';
import React, { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Edit3, Save, X, User, Mail, FileText, ArrowLeft, Copy } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast, ToastContainer } from 'react-toastify';
import { updateUserProfile, getUserByWallet } from '@/app/actions/user';
import { getUserReferralStats, getOrCreateUserReferralCode, checkSignupBonusEligibility, claimSignupBonus } from '@/app/actions/referral';
import "react-toastify/dist/ReactToastify.css";

interface UserProfile {
  id: string;
  walletAddress: string;
  email: string | null;
  name: string | null;
  bio: string | null;
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export default function ProfilePage() {
  const { user, authenticated, ready } = usePrivy();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    bio: '',
    avatar: ''
  });
  const [referralStats, setReferralStats] = useState<any>(null);
  const [referralCode, setReferralCode] = useState<string>('');
  const [currentReferralPage, setCurrentReferralPage] = useState(1);
  const [referralsPerPage] = useState(5);
  const [signupBonusEligibility, setSignupBonusEligibility] = useState<any>(null);
  const [isClaimingBonus, setIsClaimingBonus] = useState(false);

  useEffect(() => {
    if (!ready) return;
    
    if (!authenticated) {
      router.push('/');
      return;
    }

    // Load all data in parallel and only show page when everything is ready
    const loadAllData = async () => {
      try {
        setIsLoading(true);
        
        // Load all data concurrently
         await Promise.all([
          loadProfile(),
          loadReferralData(),
          checkSignupBonus()
        ]);
        
        // Only set loading to false when all data is loaded
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setIsLoading(false);
      }
    };

    loadAllData();
  }, [ready, authenticated, user, router]);

  const loadProfile = async () => {
    if (!user?.wallet?.address) return;
    
    try {
      const result = await getUserByWallet(user.wallet.address);
      
      if (result.success && result.user) {
        setProfile(result.user);
        setFormData({
          name: result.user.name || '',
          email: result.user.email || '',
          bio: result.user.bio || '',
          avatar: result.user.avatar || ''
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Failed to load profile');
    }
  };

  const loadReferralData = async () => {
    if (!user?.wallet?.address) return;
    
    try {
      // Get or create referral code
      const codeResult = await getOrCreateUserReferralCode(user.wallet.address);
      if (codeResult.success && codeResult.referralCode) {
        setReferralCode(codeResult.referralCode);
      }
      
      // Get referral stats
      const statsResult = await getUserReferralStats(user.wallet.address);
      if (statsResult.success) {
        setReferralStats(statsResult.stats);
        setCurrentReferralPage(1); // Reset to first page when new data loads
      }
    } catch (error) {
      console.error('Error loading referral data:', error);
    }
  };

  const goToReferralPage = (page: number) => {
    if (page < 1 || !referralStats?.referralsGiven) return;
    
    const maxPage = Math.ceil(referralStats.referralsGiven.length / referralsPerPage);
    if (page > maxPage) return;
    
    setCurrentReferralPage(page);
  };

  const getCurrentReferrals = () => {
    if (!referralStats?.referralsGiven) return [];
    
    const startIndex = (currentReferralPage - 1) * referralsPerPage;
    const endIndex = startIndex + referralsPerPage;
    return referralStats.referralsGiven.slice(startIndex, endIndex);
  };

  const checkSignupBonus = async () => {
    if (!user?.wallet?.address) return;
    
    try {
      const result = await checkSignupBonusEligibility(user.wallet.address);
      setSignupBonusEligibility(result);
    } catch (error) {
      console.error('Error checking signup bonus:', error);
      toast.error('Failed to check signup bonus eligibility');
    }
  };

  const handleClaimSignupBonus = async () => {
    if (!user?.wallet?.address) return;
    
    setIsClaimingBonus(true);
    try {
      const result = await claimSignupBonus(user.wallet.address);
      if (result.success) {
        toast.success(result.message);
        // Refresh referral data to show updated status
        await loadReferralData();
        // Check eligibility again to show "already claimed" status
        await checkSignupBonus();
      } else {
        toast.error(result.error || 'Failed to claim signup bonus');
      }
    } catch (error) {
      console.error('Error claiming signup bonus:', error);
      toast.error('Failed to claim signup bonus');
    } finally {
      setIsClaimingBonus(false);
    }
  };

  const handleSave = async () => {
    if (!user?.wallet?.address) return;
    
    try {
      setIsSaving(true);
      const result = await updateUserProfile(user.wallet.address, formData);
      
      if (result.success && result.user) {
        setProfile(result.user);
        setIsEditing(false);
        toast.success('Profile updated successfully!');
      } else {
        toast.error(result.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        email: profile.email || '',
        bio: profile.bio || '',
        avatar: profile.avatar || ''
      });
    }
    setIsEditing(false);
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center relative">
        <div className="relative z-10">
          <VerxioLoaderWhite size="md" />
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  if (isLoading || !profile || !referralStats || signupBonusEligibility === null) {
    return (
      <AppLayout currentPage="profile">
        <div className="w-full flex items-center justify-center min-h-[calc(100vh-200px)]">
          <div className="text-center">
            <VerxioLoaderWhite size="lg" />
            <p className="text-white mt-4 text-lg">Loading Profile...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <>
    <ToastContainer
        position="top-right"
        autoClose={3000}
        theme="dark"
      />
    <AppLayout currentPage="profile">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => router.back()}
            className="p-2 border border-white/20 rounded-lg hover:bg-white/10 transition-colors text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Profile</h1>
            <p className="text-gray-400">Manage your account settings</p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Profile Card */}
          <Card className="bg-gradient-to-br from-gray-900/90 via-black/80 to-gray-900/90 border border-white/10 text-white overflow-hidden relative">
            {/* Subtle background pattern */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/3 via-transparent to-purple-500/3 opacity-40"></div>
            
            <div className="relative z-10 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold text-white">Personal Information</h2>
                </div>
                {!isEditing ? (
                  <Button
                    onClick={() => setIsEditing(true)}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white transition-all duration-200 hover:scale-105 shadow-lg"
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                ) : null}
              </div>

            <div className="space-y-6">
              {/* Wallet Address (Read-only) */}
              <div className="space-y-3">
                <Label className="text-white/80 text-sm font-medium uppercase tracking-wider">Wallet Address</Label>
                <div className="p-3 bg-gradient-to-br from-white/8 to-white/3 rounded-lg border border-white/15 backdrop-blur-sm">
                  <p className="text-white font-mono text-sm">
                    {profile?.walletAddress ? 
                      `${profile.walletAddress.slice(0, 15)}...${profile.walletAddress.slice(-10)}` : 
                      'Not available'
                    }
                  </p>
                </div>
              </div>

              {/* Name */}
              <div className="space-y-3">
                <Label className="text-white/80 text-sm font-medium uppercase tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Name
                </Label>
                {isEditing ? (
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter your name"
                    className="bg-white/5 border border-white/15 text-white placeholder:text-white/40 rounded-lg h-12 px-4 focus:border-blue-500/50 focus:bg-white/8 transition-all duration-200"
                  />
                ) : (
                  <div className="p-3 bg-gradient-to-br from-white/8 to-white/3 rounded-lg border border-white/15 backdrop-blur-sm">
                    <p className="text-white">{profile?.name || 'No name added yet'}</p>
                  </div>
                )}
              </div>

              {/* Email */}
              <div className="space-y-3">
                <Label className="text-white/80 text-sm font-medium uppercase tracking-wider flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </Label>
                <div className="p-3 bg-gradient-to-br from-white/8 to-white/3 rounded-lg border border-white/15 backdrop-blur-sm">
                  <p className="text-white">{profile?.email || 'No email added yet'}</p>
                </div>
              </div>

              {/* Bio */}
              <div className="space-y-3">
                <Label className="text-white/80 text-sm font-medium uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Bio
                </Label>
                {isEditing ? (
                  <Textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Tell us about yourself..."
                    rows={4}
                    className="bg-white/5 border border-white/15 text-white placeholder:text-white/40 resize-none rounded-lg px-4 py-3 focus:border-blue-500/50 focus:bg-white/8 transition-all duration-200"
                  />
                ) : (
                  <div className="p-3 bg-gradient-to-br from-white/8 to-white/3 rounded-lg border border-white/15 backdrop-blur-sm">
                    <p className="text-white">{profile?.bio || 'No bio added yet'}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons - Only show when editing */}
            {isEditing && (
              <div className="flex gap-3 pt-6 border-t border-white/10">
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="flex-1 border-white/20 text-black hover:bg-white/10 hover:border-white/30 transition-all duration-200"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white transition-all duration-200 hover:scale-105 shadow-lg"
                >
                  {isSaving ? (
                    <VerxioLoaderWhite size="sm" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save
                </Button>
              </div>
            )}
            </div>
          </Card>

          {/* Referral Card */}
          <Card className="bg-gradient-to-br from-gray-900/90 via-black/80 to-gray-900/90 border border-white/10 text-white overflow-hidden relative">
            {/* Subtle background pattern */}
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/3 via-transparent to-blue-500/3 opacity-40"></div>
            
            <div className="relative z-10 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold text-white">Referral Program</h2>
                </div>
              </div>

            {/* Signup Bonus Claim Section - Only show if not already claimed */}
            {!signupBonusEligibility?.alreadyClaimed && (
              <div className="mb-6 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-white">Bonus Claim</h3>
                </div>
                
                <p className="text-white/70 text-sm mb-4">
                  Claim your 500 Verxio credits after depositing at least 5 USDC
                </p>

                <Button
                  onClick={handleClaimSignupBonus}
                  disabled={isClaimingBonus}
                  className="w-full bg-gradient-to-r from-[#0077b3] to-[#005a8c] hover:from-[#0066a0] hover:to-[#004d7a] text-white"
                >
                  {isClaimingBonus ? (
                    <VerxioLoaderWhite size="sm" />
                  ) : (
                    'Claim Bonus'
                  )}
                </Button>
              </div>
            )}

            <div className="space-y-6">
              {/* Referral Statistics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gradient-to-br from-white/8 to-white/3 rounded-lg border border-white/15 backdrop-blur-sm hover:border-white/25 transition-all duration-300 hover:scale-105">
                  <div className="text-2xl font-bold text-green-400 mb-1">
                    {referralStats?.referralCount || 0}
                  </div>
                  <div className="text-white/60 text-sm font-medium uppercase tracking-wider">Successful Referrals</div>
                </div>
                <div className="p-4 bg-gradient-to-br from-white/8 to-white/3 rounded-lg border border-white/15 backdrop-blur-sm hover:border-white/25 transition-all duration-300 hover:scale-105">
                  <div className="text-2xl font-bold text-yellow-400 mb-1">
                    {referralStats?.pendingReferralCount || 0}
                  </div>
                  <div className="text-white/60 text-sm font-medium uppercase tracking-wider">Pending Referrals</div>
                </div>
              </div>

              {/* Referral Link */}
              <div className="space-y-3">
                <Label className="text-white/80 text-sm font-medium uppercase tracking-wider">Referral Link</Label>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 p-3 bg-gradient-to-br from-white/8 to-white/3 rounded-lg border border-white/15 backdrop-blur-sm">
                    <p className="text-white font-mono text-xs truncate">
                      {typeof window !== 'undefined' && referralCode 
                        ? `${window.location.origin}/?ref=${referralCode}` 
                        : 'Generating referral code...'
                      }
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (referralCode) {
                        const referralUrl = `${window.location.origin}/?ref=${referralCode}`;
                        navigator.clipboard.writeText(referralUrl);
                        toast.success('Referral link copied!');
                      }
                    }}
                    className="p-3 bg-gradient-to-r from-white/10 to-white/5 hover:from-white/20 hover:to-white/10 rounded-lg transition-all duration-200 text-white disabled:opacity-50 hover:scale-105 border border-white/15"
                    disabled={!referralCode}
                    title={referralCode ? 'Copy referral link' : 'Generating referral code...'}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-white/50 text-xs font-medium">
                  Share this code with friends to earn 250 Verxio credits when they join and deposit at least $5.
                </p>
              </div>

              {/* Referral List */}
              {referralStats?.referralsGiven && referralStats.referralsGiven.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-white/70 text-sm">Your Referrals</Label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {getCurrentReferrals().map((referral: any) => (
                      <div key={referral.id} className="flex items-center justify-between p-3 bg-gradient-to-br from-white/8 to-white/3 rounded-lg border border-white/15 backdrop-blur-sm hover:border-white/25 transition-all duration-300 hover:scale-105">
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${
                            referral.status === 'SUCCESS' ? 'bg-green-400' : 'bg-yellow-400'
                          }`} />
                          <div>
                            <p className="text-white text-sm font-medium">
                              {referral.referredUser.email || referral.referredUser.walletAddress.slice(0, 6) + '...'}
                            </p>
                            <p className="text-white/60 text-xs font-medium uppercase tracking-wider">
                              {referral.status === 'SUCCESS' ? 'Deposited & Active' : 'Pending Deposit'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-white/60 text-xs font-medium">
                            {new Date(referral.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination Controls */}
                  {referralStats.referralsGiven.length > referralsPerPage && (
                    <div className="flex flex-col items-center pt-4 border-t border-white/20 space-y-3">
                      <div className="text-xs text-white/60 font-medium uppercase tracking-wider">
                        Page {currentReferralPage} of {Math.ceil(referralStats.referralsGiven.length / referralsPerPage)}
                      </div>
                      <div className="flex items-center space-x-4">
                        {currentReferralPage > 1 && (
                          <Button
                            onClick={() => goToReferralPage(currentReferralPage - 1)}
                            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white transition-all duration-200 hover:scale-105 shadow-lg"
                            size="sm"
                          >
                            Previous
                          </Button>
                        )}
                        {currentReferralPage < Math.ceil(referralStats.referralsGiven.length / referralsPerPage) && (
                          <Button
                            onClick={() => goToReferralPage(currentReferralPage + 1)}
                            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white transition-all duration-200 hover:scale-105 shadow-lg"
                            size="sm"
                          >
                            Next
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            </div>
          </Card>
        </motion.div>
      </div>

    </AppLayout>
    </>
  );
} 