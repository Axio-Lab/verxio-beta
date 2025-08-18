'use client';

import { motion } from 'framer-motion';
import { CreditCard, CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react';

interface PaymentTransaction {
  id: string;
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  date: string;
  description: string;
  paymentMethod: string;
  transactionId: string;
  loyaltyDiscount?: number;
  finalAmount?: number;
}

const mockPaymentData: PaymentTransaction[] = [
  {
    id: 'PAY_001',
    amount: 150.00,
    status: 'completed',
    date: '2024-08-08T14:30:00Z',
    description: 'Product purchase - Premium Package',
    paymentMethod: 'Credit Card',
    transactionId: 'TXN_123456789',
    loyaltyDiscount: 15,
    finalAmount: 127.50
  },
  {
    id: 'PAY_002',
    amount: 75.50,
    status: 'pending',
    date: '2024-08-08T12:15:00Z',
    description: 'Service subscription renewal',
    paymentMethod: 'Bank Transfer',
    transactionId: 'TXN_123456790'
  },
  {
    id: 'PAY_003',
    amount: 200.00,
    status: 'failed',
    date: '2024-08-08T10:45:00Z',
    description: 'Large order payment',
    paymentMethod: 'Credit Card',
    transactionId: 'TXN_123456791'
  },
  {
    id: 'PAY_004',
    amount: 45.99,
    status: 'completed',
    date: '2024-08-07T16:20:00Z',
    description: 'Digital product download',
    paymentMethod: 'PayPal',
    transactionId: 'TXN_123456792'
  }
];

const getStatusIcon = (status: PaymentTransaction['status']) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-5 h-5 text-green-400" />;
    case 'pending':
      return <Clock className="w-5 h-5 text-yellow-400" />;
    case 'failed':
      return <XCircle className="w-5 h-5 text-red-400" />;
  }
};

const getStatusColor = (status: PaymentTransaction['status']) => {
  switch (status) {
    case 'completed':
      return 'border-green-500/30 bg-green-500/10';
    case 'pending':
      return 'border-yellow-500/30 bg-yellow-500/10';
    case 'failed':
      return 'border-red-500/30 bg-red-500/10';
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

export function PaymentHistory() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-black/50 border border-white/10 rounded-xl p-4">
        <div className="text-center mb-4">
          <h2 className="text-lg font-bold text-white mb-2">Payment History</h2>
          <p className="text-zinc-400 text-sm">Track all your payment transactions</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-white">
            ${mockPaymentData.reduce((sum, tx) => sum + (tx.status === 'completed' ? tx.amount : 0), 0).toFixed(2)}
          </p>
          <p className="text-zinc-400 text-sm">Total Completed</p>
        </div>
      </div>

      {/* Transactions */}
      <div className="space-y-4">
        {mockPaymentData.map((transaction, index) => (
          <motion.div
            key={transaction.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`bg-black/50 border border-white/10 rounded-xl p-4 ${getStatusColor(transaction.status)}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  {getStatusIcon(transaction.status)}
                  <div>
                    <h3 className="text-white font-semibold">{transaction.description}</h3>
                    <p className="text-zinc-400 text-sm">{transaction.paymentMethod}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-zinc-400">Transaction ID:</span>
                    <p className="text-white font-mono">{transaction.transactionId}</p>
                  </div>
                  <div>
                    <span className="text-zinc-400">Date:</span>
                    <p className="text-white">{formatDate(transaction.date)}</p>
                  </div>
                  <div>
                    <span className="text-zinc-400">Amount:</span>
                    <p className="text-white">${transaction.amount.toFixed(2)}</p>
                  </div>
                  {transaction.loyaltyDiscount && (
                    <div>
                      <span className="text-zinc-400">Loyalty Discount:</span>
                      <p className="text-green-400">-{transaction.loyaltyDiscount}%</p>
                    </div>
                  )}
                </div>

                {transaction.finalAmount && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Final Amount:</span>
                      <span className="text-white text-lg font-bold">${transaction.finalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-right ml-4">
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                  transaction.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                  transaction.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {getStatusIcon(transaction.status)}
                  {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Empty State */}
      {mockPaymentData.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-12"
        >
          <CreditCard className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Payment History</h3>
          <p className="text-zinc-400">You haven't made any payments yet.</p>
        </motion.div>
      )}
    </div>
  );
} 