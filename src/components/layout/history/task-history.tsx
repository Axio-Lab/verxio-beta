'use client';

import { motion } from 'framer-motion';
import { CheckSquare, Clock, XCircle, Award, Users, Calendar } from 'lucide-react';

interface TaskAction {
  id: string;
  type: 'task_created' | 'task_completed' | 'task_submitted' | 'task_expired' | 'task_cancelled' | 'points_awarded';
  date: string;
  taskName: string;
  description: string;
  status: 'completed' | 'pending' | 'expired' | 'cancelled' | 'failed';
  participantCount?: number;
  winnerCount?: number;
  prizePool?: number;
  pointsAwarded?: number;
  submissionCount?: number;
  expiryDate?: string;
}

const mockTaskData: TaskAction[] = [
  {
    id: 'TASK_001',
    type: 'task_created',
    date: '2024-08-08T16:00:00Z',
    taskName: 'Design Logo for Startup',
    description: 'Create a modern logo design for a tech startup',
    status: 'pending',
    participantCount: 25,
    winnerCount: 3,
    prizePool: 500,
    expiryDate: '2024-08-15T16:00:00Z'
  },
  {
    id: 'TASK_002',
    type: 'task_submitted',
    date: '2024-08-08T15:30:00Z',
    taskName: 'Design Logo for Startup',
    description: 'User submitted logo design',
    status: 'pending',
    submissionCount: 1
  },
  {
    id: 'TASK_003',
    type: 'task_completed',
    date: '2024-08-08T14:15:00Z',
    taskName: 'Write Blog Post',
    description: 'Complete blog post about AI trends',
    status: 'completed',
    participantCount: 15,
    winnerCount: 1,
    prizePool: 200,
    pointsAwarded: 150
  },
  {
    id: 'TASK_004',
    type: 'points_awarded',
    date: '2024-08-08T14:20:00Z',
    taskName: 'Write Blog Post',
    description: 'Awarded points to winner',
    status: 'completed',
    pointsAwarded: 150
  },
  {
    id: 'TASK_005',
    type: 'task_expired',
    date: '2024-08-08T12:00:00Z',
    taskName: 'Social Media Campaign',
    description: 'Task expired without completion',
    status: 'expired',
    participantCount: 8,
    winnerCount: 0,
    prizePool: 300,
    expiryDate: '2024-08-08T12:00:00Z'
  },
  {
    id: 'TASK_006',
    type: 'task_cancelled',
    date: '2024-08-07T18:30:00Z',
    taskName: 'Video Editing Project',
    description: 'Task cancelled by creator',
    status: 'cancelled',
    participantCount: 12,
    winnerCount: 0,
    prizePool: 400
  }
];

const getActionIcon = (type: TaskAction['type']) => {
  switch (type) {
    case 'task_created':
      return <CheckSquare className="w-5 h-5 text-blue-400" />;
    case 'task_completed':
      return <Award className="w-5 h-5 text-green-400" />;
    case 'task_submitted':
      return <Users className="w-5 h-5 text-purple-400" />;
    case 'task_expired':
      return <Clock className="w-5 h-5 text-orange-400" />;
    case 'task_cancelled':
      return <XCircle className="w-5 h-5 text-red-400" />;
    case 'points_awarded':
      return <Award className="w-5 h-5 text-yellow-400" />;
  }
};

const getActionColor = (type: TaskAction['type']) => {
  switch (type) {
    case 'task_created':
      return 'border-blue-500/30 bg-blue-500/10';
    case 'task_completed':
      return 'border-green-500/30 bg-green-500/10';
    case 'task_submitted':
      return 'border-purple-500/30 bg-purple-500/10';
    case 'task_expired':
      return 'border-orange-500/30 bg-orange-500/10';
    case 'task_cancelled':
      return 'border-red-500/30 bg-red-500/10';
    case 'points_awarded':
      return 'border-yellow-500/30 bg-yellow-500/10';
  }
};

const getStatusColor = (status: TaskAction['status']) => {
  switch (status) {
    case 'completed':
      return 'bg-green-500/20 text-green-400';
    case 'pending':
      return 'bg-yellow-500/20 text-yellow-400';
    case 'expired':
      return 'bg-orange-500/20 text-orange-400';
    case 'cancelled':
      return 'bg-red-500/20 text-red-400';
    case 'failed':
      return 'bg-red-500/20 text-red-400';
  }
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export function TaskHistory() {
  const totalTasks = mockTaskData.filter(task => task.type === 'task_created').length;
  const completedTasks = mockTaskData.filter(task => task.status === 'completed').length;
  const totalPrizePool = mockTaskData
    .filter(task => task.type === 'task_created')
    .reduce((sum, task) => sum + (task.prizePool || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-black/50 border border-white/10 rounded-xl p-4">
        <div className="grid grid-cols-1 gap-4">
          <div className="text-center p-3 bg-black/20 rounded-lg border border-zinc-700">
            <h3 className="text-xl font-bold text-white mb-1">{totalTasks}</h3>
            <p className="text-zinc-400 text-xs">Total Tasks</p>
          </div>
          <div className="text-center p-3 bg-black/20 rounded-lg border border-zinc-700">
            <h3 className="text-xl font-bold text-green-400 mb-1">{completedTasks}</h3>
            <p className="text-zinc-400 text-xs">Completed</p>
          </div>
          <div className="text-center p-3 bg-black/20 rounded-lg border border-zinc-700">
            <h3 className="text-xl font-bold text-blue-400 mb-1">${totalPrizePool.toFixed(2)}</h3>
            <p className="text-zinc-400 text-xs">Total Prize Pool</p>
          </div>
        </div>
      </div>

      {/* Task Actions */}
      <div className="space-y-4">
        {mockTaskData.map((task, index) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`bg-black/50 border border-white/10 rounded-xl p-4 ${getActionColor(task.type)}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  {getActionIcon(task.type)}
                  <div>
                    <h3 className="text-white font-semibold">{task.description}</h3>
                    <p className="text-zinc-400 text-sm">{task.taskName}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-zinc-400">Date:</span>
                    <p className="text-white">{formatDate(task.date)}</p>
                  </div>
                  {task.participantCount && (
                    <div>
                      <span className="text-zinc-400">Participants:</span>
                      <p className="text-white">{task.participantCount}</p>
                    </div>
                  )}
                  {task.winnerCount && (
                    <div>
                      <span className="text-zinc-400">Winners:</span>
                      <p className="text-white">{task.winnerCount}</p>
                    </div>
                  )}
                  {task.prizePool && (
                    <div>
                      <span className="text-zinc-400">Prize Pool:</span>
                      <p className="text-white">${task.prizePool.toFixed(2)}</p>
                    </div>
                  )}
                </div>

                {task.pointsAwarded && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Points Awarded:</span>
                      <span className="text-yellow-400 text-lg font-bold">+{task.pointsAwarded}</span>
                    </div>
                  </div>
                )}

                {task.expiryDate && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-zinc-400" />
                      <span className="text-zinc-400 text-sm">Expires: {formatDate(task.expiryDate)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-right ml-4">
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                  {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Empty State */}
      {mockTaskData.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-12"
        >
          <CheckSquare className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Task History</h3>
          <p className="text-zinc-400">You haven't created or participated in any tasks yet.</p>
        </motion.div>
      )}
    </div>
  );
} 