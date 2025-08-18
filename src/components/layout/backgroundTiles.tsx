"use client"

import React from "react"
import { Stars } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";

interface TilesProps {
  className?: string
  rows?: number
  cols?: number
  tileClassName?: string
  tileSize?: "sm" | "md" | "lg"
}

export function Tiles({
  className,
  rows = 100,
  cols = 10,
  tileClassName,
  tileSize = "md",
}: TilesProps) {
  return (
    <div 
      className={`fixed inset-0 z-0 opacity-30 pointer-events-none ${className}`}
    >
      <Canvas>
        <Stars radius={50} count={2500} factor={4} fade speed={2} />
      </Canvas>
    </div>
  )
}