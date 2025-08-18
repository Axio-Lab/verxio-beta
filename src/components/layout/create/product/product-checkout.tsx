"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Upload, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppButton } from "@/components/ui/app-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CloseButton } from "@/components/ui/close-button";
import { Switch } from "@/components/ui/switch";

interface ProductCheckoutCardProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const ProductCheckoutCard = ({ 
  isOpen = true, 
  onClose = () => {} 
}: ProductCheckoutCardProps) => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [amount, setAmount] = useState("");
  const [pointsPerPurchase, setPointsPerPurchase] = useState("100");
  const [isProduct, setIsProduct] = useState(true);
  const [quantity, setQuantity] = useState("");
  const [redirectLink, setRedirectLink] = useState("");
  const [enableReferral, setEnableReferral] = useState(false);
  const [referralPercentage, setReferralPercentage] = useState(50);
  const [showSuccess, setShowSuccess] = useState(false);
  const [countdown, setCountdown] = useState(5);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNext = () => {
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCreateProduct = () => {
    // Handle product creation
    console.log('Creating product:', {
      image: uploadedImage,
      productName,
      amount,
      pointsPerPurchase,
      isProduct,
      quantity,
      redirectLink,
      enableReferral,
      referralPercentage
    });
    
    // Show success modal
    setShowSuccess(true);
    
    // Start countdown
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/dashboard');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 1, scale: 1, y: 0 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ 
        duration: 0.2,
        ease: "easeOut"
      }}
      className="w-full max-w-md relative z-10"
    >
      <div className="bg-black border border-zinc-800 p-6 max-w-md w-full rounded-xl relative overflow-visible">
        <div className="relative">
          <CloseButton 
            onClick={handleClose}
            className="-top-5 -right-4"
          />
          
          <motion.div
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0, duration: 0.2, ease: "easeOut" }}
            className="mb-6 text-center"
          >
            <h2 className="text-2xl font-bold text-white mb-2">
              Create Asset
            </h2>
            <p className="text-zinc-400 text-sm">
              Step {currentStep} of 2
            </p>
          </motion.div>

          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label className="text-white text-base font-medium">Upload Media</Label>
                  <div className="border-2 border-dashed border-zinc-700 rounded-lg p-6 text-center hover:border-zinc-600 transition-colors">
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="media-upload"
                    />
                    <label htmlFor="media-upload" className="cursor-pointer">
                      {uploadedImage ? (
                        <div className="space-y-2">
                          <div className="w-full h-40 overflow-hidden rounded-lg">
                            <img 
                              src={uploadedImage} 
                              alt="Preview" 
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <p className="text-zinc-400 text-sm text-center">Click to change media</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="w-8 h-8 text-zinc-400 mx-auto" />
                          <p className="text-zinc-400 text-sm">Click to upload media</p>
                          <p className="text-zinc-500 text-xs">jpg, mp4, Max 1G</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="productName" className="text-white text-base font-medium">Title </Label>
                  <Input
                    id="productName"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="Enter product or service name"
                    className="bg-black/20 border-white/20 text-white placeholder:text-white/40"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-white text-base font-medium">Price</Label>
                  <div className="relative">
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="bg-black/20 border-white/20 text-white placeholder:text-white/40 pr-16"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-zinc-400">
                      USD
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pointsPerPurchase" className="text-white text-base font-medium">Points Per Purchase</Label>
                  <div className="relative">
                    <Input
                      id="pointsPerPurchase"
                      type="number"
                      value={pointsPerPurchase}
                      onChange={(e) => setPointsPerPurchase(e.target.value)}
                      placeholder="100"
                      className="bg-black/20 border-white/20 text-white placeholder:text-white/40 pr-24"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-zinc-400">
                      verxio points
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white text-base font-medium">Type</Label>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={isProduct}
                        onCheckedChange={setIsProduct}
                      />
                      <Label className="text-white text-sm">Product</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={!isProduct}
                        onCheckedChange={(checked) => setIsProduct(!checked)}
                      />
                      <Label className="text-white text-sm">Service</Label>
                    </div>
                  </div>
                </div>

                {isProduct && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="quantity" className="text-white text-base font-medium">Quantity Available</Label>
                      <div className="relative">
                        <Input
                          id="quantity"
                          type="number"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          placeholder="0"
                          className="bg-black/20 border-white/20 text-white placeholder:text-white/40 pr-16"
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-zinc-400">
                          units
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="redirectLink" className="text-white text-base font-medium">Redirect Link (Optional)</Label>
                      <Input
                        id="redirectLink"
                        value={redirectLink}
                        onChange={(e) => setRedirectLink(e.target.value)}
                        placeholder="https://example.com/product"
                        className="bg-black/20 border-white/20 text-white placeholder:text-white/40"
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label className="text-white text-base font-medium">Enable Referral Program</Label>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={enableReferral}
                      onCheckedChange={setEnableReferral}
                    />
                    <Label className="text-white text-sm">Allow referral sales</Label>
                  </div>
                </div>

                {enableReferral && (
                  <div className="space-y-2">
                    <Label className="text-white text-base font-medium">Referral Sale %</Label>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-zinc-400">
                        <span>5%</span>
                        <span>100%</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="100"
                        value={referralPercentage}
                        onChange={(e) => setReferralPercentage(parseInt(e.target.value))}
                        className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer slider"
                      />
                      <div className="text-center">
                        <span className="text-white text-sm">{referralPercentage}%</span>
                      </div>
                    </div>
                  </div>
                )}

                <AppButton 
                  onClick={handleNext}
                  disabled={!uploadedImage || !productName || !amount}
                  className="w-full bg-gradient-to-r from-[#0088c1] to-[#005a7a] hover:from-[#0077a8] hover:to-[#004d6b] text-white disabled:opacity-50 py-3 px-6 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl shadow-[#0088c1]/25 hover:shadow-[#0088c1]/40 transform hover:scale-105"
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </AppButton>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <p className="text-zinc-400 text-sm">Please review all details before creating</p>
                  </div>

                  <div className="space-y-3">
                    {uploadedImage && (
                      <div className="p-4 border border-zinc-700 rounded-lg overflow-hidden">
                        <img 
                          src={uploadedImage} 
                          alt="Product Preview" 
                          className="w-full h-32 object-cover rounded-lg"
                        />
                      </div>
                    )}
                    
                    <div className="p-4 border border-zinc-700 rounded-lg">
                      <h4 className="text-white font-medium mb-2">Product Details</h4>
                      <div className="space-y-1 text-sm">
                        <p className="text-zinc-400">Name: <span className="text-white">{productName}</span></p>
                        <p className="text-zinc-400">Type: <span className="text-white">{isProduct ? 'Product' : 'Service'}</span></p>
                        <p className="text-zinc-400">Price: <span className="text-white">${amount}</span></p>
                        <p className="text-zinc-400">Points: <span className="text-white">{pointsPerPurchase} verxio points</span></p>
                        {isProduct && quantity && (
                          <p className="text-zinc-400">Quantity: <span className="text-white">{quantity} units</span></p>
                        )}
                        {isProduct && redirectLink && (
                          <p className="text-zinc-400">Redirect: <span className="text-white">{redirectLink}</span></p>
                        )}
                      </div>
                    </div>

                    {enableReferral && (
                      <div className="p-4 border border-zinc-700 rounded-lg">
                        <h4 className="text-white font-medium mb-2">Referral Program</h4>
                        <div className="space-y-1 text-sm">
                          <p className="text-zinc-400">Referral Sale: <span className="text-white">{referralPercentage}%</span></p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <AppButton 
                    onClick={handleBack}
                    variant="secondary"
                    className="flex-1"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </AppButton>
                  <AppButton 
                    onClick={handleCreateProduct}
                    className="flex-1 bg-gradient-to-r from-[#0088c1] to-[#005a7a] hover:from-[#0077a8] hover:to-[#004d6b] text-white py-3 px-6 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl shadow-[#0088c1]/25 hover:shadow-[#0088c1]/40 transform hover:scale-105"
                  >
                    Create Product
                  </AppButton>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-black border border-zinc-800 p-8 max-w-md w-full mx-4 rounded-xl text-center"
            >
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Product Created</h3>
              <p className="text-white/80 mb-4">Your product has been successfully created.</p>
              <div className="pt-4">
                <p className="text-zinc-400 text-sm">
                  Redirecting to dashboard in {countdown} seconds...
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}; 