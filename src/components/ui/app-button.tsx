import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AppButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}

export function AppButton({ 
  children, 
  variant = "primary", 
  size = "md",
  className,
  onClick,
  disabled,
  type = "button"
}: AppButtonProps) {
  const baseClasses = "font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2";
  
  const variants = {
    primary: "bg-white text-black hover:bg-white/90 hover:scale-105 focus:ring-white/50",
    secondary: "bg-black/20 border border-white/20 text-white hover:bg-white/10 hover:border-white/30 focus:ring-white/20"
  };
  
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };

  return (
    <Button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        baseClasses,
        variants[variant],
        sizes[size],
        disabled && "opacity-50 cursor-not-allowed hover:scale-100",
        className
      )}
    >
      {children}
    </Button>
  );
} 