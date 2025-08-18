'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Wallet, Calendar, DollarSign, ArrowUpRight, Clock, CheckCircle, XCircle } from 'lucide-react';

interface WithdrawalTransaction {
  id: string;
  amount: number;
  date: string;
  status: 'completed' | 'pending' | 'failed';
  method: 'bank' | 'crypto' | 'paypal';
  reference: string;
}

const mockWithdrawalTransactions: WithdrawalTransaction[] = [
  {
    id: '1',
    amount: 250.00,
    date: '2024-01-15',
    status: 'completed',
    method: 'bank',
    reference: 'WD_001'
  },
  {
    id: '2',
    amount: 100.00,
    date: '2024-01-12',
    status: 'pending',
    method: 'crypto',
    reference: 'WD_002'
  },
  {
    id: '3',
    amount: 75.50,
    date: '2024-01-10',
    status: 'failed',
    method: 'paypal',
    reference: 'WD_003'
  }
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'text-green-400 bg-green-400/10 border-green-400/20';
    case 'pending':
      return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
    case 'failed':
      return 'text-red-400 bg-red-400/10 border-red-400/20';
    default:
      return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-400" />;
    case 'pending':
      return <Clock className="w-4 h-4 text-yellow-400" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-400" />;
    default:
      return <Clock className="w-4 h-4 text-gray-400" />;
  }
};

const getMethodIcon = (method: string) => {
  switch (method) {
    case 'bank':
      return <Wallet className="w-4 h-4 text-blue-400" />;
    case 'crypto':
      return <ArrowUpRight className="w-4 h-4 text-purple-400" />;
    case 'paypal':
      return <Wallet className="w-4 h-4 text-green-400" />;
    default:
      return <Wallet className="w-4 h-4 text-gray-400" />;
  }
};

export function WithdrawalHistory() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg flex-shrink-0">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-zinc-400">Total Completed</p>
              <p className="text-xl font-bold text-white truncate">$1,250</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg flex-shrink-0">
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-zinc-400">Pending</p>
              <p className="text-xl font-bold text-white truncate">$100</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg flex-shrink-0">
              <XCircle className="w-5 h-5 text-red-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-zinc-400">Failed</p>
              <p className="text-xl font-bold text-white truncate">$75.50</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Transactions List */}
      <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Recent Withdrawals</h3>
        </div>
        
        <div className="divide-y divide-white/10">
          {mockWithdrawalTransactions.map((transaction, index) => (
            <motion.div
              key={transaction.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-4 hover:bg-white/5 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex-shrink-0">
                    {getMethodIcon(transaction.method)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-medium text-white capitalize truncate">{transaction.method} Withdrawal</h4>
                    <p className="text-sm text-zinc-400 truncate">Ref: {transaction.reference}</p>
                  </div>
                </div>
                
                <div className="text-right min-w-0">
                  <div className="flex items-center gap-2 justify-end">
                    {getStatusIcon(transaction.status)}
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(transaction.status)}`}>
                      {transaction.status}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-400 mt-1 flex items-center justify-end gap-1">
                    <Calendar className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{transaction.date}</span>
                  </p>
                </div>
              </div>
              
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-4 text-sm text-zinc-400">
                  <span className="capitalize truncate">{transaction.method}</span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <DollarSign className="w-4 h-4 text-white" />
                  <span className="font-semibold text-white">
                    ${transaction.amount.toFixed(2)}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
} 