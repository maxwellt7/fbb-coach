import axios from 'axios';
import type { ChatMessage } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
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
}

export interface GeneratedProgram {
  name: string;
  description: string;
  workoutDays: {
    name: string;
    dayOfWeek: number;
    exercises: {
      exerciseName: string;
      setNumber: number;
      targetReps: number;
      targetWeight: number;
    }[];
  }[];
}

export async function generateProgram(params: GenerateProgramParams): Promise<GeneratedProgram> {
  try {
    const response = await api.post('/api/generate-program', params);
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
  services: { openai: boolean; pinecone: boolean; cohere: boolean; notion: boolean };
}> {
  const response = await api.get('/api/health');
  return response.data;
}

export default api;
