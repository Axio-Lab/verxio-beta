"use client";

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useParams, useRouter } from 'next/navigation';
import { getTaskById, submitTaskParticipation } from '@/app/actions/task';
import { createOrUpdateUser } from '@/app/actions/user';
import { ArrowLeft, Check } from 'lucide-react';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';
import { usePrivy } from '@privy-io/react-auth';
import { Tiles } from '@/components/layout/backgroundTiles';
import Image from 'next/image';

function useCountdown(targetIso: string | undefined) {
  const [time, setTime] = useState<{days:number;hours:number;minutes:number;seconds:number} | null>(null);
  useEffect(() => {
    if (!targetIso) return;
    const calc = () => {
      const diff = +new Date(targetIso) - +new Date();
      if (diff <= 0) return setTime(null);
      setTime({
        days: Math.floor(diff / (1000*60*60*24)),
        hours: Math.floor((diff/(1000*60*60)) % 24),
        minutes: Math.floor((diff/1000/60) % 60),
        seconds: Math.floor((diff/1000) % 60)
      });
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [targetIso]);
  return time;
}

export default function TaskParticipationPage() {
  const params = useParams();
  const router = useRouter();
  const { user, login, logout, authenticated, ready } = usePrivy();
  const taskId = useMemo(() => (params?.taskId as string) || '', [params?.taskId]);
  const [isLoading, setIsLoading] = useState(true);
  const [task, setTask] = useState<any>(null);
  const [submissionUrl, setSubmissionUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const timeLeft = useCountdown(task?.expiryDate ? new Date(task.expiryDate).toISOString() : undefined);

  useEffect(() => {
    const load = async () => {
      if (!taskId) return;
      setIsLoading(true);
      try {
        const res = await getTaskById(taskId);
        if (res.success) setTask(res.task);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [taskId]);

  const handleSubmit = async () => {
    if (!user?.wallet?.address) {
      setError('Connect wallet to submit');
      return;
    }
    if (!submissionUrl.trim()) {
      setError('Enter a submission link');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // Ensure user account exists before submitting
      await createOrUpdateUser({ walletAddress: user.wallet.address });

      const res = await submitTaskParticipation({
        taskId,
        participantAddress: user.wallet.address,
        submissionUrl
      });
      if (res.success) {
        setSubmitted(true);
      } else {
        setError(res.error || 'Failed to submit');
      }
    } catch (e:any) {
      setError(e.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden">
        <Tiles rows={50} cols={50} tileSize="md" />
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <VerxioLoaderWhite size="lg" />
            <p className="text-white mt-4 text-lg">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      <Tiles rows={50} cols={50} tileSize="md" />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between p-4 border-b border-white/10 bg-black/80 backdrop-blur-sm">
        <div className="relative w-10 h-10">
          <Image
            src="/logo/verxioIconWhite.svg"
            alt="Verxio"
            width={40}
            height={40}
            className="w-full h-full"
          />
        </div>

        <div className="flex items-center gap-4">
          {authenticated && (
            <>
              <span className="text-white text-sm">
                {user?.wallet?.address?.slice(0, 6)}...{user?.wallet?.address?.slice(-4)}
              </span>
              <button
                onClick={logout}
                className="flex items-center gap-2 text-white hover:text-red-400 transition-colors"
              >
                Sign Out
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen pt-20 px-4">
        <div className="w-full max-w-md mx-auto space-y-6">
          {isLoading || !task ? (
            <div className="flex items-center justify-center py-16">
              <VerxioLoaderWhite size="md" />
            </div>
          ) : (
            submitted ? (
              <Card className="bg-black/50 border-white/10 text-white">
                <CardHeader>
                  <CardTitle className="text-lg text-white">Submission Received</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Check className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-center text-sm text-white/80">Your submission has been recorded.</div>
                </CardContent>
              </Card>
            ) : (
            <>
            {/* Countdown */}
            <Card className="bg-black/50 border-white/10 text-white">
              <CardContent className="pt-6">
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
                  <div className="text-center text-red-400 text-sm">Task has expired</div>
                )}
              </CardContent>
            </Card>

            {/* Task details */}
            <Card className="bg-black/50 border-white/10 text-white">
              <CardHeader>
                <CardTitle className="text-lg text-white">{task.taskName}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  <div className="text-zinc-400">To-Do: <span className="text-white">{task.taskDescription}</span></div>
                  <div className="text-zinc-400">Points: <span className="text-white">{task.pointsPerAction} verxio points</span></div>
                  <div className="text-zinc-400">Prize: <span className="text-white">${task.prizePool}</span></div>
                </div>
              </CardContent>
            </Card>

            {/* Submission */}
            <Card className="bg-black/50 border-white/10 text-white">
              <CardHeader>
                <CardTitle className="text-lg text-white">Submission</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-zinc-400 text-sm mb-2">Paste your submission link</div>
                <div className="relative">
                  <Input
                    value={submissionUrl}
                    onChange={(e) => setSubmissionUrl(e.target.value)}
                    placeholder="https://..."
                    disabled={!authenticated}
                    className="bg-black/20 border-white/20 text-white placeholder:text-white/40 pr-16 disabled:opacity-50"
                  />
                </div>
                {error && (
                  <div className="mt-3 text-xs text-red-400">{error}</div>
                )}
                {authenticated ? (
                  <button
                    onClick={handleSubmit}
                    disabled={!timeLeft || submitting}
                    className="mt-4 w-full py-3 rounded-lg bg-gradient-to-r from-[#00adef] to-[#056f96] hover:from-[#0098d1] hover:to-[#0088c1] text-white disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2 justify-center text-sm">
                      {submitting ? <VerxioLoaderWhite size="sm" /> : <Check className="w-4 h-4" />}
                      <span>{submitting ? 'Submitting...' : 'Submit'}</span>
                    </div>
                  </button>
                ) : (
                  <button
                    onClick={() => login?.()}
                    className="mt-4 w-full py-3 rounded-lg bg-gradient-to-r from-[#00adef] to-[#056f96] hover:from-[#0098d1] hover:to-[#0088c1] text-white"
                  >
                    Log in to participate
                  </button>
                )}
              </CardContent>
            </Card>
            </>
            )
          )}
        </div>
      </div>
    </div>
  );
}


