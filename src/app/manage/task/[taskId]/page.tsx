'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';
import { useParams, useRouter } from 'next/navigation';
import { getTaskById, getTaskParticipations, moderateTaskSubmission, selectTaskWinners } from '@/app/actions/task';
import { ArrowLeft, Check, X, Copy, Check as CheckIcon } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';

export default function ManageTaskDetailPage() {
  const { user } = usePrivy();
  const params = useParams();
  const router = useRouter();
  const taskId = useMemo(() => (params?.taskId as string) || '', [params?.taskId]);
  const [isLoading, setIsLoading] = useState(true);
  const [task, setTask] = useState<any>(null);
  const [participations, setParticipations] = useState<any[]>([]);
  const [moderatingId, setModeratingId] = useState<string | null>(null);
  const [moderatingAction, setModeratingAction] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  const [selectedWinners, setSelectedWinners] = useState<{[key: number]: string}>({});
  const [selectingWinners, setSelectingWinners] = useState(false);

  const load = async (page: number = currentPage) => {
    if (!taskId || !user?.wallet?.address) return;
    setIsLoading(true);
    try {
      const [taskRes, partsRes] = await Promise.all([
        getTaskById(taskId),
        getTaskParticipations(taskId, user.wallet.address, page, 10)
      ]);
      if (taskRes.success) setTask(taskRes.task);
      if (partsRes.success) {
        setParticipations(partsRes.participations as any[]);
        setPagination(partsRes.pagination);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [taskId, user?.wallet?.address]);

  const handleModerate = async (participationId: string, approve: boolean) => {
    if (!user?.wallet?.address) return;
    setModeratingId(participationId);
    setModeratingAction(approve ? 'accept' : 'reject');
    try {
      const res = await moderateTaskSubmission({
        taskId,
        participationId,
        creatorAddress: user.wallet.address,
        approve
      });
      if (res.success) await load(currentPage);
    } finally {
      setModeratingId(null);
      setModeratingAction(null);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    load(page);
  };

  const handleSelectWinner = (position: number, participantAddress: string) => {
    setSelectedWinners(prev => ({
      ...prev,
      [position]: participantAddress
    }));
  };

  const handleSelectWinners = async () => {
    if (!user?.wallet?.address || !task) return;
    
    const winners = Object.entries(selectedWinners).map(([position, address]) => ({
      participantAddress: address,
      position: parseInt(position)
    }));

    if (winners.length === 0) {
      alert('Please select at least one winner');
      return;
    }

    setSelectingWinners(true);
    try {
      const res = await selectTaskWinners({
        taskId,
        creatorAddress: user.wallet.address,
        winners
      });
      
      if (res.success) {
        alert('Winners selected successfully! Prizes have been distributed.');
        await load(currentPage);
        setSelectedWinners({});
      } else {
        alert(res.error || 'Failed to select winners');
      }
    } catch (error) {
      alert('Failed to select winners');
    } finally {
      setSelectingWinners(false);
    }
  };

  const isTaskCompleted = task && (task.status === 'COMPLETED' || new Date() > new Date(task.expiryDate));
  const acceptedSubmissions = participations.filter(p => p.status === 'ACCEPTED');

  return (
    <AppLayout currentPage="dashboard">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 border border-white/20 rounded-lg hover:bg-white/10 transition-colors text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Task Submissions</h1>
            <p className="text-white/60 text-sm">Review and approve/reject</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <VerxioLoaderWhite size="md" />
          </div>
        ) : (
          <>
            {task && (
              <Card className="bg-black/50 border-white/10 text-white">
                <CardHeader>
                  <CardTitle className="text-lg text-white">{task.taskName}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-white/60 mb-1">{task.taskDescription}</div>
                  <div className="text-xs text-white/60">Participants: {task.totalParticipants} / {task.maxParticipants}</div>
                  {/* Shareable link */}
                  <div className="mt-3">
                    <div className="text-xs text-white/70 mb-1">Share participation link</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 text-xs truncate text-white/80 border border-white/10 rounded-md px-3 py-2 bg-white/5">
                        {typeof window !== 'undefined' ? `${window.location.origin}/task/${taskId}` : `/task/${taskId}`}
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            const url = typeof window !== 'undefined' ? `${window.location.origin}/task/${taskId}` : `/task/${taskId}`;
                            await navigator.clipboard.writeText(url);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 1500);
                          } catch {}
                        }}
                        className="p-2 border border-white/20 rounded-lg hover:bg-white/10 transition-colors text-white"
                        title="Copy link"
                      >
                        {copied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-black/50 border-white/10 text-white">
              <CardHeader>
                <CardTitle className="text-lg text-white">Submissions</CardTitle>
                {pagination && (
                  <div className="text-xs text-white/60">
                    Showing {((currentPage - 1) * 10) + 1}-{Math.min(currentPage * 10, pagination.total)} of {pagination.total} submissions
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {participations.length === 0 ? (
                  <div className="text-center py-8 text-white/60">No submissions yet</div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {participations.map((p) => (
                        <div key={p.id} className="p-3 border border-white/10 rounded-lg bg-white/5">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-xs text-white/80">
                              {p.participantAddress.slice(0, 6)}...{p.participantAddress.slice(-6)}
                            </div>
                            <div className={`text-xs font-medium ${p.status === 'ACCEPTED' ? 'text-green-400' : p.status === 'REJECTED' ? 'text-red-400' : 'text-blue-400'}`}>
                              {p.status}
                            </div>
                          </div>
                          {p.participant?.email && (
                            <div className="text-xs text-white/60 mb-1">
                              {p.participant.email}
                            </div>
                          )}
                          {p.submissionUrl && (
                            <a href={p.submissionUrl} target="_blank" className="text-xs text-blue-400 underline break-all">{p.submissionUrl}</a>
                          )}
                          {p.submissionData && (
                            <div className="text-xs text-white/70 break-words mt-1">{p.submissionData}</div>
                          )}
                          {(p.status === 'SUBMITTED' || p.status === 'REVIEWED') && (
                            <div className="flex gap-2 mt-3">
                              <button
                                disabled={moderatingId === p.id && moderatingAction === 'reject'}
                                onClick={() => handleModerate(p.id, true)}
                                className="flex-1 py-2 rounded-lg bg-gradient-to-r from-green-600 to-green-700 disabled:opacity-50"
                              >
                                <div className="flex items-center justify-center gap-2 text-white text-sm">
                                  {moderatingId === p.id && moderatingAction === 'accept' ? (
                                    <VerxioLoaderWhite size="sm" />
                                  ) : (
                                    <Check className="w-4 h-4" />
                                  )}
                                  Accept
                                </div>
                              </button>
                              <button
                                disabled={moderatingId === p.id && moderatingAction === 'accept'}
                                onClick={() => handleModerate(p.id, false)}
                                className="flex-1 py-2 rounded-lg bg-gradient-to-r from-red-600 to-red-700 disabled:opacity-50"
                              >
                                <div className="flex items-center justify-center gap-2 text-white text-sm">
                                  {moderatingId === p.id && moderatingAction === 'reject' ? (
                                    <VerxioLoaderWhite size="sm" />
                                  ) : (
                                    <X className="w-4 h-4" />
                                  )}
                                  Reject
                                </div>
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    {/* Pagination */}
                    {pagination && pagination.totalPages > 1 && (
                      <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="px-3 py-2 text-xs border border-white/20 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white"
                        >
                          Previous
                        </button>
                        <div className="flex items-center gap-2">
                          {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                            const pageNum = i + 1;
                            return (
                              <button
                                key={pageNum}
                                onClick={() => handlePageChange(pageNum)}
                                className={`px-3 py-2 text-xs rounded-lg ${
                                  currentPage === pageNum
                                    ? 'bg-blue-600 text-white'
                                    : 'border border-white/20 hover:bg-white/10 text-white'
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                          {pagination.totalPages > 5 && (
                            <>
                              <span className="text-white/60">...</span>
                              <button
                                onClick={() => handlePageChange(pagination.totalPages)}
                                className={`px-3 py-2 text-xs rounded-lg ${
                                  currentPage === pagination.totalPages
                                    ? 'bg-blue-600 text-white'
                                    : 'border border-white/20 hover:bg-white/10 text-white'
                                }`}
                              >
                                {pagination.totalPages}
                              </button>
                            </>
                          )}
                        </div>
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === pagination.totalPages}
                          className="px-3 py-2 text-xs border border-white/20 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Winner Selection */}
            {isTaskCompleted && task.status !== 'COMPLETED' && acceptedSubmissions.length > 0 && (
              <Card className="bg-black/50 border-white/10 text-white">
                <CardHeader>
                  <CardTitle className="text-lg text-white">Select Winners</CardTitle>
                  <div className="text-xs text-white/60">
                    Choose winners from accepted submissions. Prizes will be automatically distributed.
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Array.from({ length: task.numberOfWinners }, (_, i) => i + 1).map((position) => (
                      <div key={position} className="p-3 border border-white/10 rounded-lg bg-white/5">
                        <div className="text-sm font-medium text-white mb-2">
                          Position {position} - ${task.prizeSplits[position - 1] || 0}
                        </div>
                        <select
                          value={selectedWinners[position] || ''}
                          onChange={(e) => handleSelectWinner(position, e.target.value)}
                          className="w-full p-2 bg-black/20 border border-white/20 rounded text-white text-sm"
                        >
                          <option value="">Select winner...</option>
                          {acceptedSubmissions.map((submission) => (
                            <option key={submission.id} value={submission.participantAddress}>
                              {submission.participantAddress.slice(0, 6)}...{submission.participantAddress.slice(-6)}
                              {submission.participant?.email && ` (${submission.participant.email})`}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                    
                    <button
                      onClick={handleSelectWinners}
                      disabled={selectingWinners || Object.keys(selectedWinners).length === 0}
                      className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 text-white"
                    >
                      <div className="flex items-center justify-center gap-2 text-sm">
                        {selectingWinners ? <VerxioLoaderWhite size="sm" /> : <Check className="w-4 h-4" />}
                        <span>{selectingWinners ? 'Selecting Winners...' : 'Select Winners & Distribute Prizes'}</span>
                      </div>
                    </button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Task Completed Status */}
            {task?.status === 'COMPLETED' && (
              <Card className="bg-black/50 border-white/10 text-white">
                <CardHeader>
                  <CardTitle className="text-lg text-white">Task Completed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4">
                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Check className="w-8 h-8 text-white" />
                    </div>
                    <div className="text-sm text-white/80">Winners have been selected and prizes distributed!</div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}


