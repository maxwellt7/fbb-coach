import axios from 'axios';
import type { ChatMessage, Program, WorkoutLog } from '../types';

const API_URL = import.meta.env.VITE_API_URL || '';

// Generate or retrieve device ID for authentication
function getDeviceId(): string {
  const storageKey = 'fbb-device-id';
  let deviceId = localStorage.getItem(storageKey);
  if (!deviceId) {
    deviceId = 'device-' + crypto.randomUUID();
    localStorage.setItem(storageKey, deviceId);
  }
  return deviceId;
}

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000,
});

// Add device ID to all requests
api.interceptors.request.use((config) => {
  config.headers['X-Device-Id'] = getDeviceId();
  return config;
});

export async function sendMessage(
  message: string,
  context: {
    stats?: {
      totalWorkouts: number;
      currentStreak: number;
      weeklyWorkouts: number;
      personalRecords?: { exerciseName: string; weight: number; reps: number }[];
    };
    activeProgram?: string;
    recentWorkouts?: { date: string; setsCompleted: number; duration: number }[];
  },
  chatHistory: ChatMessage[]
): Promise<string> {
  try {
    const response = await api.post('/api/chat', {
      message,
      context,
      chatHistory: chatHistory.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });
    return response.data.response;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

export async function searchKnowledgeBase(query: string): Promise<string[]> {
  try {
    const response = await api.post('/api/search', { query });
    return response.data.results;
  } catch (error) {
    console.error('Search Error:', error);
    throw error;
  }
}

export interface GenerateProgramParams {
  goal: string;
  daysPerWeek: number;
  experienceLevel: string;
  equipment: string[];
  trainingStyle?: string;
  injuries?: string;
}

export interface GeneratedProgram {
  name: string;
  description: string;
  programOverview?: {
    goal: string;
    style: string;
    level: string;
    cycleLength: string;
    frequency: string;
  };
  workoutDays: {
    name: string;
    dayOfWeek: number;
    weekNumber?: number;
    dayNumber?: number;
    exercises: {
      exerciseName: string;
      setNumber: number;
      targetReps: number;
      targetWeight: number;
      sets?: number;
      reps?: string;
      tempo?: string;
      intensity?: string;
      rest?: string;
      notes?: string;
    }[];
  }[];
}

export async function generateProgram(params: GenerateProgramParams): Promise<GeneratedProgram> {
  try {
    const response = await api.post('/api/generate-program', params, { timeout: 180000 });
    return response.data.program;
  } catch (error) {
    console.error('Generate Program Error:', error);
    throw error;
  }
}

export interface UserProfile {
  [key: string]: string | number | boolean | string[] | null;
}

export async function fetchUserProfile(): Promise<UserProfile | null> {
  try {
    const response = await api.get('/api/profile');
    return response.data.profile;
  } catch {
    return null;
  }
}

export interface NotionWorkout {
  id: string;
  created: string;
  [key: string]: string | number | boolean | string[] | null;
}

export async function fetchNotionWorkouts(limit = 20): Promise<NotionWorkout[]> {
  try {
    const response = await api.get(`/api/notion-workouts?limit=${limit}`);
    return response.data.workouts;
  } catch {
    return [];
  }
}

export async function checkHealth(): Promise<{
  status: string;
  services: { openai: boolean; pinecone: boolean; cohere: boolean; notion: boolean; database: boolean };
}> {
  const response = await api.get('/api/health');
  return response.data;
}

// ============ SYNC API ============

export interface SyncData {
  user: { id: string };
  programs: Program[];
  activeProgram: Program | null;
  workouts: WorkoutLog[];
  chatMessages: ChatMessage[];
}

// Fetch all data from server
export async function fetchSyncData(): Promise<SyncData | null> {
  try {
    const response = await api.get('/api/sync/all');
    return response.data;
  } catch (error) {
    console.error('Fetch sync data error:', error);
    return null;
  }
}

// Push all data to server
export async function pushSyncData(data: {
  programs: Program[];
  workouts: WorkoutLog[];
  activeProgram: Program | null;
}): Promise<boolean> {
  try {
    await api.post('/api/sync/all', data);
    return true;
  } catch (error) {
    console.error('Push sync data error:', error);
    return false;
  }
}

// Save a single program
export async function saveProgram(program: Program): Promise<boolean> {
  try {
    await api.post('/api/sync/programs', { program });
    return true;
  } catch (error) {
    console.error('Save program error:', error);
    return false;
  }
}

// Delete a program
export async function deleteProgram(programId: string): Promise<boolean> {
  try {
    await api.delete(`/api/sync/programs/${programId}`);
    return true;
  } catch (error) {
    console.error('Delete program error:', error);
    return false;
  }
}

// Set active program
export async function setActiveProgram(programId: string | null): Promise<boolean> {
  try {
    await api.post('/api/sync/programs/active', { programId });
    return true;
  } catch (error) {
    console.error('Set active program error:', error);
    return false;
  }
}

// Save a workout log
export async function saveWorkout(workout: WorkoutLog): Promise<boolean> {
  try {
    await api.post('/api/sync/workouts', { workout });
    return true;
  } catch (error) {
    console.error('Save workout error:', error);
    return false;
  }
}

// Check if sync is available
export async function isSyncAvailable(): Promise<boolean> {
  try {
    const health = await checkHealth();
    return health.services.database === true;
  } catch {
    return false;
  }
}

export default api;
