'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';
import { getAllTasks } from '@/app/actions/task';
import { useRouter } from 'next/navigation';

export default function TaskBrowsePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await getAllTasks(50, 0);
        if (res.success && res.tasks) setTasks(res.tasks as any[]);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  return (
    <AppLayout currentPage="dashboard">
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center mb-2">
          <h1 className="text-2xl font-bold text-white">Tasks</h1>
          <p className="text-white/60 text-sm">Find tasks to participate</p>
        </div>

        <Card className="bg-gradient-to-br from-gray-900/90 via-black/80 to-gray-900/90 border border-white/10 text-white overflow-hidden relative">
          <CardHeader className="relative z-10 pb-3">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg text-white font-semibold">Available Tasks</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="relative z-10 pt-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <VerxioLoaderWhite size="md" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-8 text-white/60">No active tasks</div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => router.push(`/task/${task.id}`)}
                    className="w-full bg-gradient-to-br from-white/8 to-white/3 border border-white/15 rounded-lg hover:border-white/25 hover:bg-white/10 transition-all duration-300 hover:scale-105 backdrop-blur-sm text-left overflow-hidden"
                  >
                    {task.image && (
                      <div className="w-full h-32 overflow-hidden">
                        <img
                          src={task.image}
                          alt={task.taskName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm font-medium text-white">{task.taskName}</div>
                        <div className="text-xs text-blue-400 font-medium">${task.prizePool}</div>
                      </div>
                      <div className="text-xs text-white/60">
                        {task.totalParticipants} / {task.maxParticipants} participants • Ends {new Date(task.expiryDate).toLocaleString()}
                      </div>
                    </div>
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


