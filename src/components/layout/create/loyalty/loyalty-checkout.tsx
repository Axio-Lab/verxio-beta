"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Upload, Plus, Trash2, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppButton } from "@/components/ui/app-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomSelect } from "@/components/ui/custom-select";
import { CloseButton } from "@/components/ui/close-button";
import { VerxioLoaderWhite } from "@/components/ui/verxio-loader-white";
import { uploadFile } from "@/app/actions/files";
import { generateNftMetadata } from "@/lib/metadata/generateMetadata";
import { createLoyaltyProgram, initializeVerxio } from "@/app/actions/verxio";
import { usePrivy } from "@privy-io/react-auth";
import { generateSigner } from '@metaplex-foundation/umi'
import { useSolanaWallets, } from "@privy-io/react-auth/solana";
import { uint8ArrayToBase58String } from "@/lib/utils";
import { getVerxioConfig } from "@/app/actions/loyalty";
import { saveLoyaltyProgram } from "@/app/actions/loyalty";
import { getUserVerxioCreditBalance, awardOrRevokeLoyaltyPoints } from "@/app/actions/verxio-credit";

interface LoyaltyTier {
  id: string;
  name: string;
  xpRequired: number;
  discount: number;
  discountType: 'percentage' | 'dollar';
}

interface LoyaltyPointAction {
  id: string;
  action: string;
  points: number;
}

interface LoyaltyCheckoutCardProps {
  isOpen?: boolean;
  onClose?: () => void;
}



