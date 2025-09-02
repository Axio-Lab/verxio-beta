'use server'

import { prisma } from '@/lib/prisma';
import { getUserVerxioCreditBalance, awardOrRevokeLoyaltyPoints } from './verxio-credit';

export interface CreateTaskData {
  creatorAddress: string;
  taskName: string;
  taskDescription: string;
  submissionInstructions: string;
  image?: string;
  prizePool: number;
  numberOfWinners: number;
  maxParticipants: number;
  pointsPerAction: number;
  prizeSplits: string[];
  expiryDate: string;
}

export interface CreateTaskResult {
  success: boolean;
  task?: {
    id: string;
    taskName: string;
    status: string;
  };
  error?: string;
  requiredCredits?: number;
  currentBalance?: number;
}

export const createTask = async (data: CreateTaskData): Promise<CreateTaskResult> => {
  try {
    const {
      creatorAddress,
      taskName,
      taskDescription,
      submissionInstructions,
      image,
      prizePool,
      numberOfWinners,
      maxParticipants,
      pointsPerAction,
      prizeSplits,
      expiryDate
    } = data;

    // Validate required fields
    if (!creatorAddress || !taskName || !taskDescription || !submissionInstructions) {
      return {
        success: false,
        error: 'Missing required fields'
      };
    }

    // Calculate required credits
    const participantCredits = maxParticipants * pointsPerAction;
    const taskCreationCost = 1000; // Fixed cost for creating a task
    const totalRequiredCredits = participantCredits + taskCreationCost;

    // Get user's current Verxio credit balance
    const userCredits = await getUserVerxioCreditBalance(creatorAddress);
    
    if (!userCredits.success) {
      return {
        success: false,
        error: 'Failed to fetch user credits',
        requiredCredits: totalRequiredCredits,
        currentBalance: 0
      };
    }

    const currentBalance = userCredits.balance || 0;

    // Check if user has enough credits
    if (currentBalance < totalRequiredCredits) {
      return {
        success: false,
        error: `Insufficient Verxio credits. Required: ${totalRequiredCredits}, Available: ${currentBalance}`,
        requiredCredits: totalRequiredCredits,
        currentBalance: currentBalance
      };
    }

    // Create the task in database
    const task = await prisma.task.create({
      data: {
        creatorAddress,
        taskName,
        taskDescription,
        submissionInstructions,
        image,
        prizePool,
        numberOfWinners,
        maxParticipants,
        pointsPerAction,
        prizeSplits,
        expiryDate: new Date(expiryDate),
        status: 'ACTIVE'
      }
    });

    // Deduct the required credits from user's balance
    const deductionResult = await awardOrRevokeLoyaltyPoints({
      creatorAddress,
      points: totalRequiredCredits,
      assetAddress: task.id,
      assetOwner: creatorAddress,
      action: 'REVOKE' // REVOKE = deduct credits
    });

    if (!deductionResult.success) {
      // If credit deduction fails, delete the task and return error
      await prisma.task.delete({
        where: { id: task.id }
      });
      
      return {
        success: false,
        error: 'Failed to deduct credits. Task creation cancelled.',
        requiredCredits: totalRequiredCredits,
        currentBalance: currentBalance
      };
    }

    return {
      success: true,
      task: {
        id: task.id,
        taskName: task.taskName,
        status: task.status
      }
    };

  } catch (error: any) {
    console.error('Error creating task:', error);
    return {
      success: false,
      error: error.message || 'Failed to create task'
    };
  }
};

export const getUserTasks = async (creatorAddress: string) => {
  try {
    const tasks = await prisma.task.findMany({
      where: {
        creatorAddress
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        taskName: true,
        taskDescription: true,
        prizePool: true,
        numberOfWinners: true,
        maxParticipants: true,
        totalParticipants: true,
        status: true,
        expiryDate: true,
        createdAt: true
      }
    });

    return {
      success: true,
      tasks
    };
  } catch (error: any) {
    console.error('Error fetching user tasks:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch tasks'
    };
  }
};

export const getTaskById = async (taskId: string) => {
  try {
    const task = await prisma.task.findUnique({
      where: {
        id: taskId
      },
      include: {
        participations: {
          orderBy: {
            submittedAt: 'desc'
          }
        },
        winners: {
          orderBy: {
            position: 'asc'
          }
        }
      }
    });

    if (!task) {
      return {
        success: false,
        error: 'Task not found'
      };
    }

    return {
      success: true,
      task
    };
  } catch (error: any) {
    console.error('Error fetching task:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch task'
    };
  }
};

// Submit task participation
export interface SubmitTaskData {
  taskId: string;
  participantAddress: string;
  submissionData?: string;
  submissionUrl?: string;
}

