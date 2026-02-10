import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { CohereClient } from 'cohere-ai';
import { Client as NotionClient } from '@notionhq/client';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// --- Security Middleware ---
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
}));

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.FRONTEND_URL || 'http://localhost:5173']
  : ['http://localhost:5173', 'http://localhost:3001'];

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// --- Initialize OpenAI ---
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// --- Initialize Cohere ---
let cohere = null;
if (process.env.COHERE_API_KEY) {
  cohere = new CohereClient({ token: process.env.COHERE_API_KEY });
  console.log('Cohere initialized successfully');
}

// --- Initialize Pinecone ---
let pineconeIndex = null;
if (process.env.PINECONE_API_KEY) {
  try {
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    pineconeIndex = pinecone.index(process.env.PINECONE_INDEX || 'fitness-programming');
    console.log('Pinecone initialized successfully');
  } catch (error) {
    console.log('Pinecone not configured or error:', error.message);
  }
}

// --- Initialize Notion ---
let notion = null;
if (process.env.NOTION_API_KEY) {
  notion = new NotionClient({ auth: process.env.NOTION_API_KEY });
  console.log('Notion initialized successfully');
}

const NOTION_CLIENT_DB_ID = process.env.NOTION_CLIENT_DB_ID;
const NOTION_WORKOUT_TRACKER_DB_ID = process.env.NOTION_WORKOUT_TRACKER_DB_ID;

// --- System Prompt ---
const SYSTEM_PROMPT = `You are FBB Coach, an expert AI fitness coach specializing in bodybuilding, powerlifting, and general strength training. You have deep knowledge in:

- Exercise science and biomechanics
- Program design (periodization, volume management, exercise selection)
- Nutrition for muscle building and fat loss
- Recovery and injury prevention
- Training techniques and form cues

Your communication style is:
- Knowledgeable but approachable
- Concise and actionable
- Evidence-based when possible
- Encouraging but realistic

When asked about programs or exercises:
- Provide specific set/rep schemes
- Include rest period recommendations
- Explain the reasoning behind your recommendations
- Consider the user's experience level and goals

When the user provides their workout data (stats, recent workouts, active program), use this information to give personalized advice. If user profile data is available, tailor recommendations to their specific metrics and goals.

Always prioritize safety and proper form over ego lifting.`;

// --- Fitness Knowledge Base (fallback) ---
const FITNESS_KNOWLEDGE = {
  hypertrophy: `Hypertrophy training focuses on muscle growth through moderate weights (60-80% 1RM) and higher volume (8-12 reps, 3-5 sets). Key principles:
- Time under tension: 30-60 seconds per set
- Progressive overload: Increase weight or reps over time
- Adequate volume: 10-20 sets per muscle group per week
- Rest periods: 60-90 seconds between sets
- Mind-muscle connection for optimal fiber recruitment`,

  strength: `Strength training prioritizes force production with heavy loads (80-95% 1RM) and lower reps (1-5). Key principles:
- Compound movements: Squat, Bench, Deadlift, Overhead Press
- Longer rest periods: 3-5 minutes for neural recovery
- Lower volume per session, higher frequency
- Progressive overload through weight increases
- Focus on technique under heavy loads`,

  periodization: `Periodization is systematic planning of training phases:
- Linear: Gradual increase in intensity, decrease in volume
- Undulating: Daily or weekly variation in intensity/volume
- Block: Concentrated training blocks (accumulation, transmutation, realization)
- Deload weeks: Every 4-8 weeks to allow recovery
- Mesocycles typically 4-6 weeks`,

  recovery: `Recovery is essential for muscle growth and performance:
- Sleep: 7-9 hours for optimal hormone production
- Nutrition: Protein timing, adequate calories
- Active recovery: Light movement, stretching
- Deload weeks: Reduced volume/intensity
- Stress management: Cortisol impacts recovery`,

  exercises: {
    chest: ['Bench Press', 'Incline Dumbbell Press', 'Cable Flyes', 'Dips', 'Push-ups'],
    back: ['Deadlift', 'Barbell Rows', 'Pull-ups', 'Lat Pulldown', 'Cable Rows'],
    shoulders: ['Overhead Press', 'Lateral Raises', 'Face Pulls', 'Rear Delt Flyes'],
    legs: ['Squat', 'Leg Press', 'Romanian Deadlift', 'Leg Curls', 'Lunges'],
    arms: ['Barbell Curls', 'Tricep Pushdowns', 'Hammer Curls', 'Skull Crushers'],
  },
};

