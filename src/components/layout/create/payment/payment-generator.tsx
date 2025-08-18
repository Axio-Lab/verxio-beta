"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppButton } from "@/components/ui/app-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CloseButton } from "@/components/ui/close-button";
import { getUserLoyaltyPrograms, getLoyaltyProgramDetails } from "@/app/actions/loyalty";
import { usePrivy } from "@privy-io/react-auth";

interface LoyaltyProgram {
  id: string;
  name: string;
  programPublicKey?: string;
  programDetails?: any;
}

interface PaymentData {
  amount: string;
  loyaltyProgram?: LoyaltyProgram;
  message: string;
  memo: string;
  loyaltyDetails?: {
    loyaltyProgramAddress: string | null;
    loyaltyProgramName: string | null;
    loyaltyDiscount: string;
  } | null;
}

interface PaymentGeneratorProps {
  onGenerate: (data: PaymentData) => void;
  onClose: () => void;
}

export function PaymentGenerator({ onGenerate, onClose }: PaymentGeneratorProps) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [selectedLoyalty, setSelectedLoyalty] = useState<string>("");
  const [message, setMessage] = useState("Thank you for your purchase!");
  const [loyaltyPrograms, setLoyaltyPrograms] = useState<LoyaltyProgram[]>([]);
  const { user } = usePrivy();
  const [isLoading, setIsLoading] = useState(false);
  const [showTiersView, setShowTiersView] = useState(false);

  // Fetch user's loyalty programs on component mount
  useEffect(() => {
    const fetchLoyaltyPrograms = async () => {
      if (user?.wallet?.address) {
        setIsLoading(true);
        try {
          const result = await getUserLoyaltyPrograms(user.wallet.address);
          
          if (result.success && result.programs) {

            const uiPrograms: LoyaltyProgram[] = result.programs.map(program => ({
              id: program.id,
              name: `Loading...`,
              programPublicKey: program.programPublicKey
            }));
            
            setLoyaltyPrograms(uiPrograms);

            for (const program of result.programs) {
              try {
                const details = await getLoyaltyProgramDetails(program.creator, program.programPublicKey);
                if (details.success && details.programDetails) {
                  setLoyaltyPrograms(prev => prev.map(p => {
                    if (p.programPublicKey === program.programPublicKey) {
                      return {
                        ...p,
                        name: details.programDetails?.name,
                        programDetails: details.programDetails
                      };
                    }
                    return p;
                  }));
                }
              } catch (error) {
                console.error(`Error fetching details for program ${program.programPublicKey}:`, error);
              }
            }
          }
        } catch (error) {
          console.error('Error fetching loyalty programs:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchLoyaltyPrograms();
  }, [user?.wallet?.address]);

  const handleClose = () => {
    router.push('/create');
  };

  const handleGenerate = () => {
    const selectedProgram = loyaltyPrograms.find(p => p.id === selectedLoyalty);
    
    // Get loyalty program details for storage
    const loyaltyDetails = selectedProgram ? {
      loyaltyProgramAddress: selectedProgram.programDetails?.collectionAddress || null,
      loyaltyProgramName: selectedProgram.programDetails?.name || null,
      loyaltyDiscount: "0"
    } : null;

    onGenerate({
      amount,
      loyaltyProgram: selectedProgram,
      message,
      memo: message,
      loyaltyDetails
    });
  };

  const selectedProgram = loyaltyPrograms.find(p => p.id === selectedLoyalty);

  // If showing tiers view, render the tiers card
  if (showTiersView && selectedProgram) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-auto"
      >
        <div className="bg-black border border-zinc-800 p-4 max-w-md w-full rounded-xl relative overflow-visible">
          <div className="relative">
            <CloseButton onClick={() => setShowTiersView(false) } className="absolute -top-3 -right-2"/>

            <div className="text-center mb-4 pt-2">
              <h2 className="text-xl font-bold text-white mb-1">
                {selectedProgram.name}
              </h2>
              <p className="text-zinc-400 text-sm">
                Loyalty Program Tiers & Rewards
              </p>
            </div>

            {selectedProgram.programDetails?.tiers ? (
              <div className="space-y-3">
                {selectedProgram.programDetails.tiers.map((tier: any, index: number) => (
                  <div key={index} className="bg-gradient-to-br from-white/10 to-white/5 rounded-lg p-3 border border-white/20 hover:border-white/30 transition-all duration-300">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                          index === 0 ? 'bg-gradient-to-br from-amber-500 to-yellow-600' :
                          index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-600' :
                          'bg-gradient-to-br from-orange-500 to-red-600'
                        }`}>
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                        </div>
                        <div>
                          <h4 className="text-base font-semibold text-white">{tier.name}</h4>
                          <p className="text-white/60 text-xs">Tier {index + 1}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-blue-400">{tier.xpRequired}</div>
                        <div className="text-white/60 text-xs">XP</div>
                      </div>
                    </div>
                    
                    <div className="bg-white/10 rounded p-2">
                      <h5 className="text-white font-medium mb-1 text-xs">Rewards</h5>
                      <div className="flex flex-wrap gap-1">
                        {tier.rewards.map((reward: string, rewardIndex: number) => (
                          <span
                            key={rewardIndex}
                            className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 px-2 py-1 rounded text-xs font-medium border border-blue-400/30"
                          >
                            {reward}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl">🎯</span>
                </div>   
                <p className="text-white/60 text-base">No tier information available</p>
                <p className="text-white/40 text-sm mt-1">This program doesn't have tier data yet</p>
              </div>
            )}
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
      <div className="relative">
        <CloseButton onClick={handleClose} className="absolute -top-3 -right-2" />

        <div className="text-center mb-8 pt-4">
          <h2 className="text-2xl font-bold text-white mb-3">
            Generate Payment
          </h2>
          <p className="text-zinc-400 text-base">
            Payment link with native loyalty
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-white text-base font-medium">Amount</Label>
            <div className="relative">
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                placeholder="0.00"
                className="bg-black/20 border-white/20 text-white placeholder:text-white/40 h-12 text-base pr-16"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-zinc-400">
                USD
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-white text-base font-medium">Loyalty Program</Label>
            <Select value={selectedLoyalty} onValueChange={setSelectedLoyalty}>
              <SelectTrigger className="bg-black/20 border-white/20 text-white h-12 w-full">
                <SelectValue placeholder="Select loyalty program" />
              </SelectTrigger>
              <SelectContent className="bg-black/90 border-white/20 min-w-[150px]">
                {loyaltyPrograms.length > 0 ? (
                  loyaltyPrograms.map((program) => (
                    <SelectItem key={program.id} value={program.id} className="text-white">
                      {program.name}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-3 py-2 text-zinc-400  bg-black/90 border-white/20  text-sm">
                    No loyalty program found
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message" className="text-white text-base font-medium">Success Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
              placeholder="Thank you for your purchase!"
              className="bg-black/20 border-white/20 text-white placeholder:text-white/40 min-h-[80px]"
            />
          </div>

          <div className="space-y-4">
            <AppButton 
              onClick={handleGenerate} 
              disabled={!amount.trim()}
              className="w-full bg-gradient-to-r from-[#00adef] to-[#056f96] hover:from-[#0098d1] hover:to-[#0088c1] text-white disabled:opacity-50 py-3 px-6 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl shadow-[#00adef]/25 hover:shadow-[#00adef]/40 transform hover:scale-105"
            >
              <div className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4" />
                Continue
              </div>
            </AppButton>

            {selectedProgram && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <AppButton
                  variant="secondary"
                  onClick={() => setShowTiersView(true)}
                  className="w-full"
                >
                  <div className="flex items-center gap-2">
                    <span>View Loyalty Tiers</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </AppButton>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
} 