export interface SubmitTaskResult {
  success: boolean;
  participation?: {
    id: string;
    status: string;
  };
  error?: string;
}

export const submitTaskParticipation = async (data: SubmitTaskData): Promise<SubmitTaskResult> => {
  try {
    const { taskId, participantAddress, submissionData, submissionUrl } = data;

    // Validate required fields
    if (!taskId || !participantAddress) {
      return {
        success: false,
        error: 'Task ID and participant address are required'
      };
    }

    // Check if task exists and is active
    const task = await prisma.task.findUnique({
      where: { id: taskId }
    });

    if (!task) {
      return {
        success: false,
        error: 'Task not found'
      };
    }

    if (task.status !== 'ACTIVE') {
      return {
        success: false,
        error: 'Task is not active for submissions'
      };
    }

    // Check if task has expired
    if (new Date() > task.expiryDate) {
      return {
        success: false,
        error: 'Task has expired'
      };
    }

    // Check if participant has already submitted
    const existingParticipation = await prisma.taskParticipation.findUnique({
      where: {
        taskId_participantAddress: {
          taskId,
          participantAddress
        }
      }
    });

    if (existingParticipation) {
      return {
        success: false,
        error: 'You have already submitted for this task'
      };
    }

    // Check if task has reached max participants
    const currentParticipants = await prisma.taskParticipation.count({
      where: { taskId }
    });

    if (currentParticipants >= task.maxParticipants) {
      return {
        success: false,
        error: 'Task has reached maximum participants'
      };
    }

    // Create participation
    const participation = await prisma.taskParticipation.create({
      data: {
        taskId,
        participantAddress,
        submissionData,
        submissionUrl,
        status: 'SUBMITTED'
      }
    });

    // Update task participant count
    await prisma.task.update({
      where: { id: taskId },
      data: {
        totalParticipants: { increment: 1 }
      }
    });

    return {
      success: true,
      participation: {
        id: participation.id,
        status: participation.status
      }
    };

  } catch (error: any) {
    console.error('Error submitting task participation:', error);
    return {
      success: false,
      error: error.message || 'Failed to submit task participation'
    };
  }
};

// Get user's task participations
export const getUserTaskParticipations = async (participantAddress: string) => {
  try {
    const participations = await prisma.taskParticipation.findMany({
      where: {
        participantAddress
      },
      include: {
        task: {
          select: {
            id: true,
            taskName: true,
            taskDescription: true,
            prizePool: true,
            numberOfWinners: true,
            status: true,
            expiryDate: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        submittedAt: 'desc'
      }
    });

    return {
      success: true,
      participations
    };
  } catch (error: any) {
    console.error('Error fetching user task participations:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch task participations'
    };
  }
};

// Get task participations for creator
export const getTaskParticipations = async (taskId: string, creatorAddress: string) => {
  try {
    // Verify creator owns the task
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        creatorAddress
      }
    });

    if (!task) {
      return {
        success: false,
        error: 'Task not found or you are not the creator'
      };
    }

    const participations = await prisma.taskParticipation.findMany({
      where: {
        taskId
      },
      orderBy: {
        submittedAt: 'desc'
      }
    });

    return {
      success: true,
      participations
    };
  } catch (error: any) {
    console.error('Error fetching task participations:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch task participations'
    };
  }
};

// Select task winners
export interface SelectWinnersData {
  taskId: string;
  creatorAddress: string;
  winners: {
    participantAddress: string;
    position: number;
  }[];
}

export interface SelectWinnersResult {
  success: boolean;
  winners?: any[];
  error?: string;
}

