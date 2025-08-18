"use client";

import React from "react";
import { motion } from "framer-motion";

interface ComingSoonProps {
  title?: string;
  description?: string;
  showBackButton?: boolean;
  onBack?: () => void;
}

export function ComingSoon({ 
  title = "Coming Soon", 
  description = "We're working hard to bring you something amazing. Stay tuned!",
  showBackButton = false,
  onBack,
}: ComingSoonProps) {

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4 ">

      {/* Back Button */}
      {showBackButton && onBack && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          onClick={onBack}
          className="absolute top-8 left-8 p-3 border border-white/20 rounded-lg hover:bg-white/10 transition-colors text-white"
        >
          ← Back
        </motion.button>
      )}

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="text-center max-w-2xl mx-auto"
      >
        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-4xl md:text-6xl font-bold text-white mb-6"
        >
          {title}
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-xl text-zinc-400 mb-8 leading-relaxed"
        >
          {description}
        </motion.p>
        
      </motion.div>
    </div>
  );
} 