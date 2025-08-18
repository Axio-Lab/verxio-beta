"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckSquare, Package, Gift, X, CreditCard } from "lucide-react";
import { useRouter } from "next/navigation";

interface CheckoutOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  gradient: string;
}

interface CreateCheckoutCardProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSelect?: (option: string) => void;
}

const GlowingStarsBackgroundCard = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => {
  const [mouseEnter, setMouseEnter] = useState(false);

  return (
    <div
      onMouseEnter={() => {
        setMouseEnter(true);
      }}
      onMouseLeave={() => {
        setMouseEnter(false);
      }}
      className={`bg-black border border-zinc-800 p-6 max-w-md w-full rounded-xl relative overflow-hidden ${className}`}
    >
      <div className="flex justify-center items-center">
        <Illustration mouseEnter={mouseEnter} />
      </div>
      <div className="relative z-20">{children}</div>
    </div>
  );
};

const Illustration = ({ mouseEnter }: { mouseEnter: boolean }) => {
  const stars = 108;
  const columns = 18;

  const [glowingStars, setGlowingStars] = useState<number[]>([]);

  const highlightedStars = useRef<number[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      highlightedStars.current = Array.from({ length: 5 }, () =>
        Math.floor(Math.random() * stars)
      );
      setGlowingStars([...highlightedStars.current]);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="h-32 p-1 w-full absolute inset-0 z-0"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: `1px`,
      }}
    >
      {[...Array(stars)].map((_, starIdx) => {
        const isGlowing = glowingStars.includes(starIdx);
        const delay = (starIdx % 10) * 0.1;
        const staticDelay = starIdx * 0.01;
        return (
          <div
            key={`matrix-col-${starIdx}}`}
            className="relative flex items-center justify-center"
          >
            <Star
              isGlowing={mouseEnter ? true : isGlowing}
              delay={mouseEnter ? staticDelay : delay}
            />
            {mouseEnter && <Glow delay={staticDelay} />}
            <AnimatePresence mode="wait">
              {isGlowing && <Glow delay={delay} />}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};

const Star = ({ isGlowing, delay }: { isGlowing: boolean; delay: number }) => {
  return (
    <motion.div
      key={delay}
      initial={{
        scale: 1,
      }}
      animate={{
        scale: isGlowing ? [1, 1.2, 2.5, 2.2, 1.5] : 1,
        background: isGlowing ? "#fff" : "#666",
      }}
      transition={{
        duration: 2,
        ease: "easeInOut",
        delay: delay,
      }}
      className="bg-zinc-600 h-[1px] w-[1px] rounded-full relative z-20"
    />
  );
};

const Glow = ({ delay }: { delay: number }) => {
  return (
    <motion.div
      initial={{
        opacity: 0,
      }}
      animate={{
        opacity: 1,
      }}
      transition={{
        duration: 2,
        ease: "easeInOut",
        delay: delay,
      }}
      exit={{
        opacity: 0,
      }}
      className="absolute left-1/2 -translate-x-1/2 z-10 h-[4px] w-[4px] rounded-full bg-blue-500 blur-[1px] shadow-2xl shadow-blue-400"
    />
  );
};

const CheckoutOptionCard = ({ 
  option, 
  index, 
  onSelect 
}: { 
  option: CheckoutOption; 
  index: number; 
  onSelect: (id: string) => void;
}) => {
  return (
    <motion.div
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.2, 
        delay: index * 0.02,
        ease: "easeOut"
      }}
      whileHover={{ 
        scale: 1.02, 
        y: -3,
        transition: { duration: 0.2 }
      }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(option.id)}
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 backdrop-blur-sm transition-all duration-300 hover:border-zinc-700 hover:bg-zinc-800/50"
    >
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 ${option.gradient}`} />
      
      <div className="relative z-10 flex items-center space-x-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${option.color} text-white transition-transform duration-300 group-hover:scale-110`}>
          {option.icon}
        </div>
        
        <div className="flex-1">
          <h3 className="font-semibold text-white group-hover:text-zinc-100 transition-colors duration-300">
            {option.title}
          </h3>
          <p className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors duration-300">
            {option.description}
          </p>
        </div>
        
        <motion.div
          initial={{ x: -10, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 + index * 0.1 }}
          className="text-zinc-500 group-hover:text-zinc-300 transition-colors duration-300"
        >
          →
        </motion.div>
      </div>
    </motion.div>
  );
};

export const CreateCheckoutCard = ({ 
  isOpen = true, 
  onClose = () => {}, 
  onSelect = () => {} 
}: CreateCheckoutCardProps) => {
  const router = useRouter();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  
  const checkoutOptions: CheckoutOption[] = [
    {
      id: "payment",
      title: "Payment Checkout",
      description: "Accept payments and process transactions",
      icon: <CreditCard size={20} />,
      color: "bg-blue-600",
      gradient: "bg-gradient-to-br from-blue-600 to-blue-800"
    },
    {
      id: "task",
      title: "Task Checkout", 
      description: "Manage tasks and workflow completion",
      icon: <CheckSquare size={20} />,
      color: "bg-green-600",
      gradient: "bg-gradient-to-br from-green-600 to-green-800"
    },
    {
      id: "product",
      title: "Product Checkout",
      description: "Sell products/services and manage inventory",
      icon: <Package size={20} />,
      color: "bg-purple-600", 
      gradient: "bg-gradient-to-br from-purple-600 to-purple-800"
    },
    {
      id: "loyalty",
      title: "Loyalty Checkout",
      description: "Reward customers and build loyalty",
      icon: <Gift size={20} />,
      color: "bg-orange-600",
      gradient: "bg-gradient-to-r from-orange-600 to-orange-800"
    }
  ];

  const handleSelect = (optionId: string) => {
    setSelectedOption(optionId);
    onSelect(optionId);
    
    if (optionId === "payment") {
      router.push('/create/payment');
    } else if (optionId === "loyalty") {
      router.push('/create/loyalty');
    } else if (optionId === "task") {
      router.push('/create/task');
    } else if (optionId === "product") {
      router.push('/create/product');
    }
  };

  const handleClose = () => {
    router.push('/dashboard');
    setSelectedOption(null);
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
      className="w-full max-w-md"
    >
      <GlowingStarsBackgroundCard>
        <div className="relative">
          <button
            onClick={handleClose}
            className="absolute -top-2 -right-2 z-30 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors duration-200"
          >
            <X size={16} />
          </button>
          
          <motion.div
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0, duration: 0.2, ease: "easeOut" }}
            className="mb-6 text-center"
          >
            <h2 className="text-2xl font-bold text-white mb-2">
              Create Checkout
            </h2>
            <p className="text-zinc-400 text-sm">
            Choose your checkout type to get started
            </p>
          </motion.div>

          <div className="space-y-3">
            {checkoutOptions.map((option, index) => (
              <CheckoutOptionCard
                key={option.id}
                option={option}
                index={index}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </div>
      </GlowingStarsBackgroundCard>
    </motion.div>
  );
};


