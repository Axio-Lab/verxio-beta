'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/app-layout';
import { HistoryTabs } from '@/components/layout/history/history-tabs';
import { PaymentHistory } from '@/components/layout/history/payment-history';
import { LoyaltyHistory } from '@/components/layout/history/loyalty-history';
import { TaskHistory } from '@/components/layout/history/task-history';
import { ProductHistory } from '@/components/layout/history/product-history';
import { WithdrawalHistory } from '@/components/layout/history/withdrawal-history';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';

export type HistoryTab = 'payment' | 'loyalty' | 'task' | 'product' | 'withdrawal';

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState<HistoryTab>('payment');
  const [isLoading, setIsLoading] = useState(true);

  // Show loading for a brief moment to prevent blank screen
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleTabChange = (tab: HistoryTab) => {
    setActiveTab(tab);
  };

  const renderActiveTab = () => {
    console.log('HistoryPage: Rendering tab:', activeTab);
    switch (activeTab) {
      case 'payment':
        return <PaymentHistory />;
      case 'loyalty':
        return <LoyaltyHistory />;
      case 'task':
        return <TaskHistory />;
      case 'product':
        return <ProductHistory />;
      case 'withdrawal':
        return <WithdrawalHistory />;
      default:
        return <PaymentHistory />;
    }
  };

  if (isLoading) {
    return (
      <AppLayout currentPage="history">
        <div className="w-full flex items-center justify-center min-h-[calc(100vh-200px)]">
          <div className="text-center">
            <VerxioLoaderWhite size="md" />
            <p className="text-white mt-4 text-lg">Loading History...</p>
            <p className="text-zinc-400 text-sm mt-2">Please wait while we fetch your transaction history</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPage="history">
      <div className="max-w-md mx-auto space-y-6 pt-10 pb-8 px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <h1 className="text-2xl font-bold text-white mb-2">Transaction History</h1>
          <p className="text-zinc-400 text-sm">
            Track all your payments, loyalty actions, tasks, and more
          </p>
        </motion.div>

        {/* Tabs */}
        <HistoryTabs activeTab={activeTab} onTabChange={handleTabChange} />

        {/* Tab Content */}
        <div className="mt-6">
          {renderActiveTab()}
        </div>
      </div>
    </AppLayout>
  );
} 