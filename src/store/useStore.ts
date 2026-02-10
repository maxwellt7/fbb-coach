import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Program, WorkoutLog, WorkoutSet, ChatMessage, UserStats, PersonalRecord } from '../types';
import { calcVolume } from '../types';

interface AppState {
  // Programs
  programs: Program[];
  activeProgram: Program | null;
  setActiveProgram: (program: Program | null) => void;
  addProgram: (program: Omit<Program, 'id' | 'createdAt' | 'updatedAt'>) => Program;
  updateProgram: (id: string, updates: Partial<Program>) => void;
  deleteProgram: (id: string) => void;

  // Workout Logs
  workoutLogs: WorkoutLog[];
  currentWorkout: WorkoutLog | null;
  startWorkout: (programId?: string, workoutDayId?: string, sets?: WorkoutSet[]) => void;
  updateCurrentWorkout: (updates: Partial<WorkoutLog>) => void;
  completeSet: (setId: string, actualReps: number, actualWeight: number, rpe?: number) => void;
  uncompleteSet: (setId: string) => void;
  finishWorkout: (notes?: string, rating?: number) => void;
  cancelWorkout: () => void;

  // Chat History
  chatMessages: ChatMessage[];
  addChatMessage: (role: 'user' | 'assistant', content: string) => void;
  clearChatHistory: () => void;

  // Stats
  getStats: () => UserStats;
  getPersonalRecords: () => PersonalRecord[];

  // Data Export/Import
  exportData: () => string;
  importData: (jsonString: string) => boolean;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Programs
      programs: [],
      activeProgram: null,

      setActiveProgram: (program) => set({ activeProgram: program }),

      addProgram: (programData) => {
        const newProgram: Program = {
          ...programData,
          id: uuidv4(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({ programs: [...state.programs, newProgram] }));
        return newProgram;
      },

      updateProgram: (id, updates) => {
        set((state) => ({
          programs: state.programs.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
          ),
        }));
      },

      deleteProgram: (id) => {
        set((state) => ({
          programs: state.programs.filter((p) => p.id !== id),
          activeProgram: state.activeProgram?.id === id ? null : state.activeProgram,
        }));
      },

      // Workout Logs
      workoutLogs: [],
      currentWorkout: null,

      startWorkout: (programId, workoutDayId, sets = []) => {
        const workout: WorkoutLog = {
          id: uuidv4(),
          programId,
          workoutDayId,
          date: new Date().toISOString(),
          duration: 0,
          sets: sets.map((s) => ({ ...s, id: uuidv4(), completed: false })),
          completed: false,
        };
        set({ currentWorkout: workout });
      },

      updateCurrentWorkout: (updates) => {
        set((state) => ({
          currentWorkout: state.currentWorkout
            ? { ...state.currentWorkout, ...updates }
            : null,
        }));
      },

      completeSet: (setId, actualReps, actualWeight, rpe) => {
        set((state) => ({
          currentWorkout: state.currentWorkout
            ? {
                ...state.currentWorkout,
                sets: state.currentWorkout.sets.map((s) =>
                  s.id === setId
                    ? { ...s, actualReps, actualWeight, rpe, completed: true }
                    : s
                ),
              }
            : null,
        }));
      },

      uncompleteSet: (setId) => {
        set((state) => ({
          currentWorkout: state.currentWorkout
            ? {
                ...state.currentWorkout,
                sets: state.currentWorkout.sets.map((s) =>
                  s.id === setId
                    ? { ...s, completed: false }
                    : s
                ),
              }
            : null,
        }));
      },

      finishWorkout: (notes, rating) => {
        const { currentWorkout } = get();
        if (!currentWorkout) return;

        const completedWorkout: WorkoutLog = {
          ...currentWorkout,
          notes,
          rating,
          completed: true,
          duration: Math.round(
            (Date.now() - new Date(currentWorkout.date).getTime()) / 60000
          ),
        };

        set((state) => ({
          workoutLogs: [...state.workoutLogs, completedWorkout],
          currentWorkout: null,
        }));
      },

      cancelWorkout: () => {
        set({ currentWorkout: null });
      },

      // Chat History
      chatMessages: [],

      addChatMessage: (role, content) => {
        const message: ChatMessage = {
          id: uuidv4(),
          role,
          content,
          timestamp: new Date().toISOString(),
        };
        set((state) => ({
          chatMessages: [...state.chatMessages, message],
        }));
      },

      clearChatHistory: () => {
        set({ chatMessages: [] });
      },

      // Stats
      getStats: () => {
        const { workoutLogs } = get();
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Calculate streak
        const sortedLogs = [...workoutLogs]
          .filter((l) => l.completed)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;
        let lastDate: Date | null = null;

        for (const log of sortedLogs) {
          const logDate = new Date(log.date);
          logDate.setHours(0, 0, 0, 0);

          if (!lastDate) {
            tempStreak = 1;
            lastDate = logDate;
          } else {
            const diffDays = Math.round(
              (lastDate.getTime() - logDate.getTime()) / (24 * 60 * 60 * 1000)
            );
            if (diffDays <= 2) {
              tempStreak++;
            } else {
              longestStreak = Math.max(longestStreak, tempStreak);
              tempStreak = 1;
            }
            lastDate = logDate;
          }
        }
        longestStreak = Math.max(longestStreak, tempStreak);
        currentStreak = tempStreak;

        // Calculate total volume
        const totalVolume = workoutLogs.reduce(
          (acc, log) => acc + calcVolume(log.sets),
          0
        );

        // Weekly workouts
        const weeklyWorkouts = workoutLogs.filter(
          (l) => l.completed && new Date(l.date) >= oneWeekAgo
        ).length;

        return {
          totalWorkouts: workoutLogs.filter((l) => l.completed).length,
          totalVolume,
          currentStreak,
          longestStreak,
          weeklyWorkouts,
          personalRecords: get().getPersonalRecords(),
        };
      },

      getPersonalRecords: () => {
        const { workoutLogs } = get();
        const prMap = new Map<string, PersonalRecord>();

        for (const log of workoutLogs) {
          for (const set of log.sets) {
            if (!set.completed || !set.actualWeight || !set.actualReps) continue;

            const key = set.exerciseName;
            const existing = prMap.get(key);
            const volume = set.actualWeight * set.actualReps;

            if (!existing || volume > existing.weight * existing.reps) {
              prMap.set(key, {
                exerciseId: set.exerciseId,
                exerciseName: set.exerciseName,
                weight: set.actualWeight,
                reps: set.actualReps,
                date: log.date,
              });
            }
          }
        }

        return Array.from(prMap.values());
      },

      // Data Export/Import
      exportData: () => {
        const { programs, activeProgram, workoutLogs, chatMessages } = get();
        return JSON.stringify({
          version: 1,
          exportedAt: new Date().toISOString(),
          programs,
          activeProgram,
          workoutLogs,
          chatMessages,
        }, null, 2);
      },

      importData: (jsonString: string) => {
        try {
          const data = JSON.parse(jsonString);
          if (!data.version || !data.programs || !data.workoutLogs) {
            return false;
          }
          set({
            programs: data.programs || [],
            activeProgram: data.activeProgram || null,
            workoutLogs: data.workoutLogs || [],
            chatMessages: data.chatMessages || [],
          });
          return true;
        } catch {
          return false;
        }
      },
    }),
    {
      name: 'fbb-coach-storage',
    }
  )
);
