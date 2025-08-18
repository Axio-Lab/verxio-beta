'use client';

import { CreditCard, Star, CheckSquare, Package, Wallet } from 'lucide-react';
import { HistoryTab } from '@/app/history/page';

interface HistoryTabsProps {
  activeTab: HistoryTab;
  onTabChange: (tab: HistoryTab) => void;
}

const tabs = [
  {
    id: 'payment' as HistoryTab,
    label: 'Payments',
    icon: CreditCard,
    description: 'Payment transactions'
  },
  {
    id: 'loyalty' as HistoryTab,
    label: 'Loyalty',
    icon: Star,
    description: 'Loyalty actions & points'
  },
  {
    id: 'task' as HistoryTab,
    label: 'Tasks',
    icon: CheckSquare,
    description: 'Task completions'
  },
  {
    id: 'product' as HistoryTab,
    label: 'Products',
    icon: Package,
    description: 'Product purchases'
  },
  {
    id: 'withdrawal' as HistoryTab,
    label: 'Withdrawals',
    icon: Wallet,
    description: 'Fund withdrawals'
  }
];

export function HistoryTabs({ activeTab, onTabChange }: HistoryTabsProps) {
  console.log('HistoryTabs rendered with activeTab:', activeTab);
  
  const handleTabClick = (tabId: HistoryTab) => {
    console.log('HistoryTabs: Tab clicked:', tabId);
    console.log('HistoryTabs: Current activeTab:', activeTab);
    console.log('HistoryTabs: Calling onTabChange with:', tabId);
    onTabChange(tabId);
    console.log('HistoryTabs: onTabChange called');
  };
  
  return (
    <div className="bg-black/50 border border-white/10 rounded-xl p-4">
      <div className="flex flex-wrap justify-center gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200 cursor-pointer text-sm pointer-events-auto ${
                isActive
                  ? 'bg-gradient-to-r from-[#0088c1] to-[#005a7a] border-[#0088c1] text-white shadow-lg shadow-[#0088c1]/25'
                  : 'bg-black/20 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
} 