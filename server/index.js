import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { CohereClient } from 'cohere-ai';
import { Client as NotionClient } from '@notionhq/client';
import { initializeDatabase } from './db/index.js';
import syncRoutes from './routes/sync.js';

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
  methods: ['GET', 'POST', 'DELETE'],
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

// --- System Prompt (loaded from resources) ---
let SYSTEM_PROMPT;
try {
  const promptPath = join(__dirname, '../resources/Functional Bodybuilding & CrossFit Programming System Prompt .md');
  SYSTEM_PROMPT = readFileSync(promptPath, 'utf-8');
  console.log('System prompt loaded from resources file');
} catch {
  console.log('Resources file not found, using fallback system prompt');
  SYSTEM_PROMPT = `You are FBB Coach, an expert AI fitness coach specializing in Functional Bodybuilding and CrossFit methodologies. You follow Marcus Filly's "Look Good, Move Well" philosophy. You have deep knowledge in exercise science, program design (periodization, volume management, tempo prescriptions), nutrition, recovery, and training techniques. Always specify tempo (e.g. 31X1), rest periods, and RPE/RIR targets. Prioritize movement quality and safety.`;
}

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

// --- Helper: Fetch user profile from Notion (cached) ---
let _profileCache = { data: null, timestamp: 0, failed: false };
const PROFILE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchUserProfile() {
  if (!notion || !NOTION_CLIENT_DB_ID) return null;

  // Return cached result if fresh (or if last attempt failed, don't retry for TTL)
  const now = Date.now();
  if (now - _profileCache.timestamp < PROFILE_CACHE_TTL) {
    return _profileCache.data;
  }

  try {
    const response = await notion.databases.query({
      database_id: NOTION_CLIENT_DB_ID,
      page_size: 1,
    });

    if (response.results.length === 0) {
      _profileCache = { data: null, timestamp: now, failed: false };
      return null;
    }

    const page = response.results[0];
    const props = page.properties;

    const profile = {};
    for (const [key, value] of Object.entries(props)) {
      const extracted = getNotionValue(value);
      if (extracted !== null && extracted !== undefined && extracted !== '') {
        profile[key] = extracted;
      }
    }

    _profileCache = { data: profile, timestamp: now, failed: false };
    return profile;
  } catch (error) {
    console.error('Error fetching Notion user profile:', error.message);
    _profileCache = { data: null, timestamp: now, failed: true };
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
  if (!pineconeIndex || !cohere) return '';

  try {
    const embeddingResponse = await cohere.embed({
      texts: [query],
      model: 'embed-english-v3.0',
      inputType: 'search_query',
    });

    const queryEmbedding = embeddingResponse.embeddings[0];

    const searchResults = await pineconeIndex.query({
      vector: queryEmbedding,
      topK: 10,
      includeMetadata: true,
    });

    if (!searchResults.matches || searchResults.matches.length === 0) return '';

    const documents = searchResults.matches
      .map(match => match.metadata?.text || match.metadata?.content || '')
      .filter(text => text.length > 0);

    if (documents.length === 0) return '';

    // Rerank with Cohere for higher relevance
    try {
      const rerankResponse = await cohere.rerank({
        query,
        documents,
        model: 'rerank-english-v3.0',
        topN: 5,
      });

      return rerankResponse.results
        .map(r => documents[r.index])
        .join('\n\n');
    } catch (rerankError) {
      console.error('Cohere rerank error (falling back to raw results):', rerankError.message);
      return documents.slice(0, 5).join('\n\n');
    }
  } catch (error) {
    console.error('Pinecone search error:', error.message);
    return '';
  }
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
      max_tokens: 2000,
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
    const { goal, daysPerWeek, experienceLevel, equipment, trainingStyle, injuries } = req.body;

    if (!goal || !daysPerWeek || !experienceLevel) {
      return res.status(400).json({ error: 'Missing required fields: goal, daysPerWeek, experienceLevel' });
    }

    if (!openai) {
      return res.status(503).json({ error: 'AI service not configured' });
    }

    // Fetch user profile and knowledge for personalization
    const [userProfile, relevantKnowledge] = await Promise.all([
      fetchUserProfile(),
      searchKnowledge(`${goal} ${trainingStyle || ''} ${experienceLevel} workout program tempo periodization`),
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
Training style: ${trainingStyle || 'Functional Bodybuilding'}.
Available equipment: ${(equipment || []).join(', ') || 'Full gym'}.
${injuries ? `Injuries/limitations: ${injuries}` : ''}
${userContext}
${knowledgeContext}

Return the program as a JSON object with this EXACT structure:
{
  "name": "Program Name",
  "description": "Brief description of the program",
  "programOverview": {
    "goal": "${goal}",
    "style": "${trainingStyle || 'Functional Bodybuilding'}",
    "level": "${experienceLevel}",
    "cycleLength": "e.g. 4-Week Mesocycle",
    "frequency": "${daysPerWeek} Days/Week"
  },
  "workoutDays": [
    {
      "name": "Day 1 - Descriptive Name",
      "dayOfWeek": 1,
      "exercises": [
        {
          "exerciseName": "Precise Exercise Name",
          "sets": 4,
          "reps": "6-8",
          "tempo": "31X1",
          "intensity": "2 RIR",
          "rest": "2-3 min",
          "notes": "Technical cues or scaling options"
        }
      ]
    }
  ]
}

IMPORTANT:
- Every exercise MUST include tempo (4-digit: Eccentric-Bottom-Concentric-Top, e.g. 31X1, 4010, 20X0), intensity (RIR or %), rest period, and notes.
- Use rep ranges as strings (e.g. "6-8", "10-12", "8-10 per leg").
- Include warm-up cues in the first exercise notes of each day.
- For conditioning exercises, use appropriate formats in notes (e.g. "AMRAP 12 min", "EMOM 10 min").`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT + '\n\nYou are generating a structured workout program. Output ONLY valid JSON matching the requested schema. Include tempo prescriptions (e.g. 31X1, 4010), intensity (RIR or %), rest periods, and coaching notes for every exercise.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 4000,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0].message.content;
    const program = JSON.parse(responseText);

    // Normalize exercises to maintain backward compatibility
    if (program.workoutDays) {
      program.workoutDays = program.workoutDays.map(day => ({
        ...day,
        exercises: (day.exercises || []).map(ex => ({
          ...ex,
          // Ensure backward-compatible fields exist
          setNumber: ex.setNumber || ex.sets || 3,
          targetReps: ex.targetReps || parseInt(String(ex.reps)) || 10,
          targetWeight: ex.targetWeight || 0,
          // Preserve new fields
          sets: ex.sets || ex.setNumber || 3,
          reps: ex.reps || String(ex.targetReps || 10),
          tempo: ex.tempo || '',
          intensity: ex.intensity || '',
          rest: ex.rest || '',
          notes: ex.notes || '',
        })),
      }));
    }

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

// --- Sync routes (PostgreSQL) ---
app.use('/api/sync', syncRoutes);

// --- Health check ---
let dbConnected = false;
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    services: {
      openai: !!openai,
      pinecone: !!pineconeIndex,
      cohere: !!cohere,
      notion: !!notion,
      database: dbConnected,
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

// --- Start server ---
async function startServer() {
  // Initialize database if DATABASE_URL is configured
  if (process.env.DATABASE_URL) {
    try {
      await initializeDatabase();
      dbConnected = true;
      console.log('Database: Connected and initialized');
    } catch (error) {
      console.error('Database initialization failed:', error.message);
      console.log('Database: Not connected (sync features disabled)');
    }
  } else {
    console.log('Database: Not configured (set DATABASE_URL for sync features)');
  }

  app.listen(PORT, () => {
    console.log(`FBB Coach server running on http://localhost:${PORT}`);
    console.log(`   OpenAI: ${openai ? 'Configured' : 'Not configured'}`);
    console.log(`   Cohere: ${cohere ? 'Configured' : 'Not configured'}`);
    console.log(`   Pinecone: ${pineconeIndex ? 'Connected' : 'Not connected (using fallback)'}`);
    console.log(`   Notion: ${notion ? 'Connected' : 'Not connected'}`);
    console.log(`   Database: ${dbConnected ? 'Connected' : 'Not connected'}`);
  });
}

startServer();
