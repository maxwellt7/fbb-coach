import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Program, WorkoutLog, WorkoutSet, ChatMessage, UserStats, PersonalRecord, Conversation } from '../types';
import { calcVolume } from '../types';
import * as syncApi from '../services/api';

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

  // Conversations (Chat History)
  conversations: Conversation[];
  activeConversationId: string | null;
  chatMessages: ChatMessage[]; // Derived from active conversation
  createConversation: () => string;
  switchConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  addChatMessage: (role: 'user' | 'assistant', content: string) => void;
  clearChatHistory: () => void;

  // Stats
  getStats: () => UserStats;
  getPersonalRecords: () => PersonalRecord[];

  // Data Export/Import
  exportData: () => string;
  importData: (jsonString: string) => boolean;

  // Sync
  syncEnabled: boolean;
  isSyncing: boolean;
  lastSynced: string | null;
  syncError: string | null;
  initSync: () => Promise<void>;
  syncToServer: () => Promise<void>;
  syncFromServer: () => Promise<void>;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Programs
      programs: [],
      activeProgram: null,

      setActiveProgram: (program) => {
        set({ activeProgram: program });
        // Sync active program to server
        if (get().syncEnabled) {
          syncApi.setActiveProgram(program?.id || null).catch(console.error);
        }
      },

      addProgram: (programData) => {
        const newProgram: Program = {
          ...programData,
          id: uuidv4(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({ programs: [...state.programs, newProgram] }));
        // Sync to server
        if (get().syncEnabled) {
          syncApi.saveProgram(newProgram).catch(console.error);
        }
        return newProgram;
      },

      updateProgram: (id, updates) => {
        set((state) => ({
          programs: state.programs.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
          ),
        }));
        // Sync updated program to server
        if (get().syncEnabled) {
          const program = get().programs.find((p) => p.id === id);
          if (program) {
            syncApi.saveProgram(program).catch(console.error);
          }
        }
      },

      deleteProgram: (id) => {
        set((state) => ({
          programs: state.programs.filter((p) => p.id !== id),
          activeProgram: state.activeProgram?.id === id ? null : state.activeProgram,
        }));
        // Sync deletion to server
        if (get().syncEnabled) {
          syncApi.deleteProgram(id).catch(console.error);
        }
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
        const { currentWorkout, syncEnabled } = get();
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

        // Sync completed workout to server
        if (syncEnabled) {
          syncApi.saveWorkout(completedWorkout).catch(console.error);
        }
      },

      cancelWorkout: () => {
        set({ currentWorkout: null });
      },

      // Conversations (Chat History)
      conversations: [],
      activeConversationId: null,
      chatMessages: [], // Derived from active conversation

      createConversation: () => {
        const now = new Date().toISOString();
        const newConversation: Conversation = {
          id: uuidv4(),
          title: 'New Chat',
          messages: [],
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          conversations: [newConversation, ...state.conversations],
          activeConversationId: newConversation.id,
          chatMessages: [],
        }));
        return newConversation.id;
      },

      switchConversation: (id) => {
        const conversation = get().conversations.find((c) => c.id === id);
        if (conversation) {
          set({
            activeConversationId: id,
            chatMessages: conversation.messages,
          });
        }
      },

      deleteConversation: (id) => {
        set((state) => {
          const newConversations = state.conversations.filter((c) => c.id !== id);
          const wasActive = state.activeConversationId === id;
          return {
            conversations: newConversations,
            activeConversationId: wasActive
              ? newConversations[0]?.id || null
              : state.activeConversationId,
            chatMessages: wasActive
              ? newConversations[0]?.messages || []
              : state.chatMessages,
          };
        });
      },

      renameConversation: (id, title) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, title, updatedAt: new Date().toISOString() } : c
          ),
        }));
      },

      addChatMessage: (role, content) => {
        const { activeConversationId, conversations } = get();
        
        // Create a new conversation if none exists
        let conversationId = activeConversationId;
        if (!conversationId) {
          conversationId = get().createConversation();
        }

        const message: ChatMessage = {
          id: uuidv4(),
          role,
          content,
          timestamp: new Date().toISOString(),
        };

        set((state) => {
          const updatedConversations = state.conversations.map((c) => {
            if (c.id === conversationId) {
              const updatedMessages = [...c.messages, message];
              // Auto-title based on first user message
              const newTitle =
                c.title === 'New Chat' && role === 'user'
                  ? content.slice(0, 40) + (content.length > 40 ? '...' : '')
                  : c.title;
              return {
                ...c,
                title: newTitle,
                messages: updatedMessages,
                updatedAt: new Date().toISOString(),
              };
            }
            return c;
          });

          return {
            conversations: updatedConversations,
            chatMessages: [...state.chatMessages, message],
          };
        });
      },

      clearChatHistory: () => {
        const { activeConversationId } = get();
        if (!activeConversationId) return;

        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === activeConversationId
              ? { ...c, messages: [], updatedAt: new Date().toISOString() }
              : c
          ),
          chatMessages: [],
        }));
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
          version: 2,
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
          if (!data.programs || !data.workoutLogs) {
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

      // Sync state and functions
      syncEnabled: false,
      isSyncing: false,
      lastSynced: null,
      syncError: null,

      initSync: async () => {
        try {
          const available = await syncApi.isSyncAvailable();
          if (!available) {
            set({ syncEnabled: false, syncError: null });
            return;
          }

          set({ syncEnabled: true, isSyncing: true, syncError: null });

          // Fetch data from server
          const serverData = await syncApi.fetchSyncData();

          if (serverData) {
            const localState = get();
            const hasLocalData =
              localState.programs.length > 0 || localState.workoutLogs.length > 0;
            const hasServerData =
              serverData.programs.length > 0 || serverData.workouts.length > 0;

            if (hasServerData && !hasLocalData) {
              // Server has data but local is empty - use server data
              set({
                programs: serverData.programs,
                activeProgram: serverData.activeProgram,
                workoutLogs: serverData.workouts,
                chatMessages: serverData.chatMessages || [],
                lastSynced: new Date().toISOString(),
                isSyncing: false,
              });
            } else if (hasLocalData && !hasServerData) {
              // Local has data but server is empty - push to server
              await syncApi.pushSyncData({
                programs: localState.programs,
                workouts: localState.workoutLogs,
                activeProgram: localState.activeProgram,
              });
              set({
                lastSynced: new Date().toISOString(),
                isSyncing: false,
              });
            } else if (hasLocalData && hasServerData) {
              // Both have data - merge (prefer most recent)
              const mergedPrograms = mergeData(
                localState.programs,
                serverData.programs,
                'updatedAt'
              );
              const mergedWorkouts = mergeData(
                localState.workoutLogs,
                serverData.workouts,
                'date'
              );

              set({
                programs: mergedPrograms,
                workoutLogs: mergedWorkouts,
                activeProgram: serverData.activeProgram || localState.activeProgram,
                lastSynced: new Date().toISOString(),
                isSyncing: false,
              });

              // Push merged data to server
              await syncApi.pushSyncData({
                programs: mergedPrograms,
                workouts: mergedWorkouts,
                activeProgram: serverData.activeProgram || localState.activeProgram,
              });
            } else {
              // Neither have data
              set({ lastSynced: new Date().toISOString(), isSyncing: false });
            }
          } else {
            set({ isSyncing: false });
          }
        } catch (error) {
          console.error('Sync init error:', error);
          set({
            syncEnabled: false,
            isSyncing: false,
            syncError: 'Failed to initialize sync',
          });
        }
      },

      syncToServer: async () => {
        const { syncEnabled, isSyncing, programs, workoutLogs, activeProgram } = get();
        if (!syncEnabled || isSyncing) return;

        set({ isSyncing: true, syncError: null });
        try {
          await syncApi.pushSyncData({ programs, workouts: workoutLogs, activeProgram });
          set({ lastSynced: new Date().toISOString(), isSyncing: false });
        } catch (error) {
          console.error('Sync to server error:', error);
          set({ syncError: 'Failed to sync to server', isSyncing: false });
        }
      },

      syncFromServer: async () => {
        const { syncEnabled, isSyncing } = get();
        if (!syncEnabled || isSyncing) return;

        set({ isSyncing: true, syncError: null });
        try {
          const serverData = await syncApi.fetchSyncData();
          if (serverData) {
            set({
              programs: serverData.programs,
              activeProgram: serverData.activeProgram,
              workoutLogs: serverData.workouts,
              chatMessages: serverData.chatMessages || [],
              lastSynced: new Date().toISOString(),
              isSyncing: false,
            });
          } else {
            set({ isSyncing: false });
          }
        } catch (error) {
          console.error('Sync from server error:', error);
          set({ syncError: 'Failed to sync from server', isSyncing: false });
        }
      },
    }),
    {
      name: 'fbb-coach-storage',
      partialize: (state) => ({
        programs: state.programs,
        activeProgram: state.activeProgram,
        workoutLogs: state.workoutLogs,
        conversations: state.conversations,
        activeConversationId: state.activeConversationId,
        currentWorkout: state.currentWorkout,
        // Don't persist sync state or derived chatMessages
      }),
      onRehydrate: () => (state) => {
        // Restore chatMessages from active conversation after rehydration
        if (state && state.activeConversationId) {
          const conversation = state.conversations.find(
            (c) => c.id === state.activeConversationId
          );
          if (conversation) {
            state.chatMessages = conversation.messages;
          }
        }
      },
    }
  )
);

// Helper function to merge data by ID, preferring most recent
function mergeData<T extends { id: string }>(
  local: T[],
  remote: T[],
  dateField: keyof T
): T[] {
  const merged = new Map<string, T>();

  // Add all remote items first
  for (const item of remote) {
    merged.set(item.id, item);
  }

  // Override with local items if they're more recent
  for (const item of local) {
    const existing = merged.get(item.id);
    if (!existing) {
      merged.set(item.id, item);
    } else {
      const localDate = new Date(item[dateField] as string).getTime();
      const remoteDate = new Date(existing[dateField] as string).getTime();
      if (localDate > remoteDate) {
        merged.set(item.id, item);
      }
    }
  }

  return Array.from(merged.values());
}
