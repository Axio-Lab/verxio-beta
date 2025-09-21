"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Upload, Plus, Trash2, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppButton } from "@/components/ui/app-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomSelect } from "@/components/ui/custom-select";
import { CloseButton } from "@/components/ui/close-button";
import { VerxioLoaderWhite } from "@/components/ui/verxio-loader-white";
import { createVoucherCollection } from "@/app/actions/voucher";
import { generateImageUri } from "@/lib/metadata/generateImageURI";
import { storeMetadata } from "@/app/actions/metadata";
import { usePrivy } from "@privy-io/react-auth";
import { useSolanaWallets } from "@privy-io/react-auth/solana";
import { getUserVerxioCreditBalance } from "@/app/actions/verxio-credit";

interface VoucherType {
  id: string;
  type: string;
  customValue?: string; // For custom reward type
}

interface VoucherCheckoutCardProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const VoucherCheckoutCard = ({
  isOpen = true,
  onClose = () => { }
}: VoucherCheckoutCardProps) => {
  const router = useRouter();
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [voucherCollectionName, setVoucherCollectionName] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [description, setDescription] = useState("");
  const [voucherTypes, setVoucherTypes] = useState<VoucherType[]>([
    { id: '1', type: 'Free Item' },
  ]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const { user } = usePrivy();
  const userWallet = user?.wallet?.address!;
  const { wallets } = useSolanaWallets();
  const wallet = wallets[0];

  // // Validate wallet
  // if (!wallet || !userWallet) {
  //   console.error("Wallet not available");
  //   return null;
  // }

  // Handle countdown and redirect
  React.useEffect(() => {
    if (showSuccess && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (showSuccess && countdown === 0) {
      router.push('/dashboard');
    }
  }, [showSuccess, countdown, router]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const addVoucherType = () => {
    const newId = (voucherTypes.length + 1).toString();
    setVoucherTypes([...voucherTypes, {
      id: newId,
      type: 'Free Item'
    }]);
  };

  const removeVoucherType = (id: string) => {
    if (voucherTypes.length > 1) {
      setVoucherTypes(voucherTypes.filter(type => type.id !== id));
    }
  };

  const canRemoveVoucherType = (type: VoucherType) => {
    // Cannot remove default types
    if (type.type === 'Free Item') return false;
    // Must have at least 1 type
    if (voucherTypes.length <= 1) return false;
    return true;
  };

  const updateVoucherType = (id: string, field: keyof VoucherType, value: any) => {
    const updatedTypes = voucherTypes.map(type =>
      type.id === id ? { ...type, [field]: value } : type
    );
    setVoucherTypes(updatedTypes);
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
        setError(`Insufficient Verxio credits. You need at least 5000 credits to create a voucher collection. Current balance: ${creditCheck.balance || 0} credits.`);
        setIsCreating(false);
        return;
      }

      // Upload image to IPFS and generate metadata
      let finalImageUrl: string | null = null;
      let metadataUri: string | null = null;
      
      if (uploadedImageFile) {
        // Upload image to IPFS
        const imageUri = await generateImageUri(uploadedImageFile);
        finalImageUrl = imageUri;
        
        // Generate voucher metadata
        const metadata = {
          name: voucherCollectionName,
          symbol: 'VERXIO-VOUCHER',
          description: description || `Voucher collection for ${merchantName}`,
          image: imageUri,
          properties: {
            files: [
              {
                uri: imageUri,
                type: uploadedImageFile.type || 'image/png',
              },
            ],
            category: 'image',
            creators: [
              {
                address: userWallet,
                share: 100,
              },
            ],
          },
          attributes: [
            {
              trait_type: 'Merchant',
              value: merchantName,
            },
            {
              trait_type: 'Collection Type',
              value: 'Voucher Collection',
            },
            {
              trait_type: 'Status',
              value: 'Active',
            },
            {
              trait_type: 'Voucher Types',
              value: voucherTypes.map(type => type.type).filter(Boolean).join(', '),
            },
          ],
        };

        // Store metadata to IPFS
        metadataUri = await storeMetadata(metadata);
      }

      // Create voucher collection
      const voucherCollectionData = {
        creatorAddress: userWallet,
        voucherCollectionName,
        merchantName,
        merchantAddress: userWallet,
        contactInfo: undefined,
        voucherTypes: voucherTypes.map(type => {
          if (type.type === 'Custom Reward' && type.customValue) {
            return `${type.customValue}`;
          }
          return type.type;
        }).filter(Boolean),
        description:  undefined,
        imageUri: finalImageUrl || undefined,
        metadataUri: metadataUri || undefined
      };

      const createResult = await createVoucherCollection(voucherCollectionData);

      if (createResult.success) {
        setShowSuccess(true);
      } else {
        setError(createResult.error || 'Failed to create voucher collection');
      }
    } catch (error) {
      console.error(error);
      setError(`${error}`);
    } finally {
      setIsCreating(false);
    }
  };


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
              <h3 className="text-xl font-bold text-white">Voucher Collection Created</h3>
              <p className="text-white/80">Your voucher collection has been successfully created</p>

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
      <div className="bg-black border border-zinc-800 p-6 max-w-md w-full rounded-xl relative overflow-visible z-10">
        <div className="relative">
          <CloseButton onClick={onClose} className="absolute -top-4 -right-4" />

          <div className="text-center mb-8 pt-4">
            <h2 className="text-2xl font-bold text-white mb-3">
              Create Voucher Collection
            </h2>
            <p className="text-zinc-400 text-base">
              Create and manage phygital coupons and vouchers for your business
            </p>
          </div>

          <div className="space-y-6">
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
                <Label htmlFor="voucherCollectionName" className="text-white text-base font-medium">Voucher Collection Name</Label>
                <Input
                  id="voucherCollectionName"
                  value={voucherCollectionName}
                  onChange={(e) => setVoucherCollectionName(e.target.value)}
                  placeholder="Enter collection name"
                  maxLength={25}
                  className="bg-black/20 border-white/20 text-white placeholder:text-white/40 h-12 text-base"
                />
                <div className="text-xs text-white/60 text-right">
                  {voucherCollectionName.length}/25 characters
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="merchantName" className="text-white text-base font-medium">Merchant Name</Label>
                <Input
                  id="merchantName"
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                  placeholder="Enter merchant name"
                  maxLength={15}
                  className="bg-black/20 border-white/20 text-white placeholder:text-white/40 h-12 text-base"
                />
                <div className="text-xs text-white/60 text-right">
                  {merchantName.length}/15 characters
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactInfo" className="text-white text-base font-medium">Contact Information (Optional)</Label>
                <Input
                  id="contactInfo"
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  placeholder="Enter contact information"
                  className="bg-black/20 border-white/20 text-white placeholder:text-white/40 h-12 text-base"
                />
              </div>


              <div className="flex items-center justify-between">
                <Label className="text-white text-base font-medium">Voucher Types</Label>
                <button
                  onClick={addVoucherType}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4 text-white" />
                </button>
              </div>

              <div className="space-y-3">
                {voucherTypes.map((type, index) => (
                  <div key={type.id} className="p-4 bg-black/20 rounded-lg border border-white/10 relative z-20">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white font-medium">Type {index + 1}</span>
                      {canRemoveVoucherType(type) && (
                        <button
                          onClick={() => removeVoucherType(type.id)}
                          className="p-1 bg-red-500/20 hover:bg-red-500/30 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-white text-sm">Type</Label>
                        <CustomSelect
                          value={type.type}
                          onChange={(value: string) => updateVoucherType(type.id, 'type', value)}
                          options={[
                            { value: 'Percentage Off', label: 'Percentage Off' },
                            { value: 'Free Item', label: 'Free Item' },
                            { value: 'Buy One Get One', label: 'Buy One Get One' },
                            { value: 'Custom Reward', label: 'Custom Reward' }
                          ]}
                          className="bg-black/20 border-white/20 text-white h-10 text-sm relative z-50"
                        />
                      </div>
                      {type.type === 'Custom Reward' && (
                        <div className="space-y-2">
                          <Label className="text-white text-sm">Custom Reward Description</Label>
                          <Input
                            value={type.customValue || ''}
                            onChange={(e) => updateVoucherType(type.id, 'customValue', e.target.value)}
                            placeholder="Describe your custom reward"
                            className="bg-black/20 border-white/20 text-white h-10 text-sm"
                          />
                        </div>
                      )}
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

            <AppButton
              onClick={handleSubmit}
              disabled={isCreating || !uploadedImage || !uploadedImageFile || !voucherCollectionName.trim() || !merchantName.trim() || voucherTypes.length === 0}
              className="w-full bg-gradient-to-r from-[#00adef] to-[#056f96] hover:from-[#0098d1] hover:to-[#0088d1] text-white py-3 px-6 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl shadow-[#00adef]/25 hover:shadow-[#00adef]/40 transform hover:scale-105 disabled:opacity-50"
            >
              <div className="flex items-center gap-2 justify-center">
                {isCreating ? (
                  <>
                    <VerxioLoaderWhite size="sm" />
                    <span>Creating Collection...</span>
                  </>
                ) : (
                  <>
                    <span>Create Collection</span>
                    <Check className="w-4 h-4" />
                  </>
                )}
              </div>
            </AppButton>
          </div>

        </div>
      </div>
    </motion.div>
  );
}
