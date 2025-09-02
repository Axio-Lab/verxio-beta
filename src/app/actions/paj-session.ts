// 'use server'

// import { initiate, verify } from 'paj_ramp';
// import { prisma } from '@/lib/prisma';

// export interface InitiateSessionData {
//   email: string;
// }

// export interface InitiateSessionResult {
//   success: boolean;
//   data?: {
//     email: string;
//   };
//   error?: string;
// }

// export interface VerifySessionData {
//   email: string;
//   otp: string;
//   uuid: string;
//   device: string;
// }

// export interface VerifySessionResult {
//   success: boolean;
//   data?: {
//     email: string;
//     isActive: string;
//     expiresAt: string;
//     token: string;
//   };
//   error?: string;
// }

// export interface SessionStatus {
//   success: boolean;
//   isActive: boolean;
//   token?: string;
//   error?: string;
// }

// // Initiate PAJ Ramp session
// export const initiateSession = async (data: InitiateSessionData): Promise<InitiateSessionResult> => {
//   try {
//     const { email } = data;

//     if (!email) {
//       return {
//         success: false,
//         error: 'Email is required'
//       };
//     }

//     const businessApiKey = process.env.PAJ_RAMP_BUSINESS_API_KEY;
//     if (!businessApiKey) {
//       return {
//         success: false,
//         error: 'PAJ Ramp API key not configured'
//       };
//     }

//     // Call PAJ Ramp initiate function
//     const result = await initiate(email, businessApiKey);

//     // Create or update session record with null values initially
//     await prisma.pajRampSession.upsert({
//       where: { email },
//       update: {
//         // Reset all fields to null when initiating new session
//         isActive: null,
//         expiresAt: null,
//         token: null,
//         uuid: null,
//         device: null,
//         os: null,
//         browser: null,
//         ip: null,
//         updatedAt: new Date()
//       },
//       create: {
//         email,
//         isActive: null,
//         expiresAt: null,
//         token: null,
//         uuid: null,
//         device: null,
//         os: null,
//         browser: null,
//         ip: null
//       }
//     });

//     return {
//       success: true,
//       data: result
//     };

//   } catch (error: any) {
//     console.error('Error initiating PAJ Ramp session:', error);
//     return {
//       success: false,
//       error: error.message || 'Failed to initiate session'
//     };
//   }
// };

// // Verify PAJ Ramp session
// export const verifySession = async (data: VerifySessionData): Promise<VerifySessionResult> => {
//   try {
//     const { email, otp, uuid, device } = data;

//     if (!email || !otp || !uuid || !device) {
//       return {
//         success: false,
//         error: 'Email, OTP, UUID, and device are required'
//       };
//     }

//     const businessApiKey = process.env.PAJ_RAMP_BUSINESS_API_KEY;
//     if (!businessApiKey) {
//       return {
//         success: false,
//         error: 'PAJ Ramp API key not configured'
//       };
//     }

//     // Prepare device info for PAJ Ramp
//     const deviceInfo = {
//       uuid,
//       device
//     };

//     // Call PAJ Ramp verify function
//     const result = await verify(email, otp, deviceInfo, businessApiKey);

//     // Update session record with verification data
//     await prisma.pajRampSession.upsert({
//       where: { email },
//       update: {
//         isActive: result.isActive,
//         expiresAt: result.expiresAt,
//         token: result.token,
//         uuid,
//         device,
//         os: null,
//         browser: null,
//         ip: null,
//         updatedAt: new Date()
//       },
//       create: {
//         email,
//         isActive: result.isActive,
//         expiresAt: result.expiresAt,
//         token: result.token,
//         uuid,
//         device,
//         os: null,
//         browser: null,
//         ip: null
//       }
//     });

//     return {
//       success: true,
//       data: result
//     };

//   } catch (error: any) {
//     console.error('Error verifying PAJ Ramp session:', error);
//     return {
//       success: false,
//       error: error.message || 'Failed to verify session'
//     };
//   }
// };

// // Check if user has an active PAJ Ramp session
// export const checkSessionStatus = async (email: string): Promise<SessionStatus> => {
//   try {
//     if (!email) {
//       return {
//         success: false,
//         isActive: false,
//         error: 'Email is required'
//       };
//     }

//     const session = await prisma.pajRampSession.findUnique({
//       where: { email },
//       select: {
//         isActive: true,
//         expiresAt: true,
//         token: true
//       }
//     });

//     if (!session) {
//       return {
//         success: true,
//         isActive: false
//       };
//     }

//     // Check if session is active and not expired
//     const isActive = session.isActive === 'true' || session.isActive === true;
    
//     // Check expiration if expiresAt is provided
//     let isExpired = false;
//     if (session.expiresAt) {
//       const expirationDate = new Date(session.expiresAt);
//       isExpired = expirationDate < new Date();
//     }

//     return {
//       success: true,
//       isActive: isActive && !isExpired,
//       token: (isActive && !isExpired) ? session.token : undefined
//     };

//   } catch (error: any) {
//     console.error('Error checking session status:', error);
//     return {
//       success: false,
//       isActive: false,
//       error: error.message || 'Failed to check session status'
//     };
//   }
// };

// // Helper function to get device information for existing session
// export const getDeviceInfo = async (email: string, userAgent?: string): Promise<{
//   uuid: string;
//   device: string;
// } | null> => {
//   try {
//     // Get existing session to use its ID as UUID
//     const session = await prisma.pajRampSession.findUnique({
//       where: { email },
//       select: {
//         id: true,
//         device: true
//       }
//     });

//     if (!session) {
//       return null;
//     }

//     // Generate device identifier from user agent if provided
//     let deviceId = session.device;
//     if (!deviceId) {
//       if (userAgent) {
//         // Create device identifier from user agent
//         const deviceHash = userAgent.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '');
//         deviceId = `web-${deviceHash}-${Date.now()}`;
//       } else {
//         deviceId = `web-${Date.now()}`;
//       }
//     }

//     return {
//       uuid: session.id, // Use existing database ID as UUID
//       device: deviceId
//     };
//   } catch (error) {
//     console.error('Error getting device info:', error);
//     return null;
//   }
// };