// --- Helper: Extract Notion property value ---
function getNotionValue(property) {
  if (!property) return null;
  switch (property.type) {
    case 'title':
      return property.title?.map(t => t.plain_text).join('') || null;
    case 'rich_text':
      return property.rich_text?.map(t => t.plain_text).join('') || null;
    case 'number':
      return property.number;
    case 'select':
      return property.select?.name || null;
    case 'multi_select':
      return property.multi_select?.map(s => s.name) || [];
    case 'date':
      return property.date?.start || null;
    case 'checkbox':
      return property.checkbox;
    case 'email':
      return property.email;
    case 'phone_number':
      return property.phone_number;
    case 'url':
      return property.url;
    case 'formula':
      if (property.formula.type === 'string') return property.formula.string;
      if (property.formula.type === 'number') return property.formula.number;
      if (property.formula.type === 'boolean') return property.formula.boolean;
      if (property.formula.type === 'date') return property.formula.date?.start;
      return null;
    case 'rollup':
      if (property.rollup.type === 'number') return property.rollup.number;
      if (property.rollup.type === 'array') return property.rollup.array;
      return null;
    case 'relation':
      return property.relation?.map(r => r.id) || [];
    default:
      return null;
  }
}

// --- Helper: Fetch user profile from Notion ---
async function fetchUserProfile() {
  if (!notion || !NOTION_CLIENT_DB_ID) return null;

  try {
    const response = await notion.databases.query({
      database_id: NOTION_CLIENT_DB_ID,
      page_size: 1,
    });

    if (response.results.length === 0) return null;

    const page = response.results[0];
    const props = page.properties;

    const profile = {};
    for (const [key, value] of Object.entries(props)) {
      const extracted = getNotionValue(value);
      if (extracted !== null && extracted !== undefined && extracted !== '') {
        profile[key] = extracted;
      }
    }

    return profile;
  } catch (error) {
    console.error('Error fetching Notion user profile:', error.message);
    return null;
  }
}

// --- Helper: Fetch workouts from Notion ---
async function fetchNotionWorkouts(limit = 20) {
  if (!notion || !NOTION_WORKOUT_TRACKER_DB_ID) return [];

  try {
    const response = await notion.databases.query({
      database_id: NOTION_WORKOUT_TRACKER_DB_ID,
      page_size: limit,
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
    });

    return response.results.map(page => {
      const props = page.properties;
      const workout = { id: page.id, created: page.created_time };
      for (const [key, value] of Object.entries(props)) {
        const extracted = getNotionValue(value);
        if (extracted !== null && extracted !== undefined && extracted !== '') {
          workout[key] = extracted;
        }
      }
      return workout;
    });
  } catch (error) {
    console.error('Error fetching Notion workouts:', error.message);
    return [];
  }
}

// --- Helper: Search Pinecone knowledge base ---
async function searchKnowledge(query) {
  if (pineconeIndex && cohere) {
    try {
      const embeddingResponse = await cohere.embed({
        texts: [query],
        model: 'embed-english-v3.0',
        inputType: 'search_query',
      });

      const queryEmbedding = embeddingResponse.embeddings[0];

      const searchResults = await pineconeIndex.query({
        vector: queryEmbedding,
        topK: 5,
        includeMetadata: true,
      });

      if (searchResults.matches && searchResults.matches.length > 0) {
        return searchResults.matches
          .map(match => match.metadata?.text || match.metadata?.content || '')
          .filter(text => text.length > 0)
          .join('\n\n');
      }
    } catch (error) {
      console.error('Pinecone search error:', error.message);
    }
  }

  // Fallback to built-in knowledge
  const queryLower = query.toLowerCase();
  const relevantKnowledge = [];

  if (queryLower.includes('hypertrophy') || queryLower.includes('muscle') || queryLower.includes('size')) {
    relevantKnowledge.push(FITNESS_KNOWLEDGE.hypertrophy);
  }
  if (queryLower.includes('strength') || queryLower.includes('strong') || queryLower.includes('power')) {
    relevantKnowledge.push(FITNESS_KNOWLEDGE.strength);
  }
  if (queryLower.includes('program') || queryLower.includes('periodization') || queryLower.includes('plan')) {
    relevantKnowledge.push(FITNESS_KNOWLEDGE.periodization);
  }
  if (queryLower.includes('recovery') || queryLower.includes('rest') || queryLower.includes('sleep')) {
    relevantKnowledge.push(FITNESS_KNOWLEDGE.recovery);
  }

  return relevantKnowledge.join('\n\n');
}

// --- Helper: Input validation ---
function validateString(value, fieldName, maxLength = 5000) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return `${fieldName} is required and must be a non-empty string`;
  }
  if (value.length > maxLength) {
    return `${fieldName} must be less than ${maxLength} characters`;
  }
  return null;
}

// =====================
// API ENDPOINTS
// =====================

