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
      className={`bg-gradient-to-br from-gray-900/90 via-black/80 to-gray-900/90 border border-white/10 p-6 max-w-md w-full rounded-xl relative overflow-hidden shadow-2xl ${className}`}
    >
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/3 via-transparent to-purple-500/3 opacity-40"></div>

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
  const isDisabled = false;
  // option.id === "task" || option.id === "product";

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
        scale: isDisabled ? 1 : 1.02,
        y: isDisabled ? 0 : -3,
        transition: { duration: 0.2 }
      }}
      whileTap={{ scale: isDisabled ? 1 : 0.98 }}
      onClick={() => !isDisabled && onSelect(option.id)}
      className={`group relative overflow-hidden rounded-xl border p-4 backdrop-blur-sm transition-all duration-300 ${isDisabled
          ? 'border-white/20 bg-white/5 cursor-not-allowed opacity-60'
          : 'border-white/15 bg-white/8 cursor-pointer hover:border-white/25 hover:bg-white/10 hover:shadow-lg'
        }`}
    >
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 ${option.gradient}`} />

      <div className="relative z-10 flex items-center space-x-3">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${option.color} text-white transition-all duration-300 ${!isDisabled ? 'group-hover:scale-110 group-hover:shadow-lg' : ''} shadow-md`}>
          {option.icon}
        </div>

        {/* Coming Soon Badge for disabled options */}
        {isDisabled && (
          <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full font-bold shadow-lg z-20">
            Coming Soon
          </div>
        )}

        <div className="flex-1 space-y-1">
          <h3 className={`font-semibold text-base transition-colors duration-300 ${isDisabled ? 'text-white/60' : 'text-white group-hover:text-white/90'
            }`}>
            {option.title}
          </h3>
          <p className={`text-sm transition-colors duration-300 leading-relaxed ${isDisabled ? 'text-white/40' : 'text-white/60 group-hover:text-white/70'
            }`}>
            {option.description}
          </p>
        </div>

        <motion.div
          initial={{ x: -10, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 + index * 0.1 }}
          className={`text-xl transition-all duration-300 ${isDisabled ? 'text-white/30' : 'text-white/50 group-hover:text-white/80 group-hover:translate-x-1'
            }`}
        >
          {isDisabled ? '⏸' : '→'}
        </motion.div>
      </div>
    </motion.div>
  );
};

export const CreateCheckoutCard = ({
  isOpen = true,
  onClose = () => { },
  onSelect = () => { }
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
            className="absolute -top-3 -right-3 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-gray-800 to-gray-900 text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition-all duration-200 hover:scale-110 shadow-lg"
          >
            <X size={18} />
          </button>

          <motion.div
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0, duration: 0.2, ease: "easeOut" }}
            className="mb-8 text-center"
          >

            <h2 className="text-3xl font-bold text-white mb-3 bg-gradient-to-r from-white to-white/90 bg-clip-text">
              Create Checkout
            </h2>
            <p className="text-white/60 text-base leading-relaxed max-w-md mx-auto">
              Choose your checkout type to get started with your next project
            </p>
          </motion.div>

          <div className="space-y-4">
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


