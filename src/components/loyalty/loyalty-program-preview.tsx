"use client";

import React from "react";
import { motion } from "framer-motion";

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

interface LoyaltyProgramPreviewProps {
  image?: string | null;
  loyaltyName: string;
  organizationName: string;
  tiers: LoyaltyTier[];
  pointActions: LoyaltyPointAction[];
  className?: string;
}

export function LoyaltyProgramPreview({ 
  image, 
  loyaltyName, 
  organizationName, 
  tiers, 
  pointActions,
  className = ""
}: LoyaltyProgramPreviewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-black border border-zinc-800 p-6 max-w-md w-full rounded-xl relative overflow-hidden ${className}`}
    >
      <div className="relative">

        <div className="space-y-4">
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-white">Program Overview</h3>
            <p className="text-zinc-400 text-sm">Complete program details</p>
          </div>

          <div className="space-y-3">
            {image && (
              <div className="p-4 border border-zinc-700 rounded-lg overflow-hidden">
                <img 
                  src={image} 
                  alt="Program Preview" 
                  className="w-full h-32 object-cover rounded-lg"
                />
              </div>
            )}
            
            <div className="p-4 border border-zinc-700 rounded-lg">
              <h4 className="text-white font-medium mb-2">Program Details</h4>
              <div className="space-y-1 text-sm">
                <p className="text-zinc-400">Name: <span className="text-white">{loyaltyName}</span></p>
                <p className="text-zinc-400">Organization: <span className="text-white">{organizationName}</span></p>
              </div>
            </div>

            <div className="p-4 border border-zinc-700 rounded-lg">
              <h4 className="text-white font-medium mb-2">Tiers</h4>
              <div className="space-y-2">
                {tiers.map((tier) => (
                  <div key={tier.id} className="flex justify-between text-sm">
                    <span className="text-zinc-400">{tier.name}</span>
                    <span className="text-white">{tier.xpRequired} XP → {tier.discountType === 'percentage' ? `${tier.discount}%` : `$${tier.discount}`} off</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border border-zinc-700 rounded-lg">
              <h4 className="text-white font-medium mb-2">Point Actions</h4>
              <div className="space-y-2">
                {pointActions.map((action) => (
                  <div key={action.id} className="flex justify-between text-sm">
                    <span className="text-zinc-400">{action.action}</span>
                    <span className="text-white">{action.points} verxio points</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
} 