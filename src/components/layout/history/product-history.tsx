'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Package, Calendar, DollarSign, Tag } from 'lucide-react';

interface ProductTransaction {
  id: string;
  productName: string;
  type: 'purchase' | 'refund' | 'exchange';
  amount: number;
  date: string;
  status: 'completed' | 'pending' | 'cancelled';
  productId: string;
}

const mockProductTransactions: ProductTransaction[] = [
  {
    id: '1',
    productName: 'Premium Widget',
    type: 'purchase',
    amount: 99.99,
    date: '2024-01-15',
    status: 'completed',
    productId: 'PROD_001'
  },
  {
    id: '2',
    productName: 'Standard Gadget',
    type: 'refund',
    amount: 49.99,
    date: '2024-01-10',
    status: 'completed',
    productId: 'PROD_002'
  },
  {
    id: '3',
    productName: 'Deluxe Tool Kit',
    type: 'exchange',
    amount: 149.99,
    date: '2024-01-05',
    status: 'pending',
    productId: 'PROD_003'
  }
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'text-green-400 bg-green-400/10 border-green-400/20';
    case 'pending':
      return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
    case 'cancelled':
      return 'text-red-400 bg-red-400/10 border-red-400/20';
    default:
      return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
  }
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'purchase':
      return <Package className="w-4 h-4 text-blue-400" />;
    case 'refund':
      return <Tag className="w-4 h-4 text-green-400" />;
    case 'exchange':
      return <Package className="w-4 h-4 text-purple-400" />;
    default:
      return <Package className="w-4 h-4 text-gray-400" />;
  }
};

export function ProductHistory() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Summary Cards */}
      <div className="bg-black/50 border border-white/10 rounded-xl p-4">
        <div className="grid grid-cols-1 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Package className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Total Purchases</p>
              <p className="text-xl font-bold text-white">24</p>
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
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Tag className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Total Refunds</p>
              <p className="text-xl font-bold text-white">3</p>
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
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Package className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Total Exchanges</p>
              <p className="text-xl font-bold text-white">2</p>
            </div>
          </div>
        </motion.div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-black/50 border border-white/10 rounded-xl p-4">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white text-center">Recent Product Transactions</h3>
        </div>
        
        <div className="divide-y divide-white/10">
          {mockProductTransactions.map((transaction, index) => (
            <motion.div
              key={transaction.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-4 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getTypeIcon(transaction.type)}
                  <div>
                    <h4 className="font-medium text-white">{transaction.productName}</h4>
                    <p className="text-sm text-zinc-400">ID: {transaction.productId}</p>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(transaction.status)}`}>
                      {transaction.status}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-400 mt-1">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    {transaction.date}
                  </p>
                </div>
              </div>
              
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-zinc-400">
                  <span className="capitalize">{transaction.type}</span>
                </div>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  <span className="font-semibold text-white">
                    {transaction.type === 'refund' ? '-' : '+'}${transaction.amount.toFixed(2)}
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