// --- Chat endpoint ---
app.post('/api/chat', async (req, res) => {
  try {
    const { message, context, chatHistory = [] } = req.body;

    const validationError = validateString(message, 'message');
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    if (!openai) {
      return res.status(503).json({
        error: 'AI service not configured',
        response: 'Please configure your OpenAI API key in the .env file to use the AI coach feature.',
      });
    }

    // Fetch user profile from Notion for personalization
    const userProfile = await fetchUserProfile();

    // Search for relevant knowledge
    const relevantKnowledge = await searchKnowledge(message);

    // Build context message
    let contextMessage = '';

    if (userProfile) {
      contextMessage += '\n\nUser Profile (from database):';
      for (const [key, value] of Object.entries(userProfile)) {
        if (value && typeof value !== 'object') {
          contextMessage += `\n- ${key}: ${value}`;
        } else if (Array.isArray(value) && value.length > 0) {
          contextMessage += `\n- ${key}: ${value.join(', ')}`;
        }
      }
    }

    if (context) {
      contextMessage += `\n\nUser's current fitness data:
- Total workouts completed: ${context.stats?.totalWorkouts || 0}
- Current workout streak: ${context.stats?.currentStreak || 0} days
- Weekly workouts: ${context.stats?.weeklyWorkouts || 0}
${context.activeProgram ? `- Active program: ${context.activeProgram}` : ''}`;
    }

    if (relevantKnowledge) {
      contextMessage += `\n\nRelevant fitness knowledge:\n${relevantKnowledge}`;
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + contextMessage },
      ...chatHistory.slice(-10).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: String(msg.content || ''),
      })),
      { role: 'user', content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 1000,
      temperature: 0.7,
    });

    const response = completion.choices[0].message.content;
    res.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'An internal error occurred',
      response: 'I apologize, but I encountered an error. Please try again.',
    });
  }
});

// --- Search endpoint ---
app.post('/api/search', async (req, res) => {
  try {
    const { query } = req.body;

    const validationError = validateString(query, 'query', 1000);
    if (validationError) {
      return res.status(400).json({ error: validationError, results: [] });
    }

    const results = await searchKnowledge(query);
    res.json({ results: results ? [results] : [] });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed', results: [] });
  }
});

// --- Generate program endpoint ---
app.post('/api/generate-program', async (req, res) => {
  try {
    const { goal, daysPerWeek, experienceLevel, equipment } = req.body;

    if (!goal || !daysPerWeek || !experienceLevel) {
      return res.status(400).json({ error: 'Missing required fields: goal, daysPerWeek, experienceLevel' });
    }

    if (!openai) {
      return res.status(503).json({ error: 'AI service not configured' });
    }

    // Fetch user profile and knowledge for personalization
    const [userProfile, relevantKnowledge] = await Promise.all([
      fetchUserProfile(),
      searchKnowledge(`${goal} ${experienceLevel} workout program`),
    ]);

    let userContext = '';
    if (userProfile) {
      userContext = '\n\nUser profile context:';
      for (const [key, value] of Object.entries(userProfile)) {
        if (value && typeof value !== 'object') {
          userContext += `\n- ${key}: ${value}`;
        } else if (Array.isArray(value) && value.length > 0) {
          userContext += `\n- ${key}: ${value.join(', ')}`;
        }
      }
    }

    let knowledgeContext = '';
    if (relevantKnowledge) {
      knowledgeContext = `\n\nRelevant programming knowledge:\n${relevantKnowledge}`;
    }

    const prompt = `Create a ${daysPerWeek}-day workout program for someone with ${experienceLevel} experience level, focusing on ${goal}.
Available equipment: ${(equipment || []).join(', ') || 'Full gym'}.
${userContext}
${knowledgeContext}

Return the program as a JSON object with the following structure:
{
  "name": "Program Name",
  "description": "Brief description",
  "workoutDays": [
    {
      "name": "Day 1 - Name",
      "dayOfWeek": 1,
      "exercises": [
        {
          "exerciseName": "Exercise Name",
          "setNumber": 3,
          "targetReps": 10,
          "targetWeight": 0
        }
      ]
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a fitness program designer. Only output valid JSON.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 2000,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0].message.content;
    const program = JSON.parse(responseText);
    res.json({ program });
  } catch (error) {
    console.error('Generate program error:', error);
    res.status(500).json({ error: 'Failed to generate program' });
  }
});

// --- Notion: Get user profile ---
app.get('/api/profile', async (req, res) => {
  try {
    const profile = await fetchUserProfile();
    if (!profile) {
      return res.status(404).json({ error: 'No profile found', profile: null });
    }
    res.json({ profile });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile', profile: null });
  }
});

// --- Notion: Get workouts ---
app.get('/api/notion-workouts', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const workouts = await fetchNotionWorkouts(limit);
    res.json({ workouts });
  } catch (error) {
    console.error('Notion workouts error:', error);
    res.status(500).json({ error: 'Failed to fetch workouts', workouts: [] });
  }
});

// --- Health check ---
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    services: {
      openai: !!openai,
      pinecone: !!pineconeIndex,
      cohere: !!cohere,
      notion: !!notion,
    },
  });
});

// --- Serve static files in production ---
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../dist')));
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../dist/index.html'));
  });
}

// --- Error handling middleware ---
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'An internal server error occurred' });
});

app.listen(PORT, () => {
  console.log(`FBB Coach server running on http://localhost:${PORT}`);
  console.log(`   OpenAI: ${openai ? 'Configured' : 'Not configured'}`);
  console.log(`   Cohere: ${cohere ? 'Configured' : 'Not configured'}`);
  console.log(`   Pinecone: ${pineconeIndex ? 'Connected' : 'Not connected (using fallback)'}`);
  console.log(`   Notion: ${notion ? 'Connected' : 'Not connected'}`);
});
