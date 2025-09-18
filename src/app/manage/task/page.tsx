'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';
import { usePrivy } from '@privy-io/react-auth';
import { getUserTasks, getUserTaskParticipations } from '@/app/actions/task';
import { useRouter } from 'next/navigation';
import { Plus, ListChecks, ExternalLink, CheckCircle, XCircle, Clock, ArrowLeft } from 'lucide-react';
import { AppButton } from '@/components/ui/app-button';

export default function ManageTasksPage() {
  const { user } = usePrivy();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState<any[]>([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const [participations, setParticipations] = useState<any[]>([]);
  const [showSubs, setShowSubs] = useState(false);
  const [subsPage, setSubsPage] = useState(1);
  const subsPageSize = 10;
  

  useEffect(() => {
    const load = async () => {
      if (!user?.wallet?.address) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const res = await getUserTasks(user.wallet.address);
        if (res.success && res.tasks) setTasks(res.tasks as any[]);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [user?.wallet?.address]);

  useEffect(() => {
    const loadParticipations = async () => {
      if (!user?.wallet?.address) return;
      setPartsLoading(true);
      try {
        const res = await getUserTaskParticipations(user.wallet.address);
        if (res.success && res.participations) setParticipations(res.participations as any[]);
      } finally {
        setPartsLoading(false);
      }
    };
    loadParticipations();
  }, [user?.wallet?.address]);

  return (
    <AppLayout currentPage="dashboard">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-2">
          <AppButton
            onClick={() => router.push('/dashboard')}
            variant="secondary"
            className="p-2"
          >
            <ArrowLeft className="w-4 h-4" />
          </AppButton>
          <div className="text-center flex-1">
            <h1 className="text-2xl font-bold text-white">Task Management</h1>
            <p className="text-white/60 text-sm">Create and manage your tasks</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push('/create/task')}
            className="p-4 bg-gradient-to-br from-white/8 to-white/3 border border-white/15 rounded-lg hover:border-white/25 hover:bg-white/10 text-left transition-all duration-300 hover:scale-105 backdrop-blur-sm group"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-200 shadow-lg">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div className="text-sm font-medium text-white">Create Task</div>
            <div className="text-xs text-white/60 font-medium">Start a new campaign</div>
          </button>
          <div className="p-4 bg-gradient-to-br from-white/8 to-white/3 border border-white/15 rounded-lg text-left backdrop-blur-sm">
            <div className="w-8 h-8 bg-gradient-to-br from-green-600 to-green-800 rounded-lg flex items-center justify-center mb-2 shadow-lg">
              <ListChecks className="w-5 h-5 text-white" />
            </div>
            <div className="text-sm font-medium text-white">Total Tasks</div>
            <div className="text-xl font-bold text-green-400">{tasks.length}</div>
          </div>
        </div>

        {/* My Submissions (Program members-style dropdown) */}
        <Card className="bg-black/50 border-white/10 text-white">
          <CardHeader
            className="cursor-pointer hover:bg-white/5 transition-colors"
            onClick={() => setShowSubs((v) => !v)}
          >
            <CardTitle className="text-lg text-white flex items-center justify-between">
              <span>My Submissions</span>
              <span className="text-sm text-gray-400 flex items-center gap-3">
                <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-xs">{participations.length}</span>
                {showSubs ? '▼' : '▶'}
              </span>
            </CardTitle>
          </CardHeader>
          {showSubs && (
            <CardContent>
              {!user?.wallet?.address ? (
                <div className="text-center py-6 text-white/60">Connect your wallet to see your submissions</div>
              ) : partsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <VerxioLoaderWhite size="md" />
                </div>
              ) : participations.length === 0 ? (
                <div className="text-center py-6 text-white/60">No submissions yet</div>
              ) : (
                <>
                  <div className="space-y-2">
                    {(participations.slice((subsPage - 1) * subsPageSize, subsPage * subsPageSize)).map((p) => (
                      <div
                        key={p.id}
                        className="w-full p-3 bg-gradient-to-br from-white/10 to-white/5 rounded-lg border border-white/20 hover:border-white/30 transition-all duration-200"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-sm font-medium text-white">{p.task.taskName}</div>
                          <div className={`flex items-center gap-1 text-xs font-medium ${
                            p.status === 'ACCEPTED' ? 'text-green-400' : 
                            p.status === 'REJECTED' ? 'text-red-400' : 
                            'text-blue-400'
                          }`}>
                            {p.status === 'ACCEPTED' && <CheckCircle className="w-3 h-3" />}
                            {p.status === 'REJECTED' && <XCircle className="w-3 h-3" />}
                            {p.status === 'SUBMITTED' && <Clock className="w-3 h-3" />}
                            {p.status}
                          </div>
                        </div>
                        {/* Submission details */}
                        {p.submissionUrl && (
                          <div className="mt-1">
                            <a href={p.submissionUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 underline break-all">
                              {p.submissionUrl}
                            </a>
                          </div>
                        )}
                        {p.submissionData && (
                          <div className="mt-1 text-xs text-white/80 break-words">
                            {p.submissionData}
                          </div>
                        )}
                        {/* Credit notification */}
                        {p.status === 'ACCEPTED' && (
                          <div className="mt-2 p-2 bg-green-500/20 border border-green-500/30 rounded-lg">
                            <div className="flex items-center gap-2 text-xs text-green-300">
                              <CheckCircle className="w-3 h-3" />
                              <span className="font-medium">Credited with +{p.task.pointsPerAction} $VERXIO credits</span>
                            </div>
                          </div>
                        )}
                        {p.status === 'REJECTED' && (
                          <div className="mt-2 p-2 bg-red-500/20 border border-red-500/30 rounded-lg">
                            <div className="flex items-center gap-2 text-xs text-red-300">
                              <XCircle className="w-3 h-3" />
                              <span className="font-medium">Submission rejected - no credits awarded</span>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <div className="text-[11px] text-white/60">
                            Submitted {new Date(p.submittedAt || p.createdAt || p.updatedAt || Date.now()).toLocaleString()}
                          </div>
                          <button
                            onClick={() => router.push(`/task/${p.task.id}`)}
                            className="text-[11px] text-blue-300 hover:text-blue-200 flex items-center gap-1"
                          >
                            View task <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Pagination Controls */}
                  {participations.length > subsPageSize && (
                    <div className="flex items-center justify-between mt-3">
                      <button
                        onClick={() => setSubsPage((n) => Math.max(1, n - 1))}
                        disabled={subsPage === 1}
                        className="px-3 py-1.5 text-xs rounded-md border border-white/20 text-white disabled:opacity-40 hover:bg-white/10"
                      >
                        Previous
                      </button>
                      <div className="text-xs text-white/70">
                        Page {subsPage} of {Math.ceil(participations.length / subsPageSize)}
                      </div>
                      <button
                        onClick={() => setSubsPage((n) => Math.min(Math.ceil(participations.length / subsPageSize), n + 1))}
                        disabled={subsPage >= Math.ceil(participations.length / subsPageSize)}
                        className="px-3 py-1.5 text-xs rounded-md border border-white/20 text-white disabled:opacity-40 hover:bg-white/10"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          )}
        </Card>

        <Card className="bg-gradient-to-br from-gray-900/90 via-black/80 to-gray-900/90 border border-white/10 text-white overflow-hidden relative">
          <CardHeader className="relative z-10 pb-3">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg text-white font-semibold">My Tasks</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="relative z-10 pt-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <VerxioLoaderWhite size="md" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-8 text-white/60">No tasks yet</div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => router.push(`/manage/task/${task.id}`)}
                    className="w-full p-4 bg-gradient-to-br from-white/8 to-white/3 border border-white/15 rounded-lg hover:border-white/25 hover:bg-white/10 transition-all duration-300 hover:scale-105 backdrop-blur-sm text-left"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-medium text-white">{task.taskName}</div>
                      <div className="text-xs text-blue-400 font-medium">{task.status}</div>
                    </div>
                    <div className="text-xs text-white/60">
                      {task.totalParticipants} / {task.maxParticipants} participants • ${task.prizePool}
                    </div>
                    <div className="text-[10px] text-white/40 mt-1">Expires {new Date(task.expiryDate).toLocaleString()}</div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        
      </div>
    </AppLayout>
  );
}


