// 'use client';

// import { useState, useEffect } from 'react';
// import { AppLayout } from '@/components/layout/app-layout';
// import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { CreditCard, User, Calendar, Star, ArrowLeft } from 'lucide-react';
// import { useRouter } from 'next/navigation';

// export default function LoyaltyPasses() {
//   const [isLoading, setIsLoading] = useState(true);
//   const router = useRouter();

//   useEffect(() => {
//     // Show loader for a brief moment
//     const timer = setTimeout(() => {
//       setIsLoading(false);
//     }, 800);
//     return () => clearTimeout(timer);
//   }, []);

//   const handleBack = () => {
//     router.back();
//   };

//   if (isLoading) {
//     return (
//       <AppLayout currentPage="dashboard">
//         <div className="w-full flex items-center justify-center min-h-[calc(100vh-200px)]">
//           <VerxioLoaderWhite size="md" />
//         </div>
//       </AppLayout>
//     );
//   }

//   return (
//     <AppLayout currentPage="dashboard">
//       <div className="max-w-md mx-auto space-y-6">
//         {/* Header */}
//         <div className="flex items-center space-x-3">
//           <button 
//             onClick={handleBack}
//             className="p-2 border border-white/20 rounded-lg hover:bg-white/10 transition-colors text-white"
//           >
//             <ArrowLeft className="w-5 h-5" />
//           </button>
//           <div>
//             <h1 className="text-2xl font-bold text-white">Loyalty Passes</h1>
//             <p className="text-gray-400">View all issued loyalty passes</p>
//           </div>
//         </div>

//         {/* Stats */}
//         <Card className="bg-black/50 border-white/10 text-white">
//           <CardContent className="pt-6">
//             <div className="grid grid-cols-3 gap-4 text-center">
//               <div>
//                 <div className="text-2xl font-bold text-white">24</div>
//                 <div className="text-xs text-gray-300">Total Passes</div>
//               </div>
//               <div>
//                 <div className="text-2xl font-bold text-green-400">18</div>
//                 <div className="text-xs text-gray-300">Active</div>
//               </div>
//               <div>
//                 <div className="text-2xl font-bold text-blue-400">6</div>
//                 <div className="text-xs text-gray-300">Expired</div>
//               </div>
//             </div>
//           </CardContent>
//         </Card>

//         {/* Loyalty Passes List */}
//         <Card className="bg-black/50 border-white/10 text-white">
//           <CardHeader>
//             <CardTitle className="text-lg text-white">Recent Passes</CardTitle>
//           </CardHeader>
//           <CardContent>
//             <div className="space-y-3">
//               {/* Sample Pass 1 */}
//               <div className="p-4 border border-white/10 rounded-lg bg-white/5">
//                 <div className="flex items-center justify-between mb-3">
//                   <div className="flex items-center space-x-3">
//                     <div className="w-10 h-10 bg-gradient-to-br from-orange-600 to-orange-800 rounded-lg flex items-center justify-center">
//                       <CreditCard className="w-6 h-6 text-white" />
//                     </div>
//                     <div>
//                       <div className="text-sm font-medium text-white">Coffee Rewards</div>
//                       <div className="text-xs text-gray-300">Bronze Tier</div>
//                     </div>
//                   </div>
//                   <div className="text-right">
//                     <div className="text-xs text-green-400 font-medium">Active</div>
//                     <div className="text-xs text-gray-400">Expires: Dec 2024</div>
//                   </div>
//                 </div>
                
//                 <div className="flex items-center justify-between text-xs text-gray-300">
//                   <div className="flex items-center space-x-1">
//                     <User className="w-3 h-3" />
//                     <span>john.doe@email.com</span>
//                   </div>
//                   <div className="flex items-center space-x-1">
//                     <Star className="w-3 h-3" />
//                     <span>250 points</span>
//                   </div>
//                 </div>
//               </div>

//               {/* Sample Pass 2 */}
//               <div className="p-4 border border-white/10 rounded-lg bg-white/5">
//                 <div className="flex items-center justify-between mb-3">
//                   <div className="flex items-center space-x-3">
//                     <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg flex items-center justify-center">
//                       <CreditCard className="w-6 h-6 text-white" />
//                     </div>
//                     <div>
//                       <div className="text-sm font-medium text-white">Fitness Club</div>
//                       <div className="text-xs text-gray-300">Silver Tier</div>
//                     </div>
//                   </div>
//                   <div className="text-right">
//                     <div className="text-xs text-green-400 font-medium">Active</div>
//                     <div className="text-xs text-gray-400">Expires: Jan 2025</div>
//                   </div>
//                 </div>
                
//                 <div className="flex items-center justify-between text-xs text-gray-300">
//                   <div className="flex items-center space-x-1">
//                     <User className="w-3 h-3" />
//                     <span>sarah.smith@email.com</span>
//                   </div>
//                   <div className="flex items-center space-x-1">
//                     <Star className="w-3 h-3" />
//                     <span>750 points</span>
//                   </div>
//                 </div>
//               </div>

//               {/* Empty State */}
//               <div className="text-center py-8 text-gray-400">
//                 <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
//                 <p className="text-sm">No loyalty passes yet</p>
//                 <p className="text-xs">Create loyalty programs to start issuing passes</p>
//               </div>
//             </div>
//           </CardContent>
//         </Card>
//       </div>
//     </AppLayout>
//   );
// }
