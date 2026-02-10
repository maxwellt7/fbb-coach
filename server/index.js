import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Pinecone (if configured)
let pineconeIndex = null;
if (process.env.PINECONE_API_KEY) {
  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
    pineconeIndex = pinecone.index(process.env.PINECONE_INDEX || 'fitness-knowledge');
    console.log('Pinecone initialized successfully');
  } catch (error) {
    console.log('Pinecone not configured or error:', error.message);
  }
}

// System prompt for the AI coach
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

When the user provides their workout data (stats, recent workouts, active program), use this information to give personalized advice.

Always prioritize safety and proper form over ego lifting.`;

// Fitness knowledge base (built-in fallback when Pinecone isn't configured)
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

// Search knowledge base (Pinecone or fallback)
async function searchKnowledge(query) {
  if (pineconeIndex) {
    try {
      // Generate embedding for query
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
      });
      
      const queryEmbedding = embeddingResponse.data[0].embedding;
      
      // Search Pinecone
      const searchResults = await pineconeIndex.query({
        vector: queryEmbedding,
        topK: 3,
        includeMetadata: true,
      });
      
      if (searchResults.matches && searchResults.matches.length > 0) {
        return searchResults.matches
          .map(match => match.metadata?.text || '')
          .filter(text => text.length > 0)
          .join('\n\n');
      }
    } catch (error) {
      console.error('Pinecone search error:', error.message);
    }
  }
  
  // Fallback to built-in knowledge
  const queryLower = query.toLowerCase();
  let relevantKnowledge = [];
  
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

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, context, chatHistory = [] } = req.body;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: 'OpenAI API key not configured',
        response: 'Please configure your OpenAI API key in the .env file to use the AI coach feature.',
      });
    }

    // Search for relevant knowledge
    const relevantKnowledge = await searchKnowledge(message);

    // Build context message
    let contextMessage = '';
    if (context) {
      contextMessage = `\n\nUser's current fitness data:
- Total workouts completed: ${context.stats?.totalWorkouts || 0}
- Current workout streak: ${context.stats?.currentStreak || 0} days
- Weekly workouts: ${context.stats?.weeklyWorkouts || 0}
${context.activeProgram ? `- Active program: ${context.activeProgram}` : ''}`;
    }

    if (relevantKnowledge) {
      contextMessage += `\n\nRelevant fitness knowledge:\n${relevantKnowledge}`;
    }

    // Build messages array
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + contextMessage },
      ...chatHistory.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    // Call OpenAI
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
      error: error.message,
      response: 'I apologize, but I encountered an error. Please try again.',
    });
  }
});

// Search endpoint
app.post('/api/search', async (req, res) => {
  try {
    const { query } = req.body;
    const results = await searchKnowledge(query);
    res.json({ results: results ? [results] : [] });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message, results: [] });
  }
});

// Generate program endpoint
app.post('/api/generate-program', async (req, res) => {
  try {
    const { goal, daysPerWeek, experienceLevel, equipment } = req.body;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const prompt = `Create a ${daysPerWeek}-day workout program for someone with ${experienceLevel} experience level, focusing on ${goal}. 
Available equipment: ${equipment.join(', ')}.

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
}

Only return valid JSON, no additional text.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a fitness program designer. Only output valid JSON.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    const responseText = completion.choices[0].message.content;
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const program = JSON.parse(jsonMatch[0]);
      res.json({ program });
    } else {
      throw new Error('Failed to parse program JSON');
    }
  } catch (error) {
    console.error('Generate program error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    openai: !!process.env.OPENAI_API_KEY,
    pinecone: !!pineconeIndex,
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../dist')));
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🏋️ FBB Coach server running on http://localhost:${PORT}`);
  console.log(`   OpenAI: ${process.env.OPENAI_API_KEY ? '✓ Configured' : '✗ Not configured'}`);
  console.log(`   Pinecone: ${pineconeIndex ? '✓ Connected' : '✗ Not connected (using fallback)'}`);
});