export const selectTaskWinners = async (data: SelectWinnersData): Promise<SelectWinnersResult> => {
  try {
    const { taskId, creatorAddress, winners } = data;

    // Verify creator owns the task
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        creatorAddress
      }
    });

    if (!task) {
      return {
        success: false,
        error: 'Task not found or you are not the creator'
      };
    }

    // Check if task is still active
    if (task.status !== 'ACTIVE') {
      return {
        success: false,
        error: 'Task is not active for winner selection'
      };
    }

    // Validate winners data
    if (!winners || winners.length === 0) {
      return {
        success: false,
        error: 'At least one winner must be selected'
      };
    }

    if (winners.length > task.numberOfWinners) {
      return {
        success: false,
        error: `Cannot select more than ${task.numberOfWinners} winners`
      };
    }

    // Validate positions are unique and within range
    const positions = winners.map(w => w.position);
    const uniquePositions = [...new Set(positions)];
    if (positions.length !== uniquePositions.length) {
      return {
        success: false,
        error: 'Winner positions must be unique'
      };
    }

    if (Math.min(...positions) < 1 || Math.max(...positions) > task.numberOfWinners) {
      return {
        success: false,
        error: `Winner positions must be between 1 and ${task.numberOfWinners}`
      };
    }

    // Verify all participants exist
    const participantAddresses = winners.map(w => w.participantAddress);
    const existingParticipants = await prisma.taskParticipation.findMany({
      where: {
        taskId,
        participantAddress: { in: participantAddresses }
      }
    });

    if (existingParticipants.length !== participantAddresses.length) {
      return {
        success: false,
        error: 'Some selected participants have not submitted to this task'
      };
    }

    // Create winner records and automatically distribute prizes
    const winnerRecords = await Promise.all(
      winners.map(async (winner) => {
        const position = winner.position;
        const prizeAmount = parseFloat(task.prizeSplits[position - 1]) || 0;

        // Create winner record
        const winnerRecord = await prisma.taskWinner.create({
          data: {
            taskId,
            winnerAddress: winner.participantAddress,
            position,
            prizeAmount,
            status: 'DISTRIBUTED', // Automatically marked as distributed
            claimedAt: new Date() // Set as distributed immediately
          }
        });

        // Award Verxio credits to the winner (automatic distribution)
        try {
          await awardOrRevokeLoyaltyPoints({
            creatorAddress: creatorAddress,
            points: Math.floor(prizeAmount * 100), // Convert USD to Verxio credits (1 USD = 100 credits)
            assetAddress: taskId,
            assetOwner: winner.participantAddress,
            action: 'AWARD' // AWARD = give credits to the winner
          });
        } catch (creditError) {
          console.error('Error awarding credits to winner:', creditError);
          // Don't fail the entire process if credit awarding fails
        }

        return winnerRecord;
      })
    );

    // Update task status to completed
    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'COMPLETED' }
    });

    return {
      success: true,
      winners: winnerRecords
    };

  } catch (error: any) {
    console.error('Error selecting task winners:', error);
    return {
      success: false,
      error: error.message || 'Failed to select task winners'
    };
  }
};

// Get task winners
export const getTaskWinners = async (taskId: string) => {
  try {
    const winners = await prisma.taskWinner.findMany({
      where: {
        taskId
      },
      orderBy: {
        position: 'asc'
      }
    });

    return {
      success: true,
      winners
    };
  } catch (error: any) {
    console.error('Error fetching task winners:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch task winners'
    };
  }
};

// Get all tasks (for browsing)
export const getAllTasks = async (limit: number = 20, offset: number = 0) => {
  try {
    const tasks = await prisma.task.findMany({
      where: {
        status: 'ACTIVE'
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset,
      select: {
        id: true,
        taskName: true,
        taskDescription: true,
        prizePool: true,
        numberOfWinners: true,
        maxParticipants: true,
        totalParticipants: true,
        pointsPerAction: true,
        expiryDate: true,
        createdAt: true,
        image: true
      }
    });

    return {
      success: true,
      tasks
    };
  } catch (error: any) {
    console.error('Error fetching all tasks:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch tasks'
    };
  }
};

// Get user's won prizes (automatically distributed)
export const getUserWonPrizes = async (winnerAddress: string) => {
  try {
    const wonPrizes = await prisma.taskWinner.findMany({
      where: {
        winnerAddress
      },
      include: {
        task: {
          select: {
            id: true,
            taskName: true,
            taskDescription: true,
            prizePool: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        selectedAt: 'desc'
      }
    });

    return {
      success: true,
      wonPrizes
    };
  } catch (error: any) {
    console.error('Error fetching user won prizes:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch won prizes'
    };
  }
};

// Get task prize distribution statistics (for creators)
export const getTaskPrizeStats = async (taskId: string, creatorAddress: string) => {
  try {
    // Verify creator owns the task
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        creatorAddress
      }
    });

    if (!task) {
      return {
        success: false,
        error: 'Task not found or you are not the creator'
      };
    }

    // Get prize distribution statistics
    const totalWinners = await prisma.taskWinner.count({
      where: { taskId }
    });

    const totalPrizeAmount = await prisma.taskWinner.aggregate({
      where: { taskId },
      _sum: {
        prizeAmount: true
      }
    });

    const averagePrize = totalWinners > 0 ? (totalPrizeAmount._sum.prizeAmount || 0) / totalWinners : 0;

    return {
      success: true,
      stats: {
        totalWinners,
        totalPrizeAmount: totalPrizeAmount._sum.prizeAmount || 0,
        averagePrize,
        originalPrizePool: task.prizePool,
        distributionComplete: totalWinners > 0
      }
    };
  } catch (error: any) {
    console.error('Error fetching task prize stats:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch prize statistics'
    };
  }
};