export const LoyaltyCheckoutCard = ({
  isOpen = true,
  onClose = () => { }
}: LoyaltyCheckoutCardProps) => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loyaltyName, setLoyaltyName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [tiers, setTiers] = useState<LoyaltyTier[]>([
    { id: '1', name: 'Bronze', xpRequired: 500, discount: 2, discountType: 'percentage' },
    { id: '2', name: 'Silver', xpRequired: 1000, discount: 5, discountType: 'percentage' },
    { id: '3', name: 'Gold', xpRequired: 2000, discount: 10, discountType: 'percentage' }
  ]);
  const [pointActions, setPointActions] = useState<LoyaltyPointAction[]>([
    { id: '1', action: 'Purchase', points: 100 }
  ]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const { user } = usePrivy();
  const userWallet = user?.wallet?.address!;
  const { wallets } = useSolanaWallets();
  const wallet = wallets[0];

  // Validate wallet and create signer
  if (!wallet || !userWallet) {
    console.error("Wallet not available");
    return null;
  }

  // Handle countdown and redirect
  React.useEffect(() => {
    if (showSuccess && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (showSuccess && countdown === 0) {
      // Redirect to dashboard when countdown reaches 0
      router.push('/dashboard');
    }
  }, [showSuccess, countdown, router]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Store the file for later upload
      setUploadedImageFile(file);

      // Show preview immediately
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);

    }
  };

  const addTier = () => {
    const newId = (tiers.length + 1).toString();
    setTiers([...tiers, {
      id: newId,
      name: `Tier ${newId}`,
      xpRequired: 0,
      discount: 0,
      discountType: 'percentage'
    }]);
  };

  const removeTier = (id: string) => {
    if (tiers.length > 1) {
      setTiers(tiers.filter(tier => tier.id !== id));
    }
  };

  const canRemoveTier = (tier: LoyaltyTier) => {
    // Must have at least 1 tier
    if (tiers.length <= 1) return false;
    return true;
  };

  const updateTier = (id: string, field: keyof LoyaltyTier, value: any) => {
    const updatedTiers = tiers.map(tier =>
      tier.id === id ? { ...tier, [field]: value } : tier
    );
    setTiers(updatedTiers);
  };

  const addPointAction = () => {
    const newId = (pointActions.length + 1).toString();
    setPointActions([...pointActions, {
      id: newId,
      action: '',
      points: 0
    }]);
  };

  const removePointAction = (id: string) => {
    if (pointActions.length > 1) {
      setPointActions(pointActions.filter(action => action.id !== id));
    }
  };

  const canRemovePointAction = (action: LoyaltyPointAction) => {
    // Cannot remove Purchase action
    if (action.action === 'Purchase') return false;
    // Must have at least 1 action
    if (pointActions.length <= 1) return false;
    return true;
  };

  const updatePointAction = (id: string, field: keyof LoyaltyPointAction, value: any) => {
    const updatedActions = pointActions.map(action =>
      action.id === id ? { ...action, [field]: value } : action
    );
    setPointActions(updatedActions);
    console.log('Point Action updated:', { id, field, value, allActions: updatedActions });
  };

  const handleNext = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentStep(currentStep + 1);
      setIsTransitioning(false);
    }, 300);
  };

  const handleBack = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentStep(currentStep - 1);
      setIsTransitioning(false);
    }, 300);
  };

  const handleSubmit = async () => {
    if (!wallet || !userWallet) {
      setError('Wallet not available. Please connect your wallet first.');
      return;
    }

    try {
      setIsCreating(true);
      setError(null);

      // Check if user has sufficient Verxio credits (minimum 5000 required)
      const creditCheck = await getUserVerxioCreditBalance(userWallet);
      if (!creditCheck.success || (creditCheck.balance || 0) < 5000) {
        setError(`Insufficient Verxio credits. You need at least 5000 credits to create a loyalty program. Current balance: ${creditCheck.balance || 0} credits.`);
        setIsCreating(false);
        return;
      }

      // Upload image to Pinata only when submitting
      let finalImageUrl: string | null = null;
      if (uploadedImageFile) {
        const formData = new FormData();
        formData.append('file', uploadedImageFile);
        const result = await uploadFile(formData);
        finalImageUrl = result.url;
      }

      // Generate metadata
      const metadataInput = {
        loyaltyProgramName: loyaltyName,
        metadata: {
          organizationName: organizationName,
          brandColor: '#00adef', // Default brand color
        },
        tiers: tiers.map(tier => ({
          name: tier.name,
          xpRequired: tier.xpRequired,
          rewards: [`${tier.discountType === 'percentage' ? tier.discount + '%' : '$' + tier.discount} discount`]
        })),
        pointsPerAction: pointActions.reduce((acc, action) => {
          acc[action.action.toLowerCase()] = action.points;
          return acc;
        }, {} as Record<string, number>)
      };

      // Generate NFT metadata
      let metadataUri: string | null = null;
      if (finalImageUrl) {
        try {
          const metadataResult = await generateNftMetadata(metadataInput, finalImageUrl, userWallet, 'image/png');
          metadataUri = metadataResult.uri;
          if (metadataUri) {
            try {
              const config = await getVerxioConfig();
              const initializeContext = await initializeVerxio(userWallet, config.rpcEndpoint, config.privateKey!);
              if (!initializeContext.success || !initializeContext.context) {
                console.error('Initialization failed:', initializeContext.error);
                setError(`Initialization failed: ${initializeContext.error}`);
                return;
              }

              const createResult = await createLoyaltyProgram(initializeContext.context, {
                loyaltyProgramName: loyaltyName,
                metadataUri: metadataUri,
                updateAuthority: generateSigner(initializeContext.context.umi),
                metadata: {
                  organizationName: organizationName,
                  brandColor: '#00adef',
                },
                tiers: tiers.map(tier => ({
                  name: tier.name,
                  xpRequired: tier.xpRequired,
                  rewards: [`${tier.discountType === 'percentage' ? `${tier.discount}% discount` : `$${tier.discount} discount`}`]
                })),
                pointsPerAction: pointActions.reduce((acc, action) => {
                  acc[action.action.toLowerCase()] = action.points;
                  return acc;
                }, {} as Record<string, number>)
              });

              if (createResult.success) {
                const programPublicKey = createResult.result?.collection.publicKey;
                const programSecretKey = uint8ArrayToBase58String(createResult.result?.collection.secretKey!);
                const signature = createResult.result?.signature;
                const authorityPublicKey = createResult.result?.updateAuthority?.publicKey;
                const authoritySecretKey = uint8ArrayToBase58String(createResult.result?.updateAuthority?.secretKey!);

                // Save to database
                try {
                  await saveLoyaltyProgram({
                    creator: userWallet,
                    programPublicKey: programPublicKey!,
                    programSecretKey: programSecretKey!,
                    signature: signature!,
                    authorityPublicKey: authorityPublicKey!,
                    authoritySecretKey: authoritySecretKey!,
                  });

                  // Deduct 1000 Verxio credits for program creation
                  const deductionResult = await awardOrRevokeLoyaltyPoints({
                    creatorAddress: userWallet,
                    points: 1000,
                    assetAddress: programPublicKey!,
                    assetOwner: userWallet,
                    action: 'REVOKE'
                  });

                  if (!deductionResult.success) {
                    console.error('Failed to deduct Verxio credits:', deductionResult.error);
                    // Don't fail the entire process, just log the error
                  }
                } catch (error) {
                  console.error('Error saving loyalty program to database:', error);
                }

                // Only show success and redirect if everything worked
                setIsTransitioning(true);
                setTimeout(() => {
                  setShowSuccess(true);
                  setIsTransitioning(false);
                }, 300);
              } else {
                console.error('Loyalty program creation failed:', createResult.error);
                setError(`${createResult.error}`);
              }
            } catch (error) {
              console.error('Failed to create loyalty program on blockchain:', error);
              setError(`${error}`);
            }
          } else {
            setError('Failed to generate metadata');
          }
        } catch (error) {
          console.error('Failed to generate metadata:', error);
          setError(`${error}`);
        }
      } else {
        setError('Please upload an image first');
      }
    } catch (error) {
      console.error(error);
      setError(`${error}`);
    } finally {
      setIsCreating(false);
    }
  };

  if (isTransitioning) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-auto"
      >
        <div className="bg-black border border-zinc-800 p-6 max-w-md w-full rounded-xl relative overflow-visible">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <VerxioLoaderWhite size="md" />
              <p className="text-white mt-4 text-lg">Loading...</p>
              <p className="text-zinc-400 text-sm mt-2">Please wait while we prepare the next step</p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (showSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-auto"
      >
        <div className="bg-black border border-zinc-800 p-6 max-w-md w-full rounded-xl relative overflow-visible">
          <div className="relative">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">Loyalty Program Created</h3>
              <p className="text-white/80">Your loyalty program has been successfully created</p>

              <div className="pt-4 space-y-3">
                <p className="text-zinc-400 text-sm">Redirecting to dashboard in {countdown} seconds...</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="bg-black border border-zinc-800 p-6 max-w-md w-full rounded-xl relative overflow-visible">
        <div className="relative">
          <CloseButton onClick={onClose} className="absolute -top-4 -right-4"  />

          <div className="text-center mb-8 pt-4">
            <h2 className="text-2xl font-bold text-white mb-3">
              Create Loyalty Program
            </h2>
            <p className="text-zinc-400 text-base">
              Build customer loyalty with points and rewards
            </p>
          </div>

          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-white text-base font-medium">Upload Image</Label>
                    <div className="border-2 border-dashed border-zinc-700 rounded-lg p-6 text-center hover:border-zinc-600 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="image-upload"
                      />
                      <label htmlFor="image-upload" className="cursor-pointer">
                        {uploadedImage ? (
                          <div className="space-y-2">
                            <div className="w-full h-40 overflow-hidden rounded-lg relative">
                              <img
                                src={uploadedImage}
                                alt="Preview"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <p className="text-zinc-400 text-sm text-center">Click to change image</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Upload className="w-8 h-8 text-zinc-400 mx-auto" />
                            <p className="text-zinc-400 text-sm">Click to upload image</p>
                            <p className="text-zinc-500 text-xs">Recommended size: 500x500px</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="loyaltyName" className="text-white text-base font-medium">Loyalty Program Name</Label>
                    <Input
                      id="loyaltyName"
                      value={loyaltyName}
                      onChange={(e) => setLoyaltyName(e.target.value)}
                      placeholder="Enter program name"
                      className="bg-black/20 border-white/20 text-white placeholder:text-white/40 h-12 text-base"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="organizationName" className="text-white text-base font-medium">Organization Name</Label>
                    <Input
                      id="organizationName"
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      placeholder="Enter organization name"
                      className="bg-black/20 border-white/20 text-white placeholder:text-white/40 h-12 text-base"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <AppButton
                    onClick={handleNext}
                    disabled={!uploadedImage || !uploadedImageFile || !loyaltyName.trim() || !organizationName.trim()}
                    className="flex-1 bg-gradient-to-r from-[#00adef] to-[#056f96] hover:from-[#0098d1] hover:to-[#0088c1] text-white disabled:opacity-50 py-3 px-6 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl shadow-[#00adef]/25 hover:shadow-[#00adef]/40 transform hover:scale-105"
                  >
                    <div className="flex items-center gap-2 justify-center">
                      <span>Next</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </AppButton>
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-white text-base font-medium">Loyalty Tiers</Label>
                    <button
                      onClick={addTier}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4 text-white" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {tiers.map((tier, index) => (
                      <div key={tier.id} className="p-4 bg-black/20 rounded-lg border border-white/10">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-white font-medium">Tier {index + 1}</span>
                          {canRemoveTier(tier) && (
                            <button
                              onClick={() => removeTier(tier.id)}
                              className="p-1 bg-red-500/20 hover:bg-red-500/30 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-white text-sm">Name</Label>
                            <Input
                              value={tier.name}
                              onChange={(e) => updateTier(tier.id, 'name', e.target.value)}
                              className="bg-black/20 border-white/20 text-white h-10 text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white text-sm">XP Required</Label>
                            <Input
                              type="number"
                              value={tier.xpRequired}
                              onChange={(e) => updateTier(tier.id, 'xpRequired', parseInt(e.target.value))}
                              className="bg-black/20 border-white/20 text-white h-10 text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white text-sm">Discount</Label>
                            <Input
                              type="number"
                              value={tier.discount}
                              onChange={(e) => updateTier(tier.id, 'discount', parseInt(e.target.value))}
                              className="bg-black/20 border-white/20 text-white h-10 text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white text-sm">Type</Label>
                            <CustomSelect
                              value={tier.discountType}
                              onChange={(value: string) => updateTier(tier.id, 'discountType', value)}
                              options={[
                                { value: 'percentage', label: 'Percentage' },
                                { value: 'dollar', label: 'Dollar' }
                              ]}
                              className="bg-black/20 border-white/20 text-white h-10 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <AppButton
                    variant="secondary"
                    onClick={handleBack}
                    className="flex-1"
                  >
                    <div className="flex items-center gap-2 justify-center">
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back</span>
                    </div>
                  </AppButton>
                  <AppButton
                    onClick={handleNext}
                    className="flex-1 bg-gradient-to-r from-[#00adef] to-[#056f96] hover:from-[#0098d1] hover:to-[#0088c1] text-white py-3 px-6 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl shadow-[#00adef]/25 hover:shadow-[#00adef]/40 transform hover:scale-105"
                  >
                    <div className="flex items-center gap-2 justify-center">
                      <span>Next</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </AppButton>
                </div>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-white text-base font-medium">Point Actions</Label>
                    <button
                      onClick={addPointAction}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4 text-white" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {pointActions.map((action, index) => (
                      <div key={action.id} className="p-4 bg-black/20 rounded-lg border border-white/10">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-white font-medium">Action {index + 1}</span>
                          {canRemovePointAction(action) && (
                            <button
                              onClick={() => removePointAction(action.id)}
                              className="p-1 bg-red-500/20 hover:bg-red-500/30 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-white text-sm">Action</Label>
                            <Input
                              value={action.action}
                              onChange={(e) => updatePointAction(action.id, 'action', e.target.value)}
                              placeholder="e.g., Referral, Signup"
                              disabled={action.action === 'Purchase'}
                              className={`bg-black/20 border-white/20 text-white h-10 text-sm ${
                                action.action === 'Purchase' ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white text-sm">Points</Label>
                            <Input
                              type="number"
                              value={action.points}
                              onChange={(e) => updatePointAction(action.id, 'points', parseInt(e.target.value))}
                              className="bg-black/20 border-white/20 text-white h-10 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Error Display */}
                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-red-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-medium">{error}</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <AppButton
                    variant="secondary"
                    onClick={handleBack}
                    className="flex-1"
                  >
                    <div className="flex items-center gap-2 justify-center">
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back</span>
                    </div>
                  </AppButton>
                  <AppButton
                    onClick={handleSubmit}
                    disabled={isCreating || tiers.length === 0 || pointActions.length === 0}
                    className="flex-1 bg-gradient-to-r from-[#00adef] to-[#056f96] hover:from-[#0098d1] hover:to-[#0088d1] text-white py-3 px-6 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl shadow-[#00adef]/25 hover:shadow-[#00adef]/40 transform hover:scale-105 disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2 justify-center">
                      {isCreating ? (
                        <>
                          <VerxioLoaderWhite size="sm" />
                          <span>Creating Program...</span>
                        </>
                      ) : (
                        <>
                          <span>Create Program</span>
                          <Check className="w-4 h-4" />
                        </>
                      )}
                    </div>
                  </AppButton>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step Indicator */}
          <div className="flex justify-center mt-8">
            <div className="flex space-x-2">
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className={`w-3 h-3 rounded-full ${step === currentStep ? 'bg-[#00adef]' : 'bg-white/20'
                    }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
} 