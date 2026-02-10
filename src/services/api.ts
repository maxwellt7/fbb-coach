import axios from 'axios';
import type { ChatMessage } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function sendMessage(
  message: string,
  context: {
    stats?: object;
    activeProgram?: string;
    recentWorkouts?: object[];
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

export async function generateProgram(params: {
  goal: string;
  daysPerWeek: number;
  experienceLevel: string;
  equipment: string[];
}): Promise<object> {
  try {
    const response = await api.post('/api/generate-program', params);
    return response.data.program;
  } catch (error) {
    console.error('Generate Program Error:', error);
    throw error;
  }
}

export default api;
