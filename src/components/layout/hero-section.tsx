import { Stars } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import React from "react";
import { ArrowRight } from "lucide-react";
import { usePrivy } from '@privy-io/react-auth';

import { motion } from "framer-motion";

export const AuroraHero = () => {
  const { login } = usePrivy();

  return (
    <section className="relative grid min-h-screen place-content-center overflow-hidden bg-black px-4 py-24 text-white">
      <div className="relative z-10 flex flex-col items-center">
        <span className="mb-1.5 inline-block rounded-full bg-[#117ba6]/40 px-3 py-1.5 text-sm text-white border border-white/20">
          Beta Now Live
        </span>
        <h1 className="max-w-3xl bg-gradient-to-br from-white to-gray-400 bg-clip-text text-center text-3xl font-medium leading-tight text-transparent sm:text-5xl sm:leading-tight md:text-7xl md:leading-tight">
          Add Rewards to every customer experience
        </h1>
        <p className="my-6 max-w-xl text-center text-base leading-relaxed text-gray-300 md:text-lg md:leading-relaxed">
          Transform your checkouts with native customer rewards and loyalty programs.
        </p>
        <motion.button
          onClick={login}
          whileHover={{
            scale: 1.015,
          }}
          whileTap={{
            scale: 0.985,
          }}
          className="group relative flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-white transition-colors hover:bg-white/20 border border-white/20"
        >
          Continue
          <ArrowRight className="transition-transform group-hover:-rotate-45 group-active:-rotate-12" />
        </motion.button>
      </div>

      <div className="absolute inset-0 z-0">
        <Canvas>
          <Stars radius={50} count={2500} factor={4} fade speed={2} />
        </Canvas>
      </div>
    </section>
  );
};