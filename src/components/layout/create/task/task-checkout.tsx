"use client";

import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Upload, ArrowLeft, ArrowRight, Check, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppButton } from "@/components/ui/app-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CloseButton } from "@/components/ui/close-button";

interface TaskCheckoutCardProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const TaskCheckoutCard = ({ 
  isOpen = true, 
  onClose = () => {} 
}: TaskCheckoutCardProps) => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [taskName, setTaskName] = useState("");
  const [prizePool, setPrizePool] = useState("");
  const [numberOfWinners, setNumberOfWinners] = useState("1");
  const [participants, setParticipants] = useState("");
  const [pointsPerAction, setPointsPerAction] = useState("100");
  const [expiryDate, setExpiryDate] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [submissionInstructions, setSubmissionInstructions] = useState("");
  const [prizeSplits, setPrizeSplits] = useState<string[]>(["100"]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const winners = Math.max(1, parseInt(numberOfWinners || "1", 10));
    const total = parseFloat(prizePool || "0");
    setPrizeSplits(() => {
      if (!isFinite(total) || total <= 0) {
        return Array.from({ length: winners }, () => "");
      }
      const equal = Math.floor((total / winners) * 100) / 100;
      const remainder = Math.round((total - equal * winners) * 100) / 100;
      return Array.from({ length: winners }, (_, i) => String((equal + (i === 0 ? remainder : 0)).toFixed(2)));
    });
  }, [numberOfWinners, prizePool]);

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
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCreateTask = () => {
    console.log('Creating task:', {
      image: uploadedImage,
      taskName,
      prizePool,
      numberOfWinners,
      participants,
      prizeSplits,
      pointsPerAction,
      expiryDate,
      taskDescription,
      submissionInstructions
    });
    setShowSuccess(true);
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

  const calculateTimeLeft = (targetDate: string) => {
    if (!targetDate) return null;
    const difference = +new Date(targetDate) - +new Date();
    if (difference > 0) {
      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60)
      };
    }
    return null;
  };

  const timeLeft = calculateTimeLeft(expiryDate);
  const prizePoolNumber = parseFloat(prizePool || "0");
  const splitsTotal = prizeSplits.reduce((sum, s) => sum + (parseFloat(s) || 0), 0);
  const splitsAreValid = Math.abs(splitsTotal - prizePoolNumber) < 0.01;

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 1, scale: 1, y: 0 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="w-full max-w-md relative z-10 -mt-8"
    >
      <div className="bg-black border border-zinc-800 p-6 max-w-md w-full rounded-xl relative overflow-visible">
        <div className="relative">
          <CloseButton onClick={handleClose} className="-top-5 -right-4" />
          
          <motion.div initial={{ opacity: 1, y: 0 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0, duration: 0.2, ease: "easeOut" }} className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Create Task</h2>
            <p className="text-zinc-400 text-sm">Step {currentStep} of 3</p>
          </motion.div>

          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white text-base font-medium">Upload Task Image</Label>
                  <div className="border-2 border-dashed border-zinc-700 rounded-lg p-6 text-center hover:border-zinc-600 transition-colors">
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="task-image-upload" />
                    <label htmlFor="task-image-upload" className="cursor-pointer">
                      {uploadedImage ? (
                        <div className="space-y-2">
                          <div className="w-full h-40 overflow-hidden rounded-lg">
                            <img src={uploadedImage} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                          <p className="text-zinc-400 text-sm text-center">Click to change image</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="w-8 h-8 text-zinc-400 mx-auto" />
                          <p className="text-zinc-400 text-sm">Click to upload task image</p>
                          <p className="text-zinc-500 text-xs">jpg, png, Max 5MB</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="taskName" className="text-white text-base font-medium">Task Name</Label>
                  <Input id="taskName" value={taskName} onChange={(e) => setTaskName(e.target.value)} placeholder="Enter task name" className="bg-black/20 border-white/20 text-white placeholder:text-white/40" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="taskDescription" className="text-white text-base font-medium">Task To-Do</Label>
                  <Textarea id="taskDescription" value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} placeholder="Describe what participants need to do" className="bg-black/20 border-white/20 text-white placeholder:text-white/40 min-h-[80px]" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expiryDate" className="text-white text-base font-medium">Task Expiry Date</Label>
                  <Input id="expiryDate" type="datetime-local" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="bg-black/20 border-white/20 text-white placeholder:text-white/40" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="submissionInstructions" className="text-white text-base font-medium">Submission Instructions</Label>
                  <Textarea id="submissionInstructions" value={submissionInstructions} onChange={(e) => setSubmissionInstructions(e.target.value)} placeholder="Tell participants how to submit their work (e.g., paste a link or upload proof)" className="bg-black/20 border-white/20 text-white placeholder:text-white/40 min-h-[80px]" />
                </div>

                <AppButton onClick={handleNext} disabled={!uploadedImage || !taskName || !taskDescription || !expiryDate || !submissionInstructions} className="w-full bg-gradient-to-r from-[#0088c1] to-[#005a7a] hover:from-[#0077a8] hover:to-[#004d6b] text-white disabled:opacity-50 py-3 px-6 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl shadow-[#0088c1]/25 hover:shadow-[#0088c1]/40 transform hover:scale-105">
                  Next
                  <ArrowRight className="w-4 h-4" />
                </AppButton>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="prizePool" className="text-white text-base font-medium">Prize Pool</Label>
                  <div className="relative">
                    <Input id="prizePool" type="number" step="0.01" value={prizePool} onChange={(e) => setPrizePool(e.target.value)} placeholder="0.00" className="bg-black/20 border-white/20 text-white placeholder:text-white/40 pr-16" />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-zinc-400">USD</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="numberOfWinners" className="text-white text-base font-medium">Winners</Label>
                    <div className="relative">
                      <Input id="numberOfWinners" type="number" min={1} value={numberOfWinners} onChange={(e) => setNumberOfWinners(e.target.value)} placeholder="1" className="bg-black/20 border-white/20 text-white placeholder:text-white/40 pr-20" />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-zinc-400">winners</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="participants" className="text-white text-base font-medium">Max Participants</Label>
                    <div className="relative">
                      <Input id="participants" type="number" value={participants} onChange={(e) => setParticipants(e.target.value)} placeholder="100" className="bg-black/20 border-white/20 text-white placeholder:text-white/40 pr-16" />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-zinc-400">people</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white text-base font-medium">Prize Split (USD)</Label>
                  <div className="space-y-2">
                    {prizeSplits.map((split, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="w-28 text-zinc-400 text-sm">
                          {index + 1}{index === 0 ? "st" : index === 1 ? "nd" : index === 2 ? "rd" : "th"} place
                        </div>
                        <div className="relative flex-1">
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={split}
                            onChange={(e) => {
                              const next = [...prizeSplits];
                              next[index] = e.target.value;
                              setPrizeSplits(next);
                            }}
                            placeholder="0.00"
                            className="bg-black/20 border-white/20 text-white placeholder:text-white/40 pr-10"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">USD</span>
                        </div>
                      </div>
                    ))}
                    <div className={`text-sm ${splitsAreValid ? 'text-green-400' : 'text-red-400'}`}>
                      Total: ${splitsTotal.toFixed(2)} {splitsAreValid ? '' : `(must equal $${isNaN(prizePoolNumber) ? '0.00' : prizePoolNumber.toFixed(2)})`}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pointsPerAction" className="text-white text-base font-medium">Points Per Action</Label>
                  <div className="relative">
                    <Input id="pointsPerAction" type="number" value={pointsPerAction} onChange={(e) => setPointsPerAction(e.target.value)} placeholder="100" className="bg-black/20 border-white/20 text-white placeholder:text-white/40 pr-24" />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-zinc-400">verxio points</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <AppButton onClick={handleBack} variant="secondary" className="flex-1">
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </AppButton>
                  <AppButton onClick={handleNext} disabled={!prizePool || !participants || !splitsAreValid} className="flex-1 bg-gradient-to-r from-[#0088c1] to-[#005a7a] hover:from-[#0077a8] hover:to-[#004d6b] text-white disabled:opacity-50 py-3 px-6 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl shadow-[#0088c1]/25 hover:shadow-[#0088c1]/40 transform hover:scale-105">
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </AppButton>
                </div>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <p className="text-zinc-400 text-sm">Please review all details before creating</p>
                  </div>

                  <div className="space-y-3">
                    {expiryDate && (
                      <div className="p-4 border border-zinc-700 rounded-lg">
                        {timeLeft ? (
                          <div className="grid grid-cols-4 gap-2 text-center">
                            <div className="bg-zinc-800 p-2 rounded">
                              <div className="text-white font-bold">{timeLeft.days}</div>
                              <div className="text-zinc-400 text-xs">Days</div>
                            </div>
                            <div className="bg-zinc-800 p-2 rounded">
                              <div className="text-white font-bold">{timeLeft.hours}</div>
                              <div className="text-zinc-400 text-xs">Hours</div>
                            </div>
                            <div className="bg-zinc-800 p-2 rounded">
                              <div className="text-white font-bold">{timeLeft.minutes}</div>
                              <div className="text-zinc-400 text-xs">Minutes</div>
                            </div>
                            <div className="bg-zinc-800 p-2 rounded">
                              <div className="text-white font-bold">{timeLeft.seconds}</div>
                              <div className="text-zinc-400 text-xs">Seconds</div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-red-400 text-sm">Task has expired</p>
                        )}
                      </div>
                    )}

                    {uploadedImage && (
                      <div className="p-4 border border-zinc-700 rounded-lg overflow-hidden">
                        <img src={uploadedImage} alt="Task Preview" className="w-full h-32 object-cover rounded-lg" />
                      </div>
                    )}
                    
                    <div className="p-4 border border-zinc-700 rounded-lg">
                      <h4 className="text-white font-medium mb-2">Task Details</h4>
                      <div className="space-y-1 text-sm">
                        <p className="text-zinc-400">Name: <span className="text-white">{taskName}</span></p>
                        <p className="text-zinc-400">To-Do: <span className="text-white">{taskDescription}</span></p>
                        <p className="text-zinc-400">Points: <span className="text-white">{pointsPerAction} verxio points</span></p>
                      </div>
                    </div>

                    <div className="p-4 border border-zinc-700 rounded-lg">
                      <h4 className="text-white font-medium mb-2">Prize & Participants</h4>
                      <div className="space-y-1 text-sm">
                        <p className="text-zinc-400">Prize Pool: <span className="text-white">${isNaN(prizePoolNumber) ? '0.00' : prizePoolNumber.toFixed(2)}</span></p>
                        <p className="text-zinc-400">Winners: <span className="text-white">{numberOfWinners}</span></p>
                        <p className="text-zinc-400">Max Participants: <span className="text-white">{participants}</span></p>
                        <p className="text-zinc-400">Split: <span className="text-white">{prizeSplits.map((p, i) => `${i+1}${i===0?'st':i===1?'nd':i===2?'rd':'th'}: $${(parseFloat(p)||0).toFixed(2)}`).join(', ')}</span></p>
                      </div>
                    </div>

                    <div className="p-4 border border-zinc-700 rounded-lg">
                      <h4 className="text-white font-medium mb-2">Submission</h4>
                      <p className="text-zinc-400 text-sm mb-2">{submissionInstructions}</p>
                      <div className="relative">
                        <Input disabled placeholder="Paste your submission link here..." className="bg-black/20 border-white/20 text-white placeholder:text-white/40 pr-16" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">disabled preview</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <AppButton onClick={handleBack} variant="secondary" className="flex-1">
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </AppButton>
                  <AppButton onClick={handleCreateTask} className="flex-1 bg-gradient-to-r from-[#0088c1] to-[#005a7a] hover:from-[#0077a8] hover:to-[#004d6b] text-white py-3 px-6 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl shadow-[#0088c1]/25 hover:shadow-[#0088c1]/40 transform hover:scale-105">
                    Create Task
                  </AppButton>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {showSuccess && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-black border border-zinc-800 p-8 max-w-md w-full mx-4 rounded-xl text-center">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Task Created!</h3>
              <p className="text-white/80 mb-4">Your task has been successfully created and is now live.</p>
              <div className="pt-4">
                <p className="text-zinc-400 text-sm">Redirecting to dashboard in {countdown} seconds...</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};