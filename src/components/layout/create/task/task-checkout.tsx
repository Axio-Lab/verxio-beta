"use client";

import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Upload, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppButton } from "@/components/ui/app-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CloseButton } from "@/components/ui/close-button";
import { VerxioLoaderWhite } from "@/components/ui/verxio-loader-white";
import { createTask } from "@/app/actions/task";
import { usePrivy } from "@privy-io/react-auth";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { uploadFile } from "@/app/actions/files";

interface TaskCheckoutCardProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const TaskCheckoutCard = ({ 
  isOpen = true, 
  onClose = () => {} 
}: TaskCheckoutCardProps) => {
  const router = useRouter();
  const { user } = usePrivy();
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
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
  const [isCreating, setIsCreating] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Handle navigation when countdown reaches 0
  useEffect(() => {
    if (countdown === 0 && showSuccess) {
      router.push('/dashboard');
    }
  }, [countdown, showSuccess, router]);

  // Start a countdown once success is shown, then let the existing
  // redirect effect navigate when countdown reaches 0
  useEffect(() => {
    if (!showSuccess) return;

    // reset to 5 seconds whenever success is displayed
    setCountdown(5);

    const intervalId = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(intervalId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [showSuccess]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Store the file for later upload
      setUploadedImageFile(file);

      // Show preview immediately
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNext = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentStep(currentStep + 1);
      setIsTransitioning(false);
    }, 300);
  };

  const handleBack = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentStep(currentStep - 1);
      setIsTransitioning(false);
    }, 300);
  };

  const handleCreateTask = async () => {
    if (!user?.wallet?.address) {
      setError('Wallet not connected. Please connect your wallet first.');
      return;
    }

    try {
      setIsCreating(true);
      setError(null);

      // Upload image to Pinata only when submitting
      let finalImageUrl: string | null = null;
      if (uploadedImageFile) {
        const formData = new FormData();
        formData.append('file', uploadedImageFile);
        const result = await uploadFile(formData);
        finalImageUrl = result.url;
      }

      const taskData = {
        creatorAddress: user.wallet.address,
        taskName,
        taskDescription,
        submissionInstructions,
        image: finalImageUrl || undefined,
        prizePool: parseFloat(prizePool),
        numberOfWinners: parseInt(numberOfWinners),
        maxParticipants: parseInt(participants),
        pointsPerAction: parseInt(pointsPerAction),
        prizeSplits,
        expiryDate
      };

      // console.log('Creating task:', taskData);

      const result = await createTask(taskData);

      if (result.success && result.task) {
        // Show success and redirect
        setIsTransitioning(true);
        setTimeout(() => {
          setShowSuccess(true);
          setIsTransitioning(false);
        }, 300);
      } else {
        setError(result.error || 'Failed to create task');
        if (result.requiredCredits && result.currentBalance !== undefined) {
          setError(`${result.error}\nRequired: ${result.requiredCredits} credits, Available: ${result.currentBalance} credits`);
        }
      }
    } catch (error: any) {
      console.error('Error creating task:', error);
      setError('Failed to create task. Please try again.');
    } finally {
      setIsCreating(false);
    }
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

  if (isTransitioning) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-auto"
      >
        <div className="bg-black border border-zinc-800 p-6 max-w-md w-full rounded-xl relative overflow-visible">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <VerxioLoaderWhite size="md" />
              <p className="text-white mt-4 text-lg">Loading...</p>
              <p className="text-zinc-400 text-sm mt-2">Please wait while we prepare the next step</p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (showSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-auto"
      >
        <div className="bg-black border border-zinc-800 p-6 max-w-md w-full rounded-xl relative overflow-visible">
          <div className="relative">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">Task Created</h3>
              <p className="text-white/80">Your task has been successfully created</p>

              <div className="pt-4 space-y-3">
                <p className="text-zinc-400 text-sm">Redirecting to dashboard in {countdown} seconds...</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed top-20 right-6 z-50">
        <ToastContainer
          position="top-right"
          autoClose={3000}
          theme="dark"
          toastStyle={{
            marginTop: '20px',
            zIndex: 9999
          }}
        />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-auto"
      >
      <div className="bg-black border border-zinc-800 p-6 max-w-md w-full rounded-xl relative overflow-visible">
        <div className="relative">
          <CloseButton onClick={handleClose} className="-top-5 -right-4" />
          
          <div className="text-center mb-8 pt-4">
            <h2 className="text-2xl font-bold text-white mb-3">
              Create Task
            </h2>
            <p className="text-zinc-400 text-base">
              Create engaging tasks with rewards
            </p>
          </div>

          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-white text-base font-medium">Upload Image</Label>
                    <div className="border-2 border-dashed border-zinc-700 rounded-lg p-6 text-center hover:border-zinc-600 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="image-upload"
                      />
                      <label htmlFor="image-upload" className="cursor-pointer">
                        {uploadedImage ? (
                          <div className="space-y-2">
                            <div className="w-full h-40 overflow-hidden rounded-lg relative">
                              <img
                                src={uploadedImage}
                                alt="Preview"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <p className="text-zinc-400 text-sm text-center">Click to change image</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Upload className="w-8 h-8 text-zinc-400 mx-auto" />
                            <p className="text-zinc-400 text-sm">Click to upload image</p>
                            <p className="text-zinc-500 text-xs">Recommended size: 500x500px</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="taskName" className="text-white text-base font-medium">Task Name</Label>
                    <Input
                      id="taskName"
                      value={taskName}
                      onChange={(e) => setTaskName(e.target.value)}
                      placeholder="Enter task name"
                      className="bg-black/20 border-white/20 text-white placeholder:text-white/40 h-12 text-base"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="taskDescription" className="text-white text-base font-medium">Task Description</Label>
                    <Textarea
                      id="taskDescription"
                      value={taskDescription}
                      onChange={(e) => setTaskDescription(e.target.value)}
                      placeholder="Describe what participants need to do"
                      className="bg-black/20 border-white/20 text-white placeholder:text-white/40 min-h-[80px] text-base"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="submissionInstructions" className="text-white text-base font-medium">Submission Instructions</Label>
                    <Textarea
                      id="submissionInstructions"
                      value={submissionInstructions}
                      onChange={(e) => setSubmissionInstructions(e.target.value)}
                      placeholder="Tell participants how to submit their work"
                      className="bg-black/20 border-white/20 text-white placeholder:text-white/40 min-h-[80px] text-base"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expiryDate" className="text-white text-base font-medium">Expiry Date</Label>
                    <Input
                      id="expiryDate"
                      type="datetime-local"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="bg-black/20 border-white/20 text-white placeholder:text-white/40 h-12 text-base"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <AppButton
                    onClick={handleNext}
                    disabled={!uploadedImage || !uploadedImageFile || !taskName.trim() || !taskDescription.trim() || !submissionInstructions.trim() || !expiryDate}
                    className="flex-1 bg-gradient-to-r from-[#00adef] to-[#056f96] hover:from-[#0098d1] hover:to-[#0088c1] text-white disabled:opacity-50 py-3 px-6 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl shadow-[#00adef]/25 hover:shadow-[#00adef]/40 transform hover:scale-105"
                  >
                    <div className="flex items-center gap-2 justify-center">
                      <span>Next</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </AppButton>
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="prizePool" className="text-white text-base font-medium">Prize Pool</Label>
                    <div className="relative">
                      <Input
                        id="prizePool"
                        type="number"
                        step="0.01"
                        value={prizePool}
                        onChange={(e) => setPrizePool(e.target.value)}
                        placeholder="0.00"
                        className="bg-black/20 border-white/20 text-white placeholder:text-white/40 h-12 text-base pr-16"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-zinc-400">USD</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="numberOfWinners" className="text-white text-base font-medium">Winners</Label>
                      <div className="relative">
                        <Input
                          id="numberOfWinners"
                          type="number"
                          min={1}
                          value={numberOfWinners}
                          onChange={(e) => setNumberOfWinners(e.target.value)}
                          placeholder="1"
                          className="bg-black/20 border-white/20 text-white placeholder:text-white/40 h-12 text-base pr-20"
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-zinc-400">winners</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="participants" className="text-white text-base font-medium">Max Participants</Label>
                      <div className="relative">
                        <Input
                          id="participants"
                          type="number"
                          value={participants}
                          onChange={(e) => setParticipants(e.target.value)}
                          placeholder="100"
                          className="bg-black/20 border-white/20 text-white placeholder:text-white/40 h-12 text-base pr-16"
                        />
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
                              className="bg-black/20 border-white/20 text-white placeholder:text-white/40 h-10 text-sm pr-10"
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
                      <Input
                        id="pointsPerAction"
                        type="number"
                        value={pointsPerAction}
                        onChange={(e) => setPointsPerAction(e.target.value)}
                        placeholder="100"
                        className="bg-black/20 border-white/20 text-white placeholder:text-white/40 h-12 text-base pr-24"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-zinc-400">verxio points</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <AppButton
                    variant="secondary"
                    onClick={handleBack}
                    className="flex-1"
                  >
                    <div className="flex items-center gap-2 justify-center">
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back</span>
                    </div>
                  </AppButton>
                  <AppButton
                    onClick={handleNext}
                    disabled={!prizePool || !participants || !splitsAreValid}
                    className="flex-1 bg-gradient-to-r from-[#00adef] to-[#056f96] hover:from-[#0098d1] hover:to-[#0088c1] text-white disabled:opacity-50 py-3 px-6 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl shadow-[#00adef]/25 hover:shadow-[#00adef]/40 transform hover:scale-105"
                  >
                    <div className="flex items-center gap-2 justify-center">
                      <span>Next</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </AppButton>
                </div>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
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

                {/* Error Display */}
                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-red-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-medium">{error}</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <AppButton
                    variant="secondary"
                    onClick={handleBack}
                    className="flex-1"
                  >
                    <div className="flex items-center gap-2 justify-center">
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back</span>
                    </div>
                  </AppButton>
                  <AppButton
                    onClick={handleCreateTask}
                    disabled={isCreating}
                    className="flex-1 bg-gradient-to-r from-[#00adef] to-[#056f96] hover:from-[#0098d1] hover:to-[#0088c1] text-white py-3 px-6 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl shadow-[#00adef]/25 hover:shadow-[#00adef]/40 transform hover:scale-105 disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2 justify-center">
                      {isCreating ? (
                        <>
                          <VerxioLoaderWhite size="sm" />
                          <span>Creating Task...</span>
                        </>
                      ) : (
                        <>
                          <span>Create Task</span>
                          <Check className="w-4 h-4" />
                        </>
                      )}
                    </div>
                  </AppButton>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step Indicator */}
          <div className="flex justify-center mt-8">
            <div className="flex space-x-2">
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className={`w-3 h-3 rounded-full ${step === currentStep ? 'bg-[#00adef]' : 'bg-white/20'
                    }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
    </>
  );
};