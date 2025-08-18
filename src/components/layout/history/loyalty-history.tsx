'use client';

import { motion } from 'framer-motion';
import { Star, Plus, Minus, Gift, Crown, Award, UserCheck, UserX } from 'lucide-react';

interface LoyaltyAction {
  id: string;
  type: 'program_created' | 'points_awarded' | 'points_revoked' | 'pass_issued' | 'pass_revoked' | 'tier_upgraded' | 'tier_downgraded';
  date: string;
  description: string;
  points?: number;
  programName: string;
  tier?: string;
  status: 'success' | 'pending' | 'failed';
  userId?: string;
  reason?: string;
}

const mockLoyaltyData: LoyaltyAction[] = [
  {
    id: 'LOY_001',
    type: 'program_created',
    date: '2024-08-08T15:00:00Z',
    description: 'Created new loyalty program',
    programName: 'Premium Rewards',
    status: 'success'
  },
  {
    id: 'LOY_002',
    type: 'points_awarded',
    date: '2024-08-08T14:30:00Z',
    description: 'Awarded points for purchase',
    points: 150,
    programName: 'Premium Rewards',
    tier: 'Gold',
    status: 'success',
    userId: 'USER_123'
  },
  {
    id: 'LOY_003',
    type: 'pass_issued',
    date: '2024-08-08T13:15:00Z',
    description: 'Issued loyalty pass to new member',
    programName: 'Premium Rewards',
    tier: 'Silver',
    status: 'success',
    userId: 'USER_456'
  },
  {
    id: 'LOY_004',
    type: 'points_revoked',
    date: '2024-08-08T12:00:00Z',
    description: 'Revoked points due to refund',
    points: -75,
    programName: 'Premium Rewards',
    tier: 'Gold',
    status: 'success',
    userId: 'USER_789',
    reason: 'Product return'
  },
  {
    id: 'LOY_005',
    type: 'tier_upgraded',
    date: '2024-08-07T16:45:00Z',
    description: 'Member upgraded to Gold tier',
    programName: 'Premium Rewards',
    tier: 'Gold',
    status: 'success',
    userId: 'USER_123'
  },
  {
    id: 'LOY_006',
    type: 'pass_revoked',
    date: '2024-08-07T14:20:00Z',
    description: 'Revoked loyalty pass',
    programName: 'Premium Rewards',
    tier: 'Bronze',
    status: 'success',
    userId: 'USER_999',
    reason: 'Terms violation'
  },
  {
    id: 'LOY_007',
    type: 'points_awarded',
    date: '2024-08-07T11:30:00Z',
    description: 'Awarded points for referral',
    points: 200,
    programName: 'Premium Rewards',
    tier: 'Silver',
    status: 'pending',
    userId: 'USER_456'
  }
];

const getActionIcon = (type: LoyaltyAction['type']) => {
  switch (type) {
    case 'program_created':
      return <Star className="w-5 h-5 text-blue-400" />;
    case 'points_awarded':
      return <Plus className="w-5 h-5 text-green-400" />;
    case 'points_revoked':
      return <Minus className="w-5 h-5 text-red-400" />;
    case 'pass_issued':
      return <Gift className="w-5 h-5 text-purple-400" />;
    case 'pass_revoked':
      return <UserX className="w-5 h-5 text-red-400" />;
    case 'tier_upgraded':
      return <Crown className="w-5 h-5 text-yellow-400" />;
    case 'tier_downgraded':
      return <Award className="w-5 h-5 text-orange-400" />;
  }
};

const getActionColor = (type: LoyaltyAction['type']) => {
  switch (type) {
    case 'program_created':
      return 'border-blue-500/30 bg-blue-500/10';
    case 'points_awarded':
      return 'border-green-500/30 bg-green-500/10';
    case 'points_revoked':
      return 'border-red-500/30 bg-red-500/10';
    case 'pass_issued':
      return 'border-purple-500/30 bg-purple-500/10';
    case 'pass_revoked':
      return 'border-red-500/30 bg-red-500/10';
    case 'tier_upgraded':
      return 'border-yellow-500/30 bg-yellow-500/10';
    case 'tier_downgraded':
      return 'border-orange-500/30 bg-orange-500/10';
  }
};

const getStatusColor = (status: LoyaltyAction['status']) => {
  switch (status) {
    case 'success':
      return 'bg-green-500/20 text-green-400';
    case 'pending':
      return 'bg-yellow-500/20 text-yellow-400';
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

export function LoyaltyHistory() {
  const totalPointsAwarded = mockLoyaltyData
    .filter(action => action.type === 'points_awarded' && action.status === 'success')
    .reduce((sum, action) => sum + (action.points || 0), 0);

  const totalPointsRevoked = mockLoyaltyData
    .filter(action => action.type === 'points_revoked' && action.status === 'success')
    .reduce((sum, action) => sum + Math.abs(action.points || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-black/50 border border-white/10 rounded-xl p-4">
        <div className="grid grid-cols-1 gap-4">
          <div className="text-center p-3 bg-black/20 rounded-lg border border-zinc-700">
            <h3 className="text-xl font-bold text-white mb-1">{mockLoyaltyData.length}</h3>
            <p className="text-zinc-400 text-xs">Total Actions</p>
          </div>
          <div className="text-center p-3 bg-black/20 rounded-lg border border-zinc-700">
            <h3 className="text-xl font-bold text-green-400 mb-1">+{totalPointsAwarded}</h3>
            <p className="text-zinc-400 text-xs">Points Awarded</p>
          </div>
          <div className="text-center p-3 bg-black/20 rounded-lg border border-zinc-700">
            <h3 className="text-xl font-bold text-red-400 mb-1">-{totalPointsRevoked}</h3>
            <p className="text-zinc-400 text-xs">Points Revoked</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-4">
        {mockLoyaltyData.map((action, index) => (
          <motion.div
            key={action.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`bg-black/50 border border-white/10 rounded-xl p-4 ${getActionColor(action.type)}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  {getActionIcon(action.type)}
                  <div>
                    <h3 className="text-white font-semibold">{action.description}</h3>
                    <p className="text-zinc-400 text-sm">{action.programName}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-zinc-400">Date:</span>
                    <p className="text-white">{formatDate(action.date)}</p>
                  </div>
                  {action.tier && (
                    <div>
                      <span className="text-zinc-400">Tier:</span>
                      <p className="text-white">{action.tier}</p>
                    </div>
                  )}
                  {action.points && (
                    <div>
                      <span className="text-zinc-400">Points:</span>
                      <p className={`font-semibold ${action.points > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {action.points > 0 ? '+' : ''}{action.points}
                      </p>
                    </div>
                  )}
                  {action.userId && (
                    <div>
                      <span className="text-zinc-400">User ID:</span>
                      <p className="text-white font-mono">{action.userId}</p>
                    </div>
                  )}
                </div>

                {action.reason && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <span className="text-zinc-400 text-sm">Reason: </span>
                    <span className="text-white text-sm">{action.reason}</span>
                  </div>
                )}
              </div>

              <div className="text-right ml-4">
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(action.status)}`}>
                  {action.status.charAt(0).toUpperCase() + action.status.slice(1)}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Empty State */}
      {mockLoyaltyData.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-12"
        >
          <Star className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Loyalty History</h3>
          <p className="text-zinc-400">You haven't performed any loyalty actions yet.</p>
        </motion.div>
      )}
    </div>
  );
} 