import express from 'express';
import { userDb, programDb, workoutDb, chatDb } from '../db/index.js';

const router = express.Router();

// Middleware to extract user from device ID header
async function authenticateUser(req, res, next) {
  const deviceId = req.headers['x-device-id'];
  
  if (!deviceId) {
    return res.status(401).json({ error: 'Device ID required' });
  }

  try {
    const user = await userDb.findOrCreate(deviceId);
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

// Apply auth middleware to all routes
router.use(authenticateUser);

// ============ USER ============

// Get current user
router.get('/user', (req, res) => {
  res.json({ user: { id: req.user.id, deviceId: req.user.device_id } });
});

// ============ PROGRAMS ============

// Get all programs for user
router.get('/programs', async (req, res) => {
  try {
    const programs = await programDb.findByUserId(req.user.id);
    res.json({ programs });
  } catch (error) {
    console.error('Get programs error:', error);
    res.status(500).json({ error: 'Failed to fetch programs' });
  }
});

// Save/update a program
router.post('/programs', async (req, res) => {
  try {
    const { program } = req.body;
    
    if (!program || !program.id || !program.name) {
      return res.status(400).json({ error: 'Invalid program data' });
    }

    await programDb.upsert(req.user.id, program);
    res.json({ success: true });
  } catch (error) {
    console.error('Save program error:', error);
    res.status(500).json({ error: 'Failed to save program' });
  }
});

// Bulk save programs (for initial sync)
router.post('/programs/bulk', async (req, res) => {
  try {
    const { programs } = req.body;
    
    if (!Array.isArray(programs)) {
      return res.status(400).json({ error: 'Programs must be an array' });
    }

    for (const program of programs) {
      if (program.id && program.name) {
        await programDb.upsert(req.user.id, program);
      }
    }

    res.json({ success: true, count: programs.length });
  } catch (error) {
    console.error('Bulk save programs error:', error);
    res.status(500).json({ error: 'Failed to save programs' });
  }
});

// Delete a program
router.delete('/programs/:id', async (req, res) => {
  try {
    const deleted = await programDb.delete(req.user.id, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Program not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete program error:', error);
    res.status(500).json({ error: 'Failed to delete program' });
  }
});

// Set active program
router.post('/programs/active', async (req, res) => {
  try {
    const { programId } = req.body;
    await programDb.setActive(req.user.id, programId || null);
    res.json({ success: true });
  } catch (error) {
    console.error('Set active program error:', error);
    res.status(500).json({ error: 'Failed to set active program' });
  }
});

// ============ WORKOUTS ============

// Get all workout logs for user
router.get('/workouts', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const workouts = await workoutDb.findByUserId(req.user.id, limit);
    res.json({ workouts });
  } catch (error) {
    console.error('Get workouts error:', error);
    res.status(500).json({ error: 'Failed to fetch workouts' });
  }
});

// Save/update a workout
router.post('/workouts', async (req, res) => {
  try {
    const { workout } = req.body;
    
    if (!workout || !workout.id) {
      return res.status(400).json({ error: 'Invalid workout data' });
    }

    await workoutDb.upsert(req.user.id, workout);
    res.json({ success: true });
  } catch (error) {
    console.error('Save workout error:', error);
    res.status(500).json({ error: 'Failed to save workout' });
  }
});

// Bulk save workouts (for initial sync)
router.post('/workouts/bulk', async (req, res) => {
  try {
    const { workouts } = req.body;
    
    if (!Array.isArray(workouts)) {
      return res.status(400).json({ error: 'Workouts must be an array' });
    }

    for (const workout of workouts) {
      if (workout.id) {
        await workoutDb.upsert(req.user.id, workout);
      }
    }

    res.json({ success: true, count: workouts.length });
  } catch (error) {
    console.error('Bulk save workouts error:', error);
    res.status(500).json({ error: 'Failed to save workouts' });
  }
});

// Delete a workout
router.delete('/workouts/:id', async (req, res) => {
  try {
    const deleted = await workoutDb.delete(req.user.id, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Workout not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete workout error:', error);
    res.status(500).json({ error: 'Failed to delete workout' });
  }
});

// ============ CHAT HISTORY ============

// Get chat history
router.get('/chat', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const messages = await chatDb.findByUserId(req.user.id, limit);
    res.json({ messages });
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// Save chat message
router.post('/chat', async (req, res) => {
  try {
    const { role, content } = req.body;
    
    if (!role || !content) {
      return res.status(400).json({ error: 'Role and content required' });
    }

    await chatDb.create(req.user.id, role, content);
    res.json({ success: true });
  } catch (error) {
    console.error('Save chat error:', error);
    res.status(500).json({ error: 'Failed to save chat message' });
  }
});

// Clear chat history
router.delete('/chat', async (req, res) => {
  try {
    await chatDb.clear(req.user.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Clear chat error:', error);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

// ============ FULL SYNC ============

// Get all data for user (initial sync)
router.get('/all', async (req, res) => {
  try {
    const [programs, workouts, chatMessages] = await Promise.all([
      programDb.findByUserId(req.user.id),
      workoutDb.findByUserId(req.user.id, 500),
      chatDb.findByUserId(req.user.id, 100),
    ]);

    const activeProgram = programs.find(p => p.isActive) || null;

    res.json({
      user: { id: req.user.id },
      programs,
      activeProgram,
      workouts,
      chatMessages,
    });
  } catch (error) {
    console.error('Full sync error:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// Push all data from client (full sync)
router.post('/all', async (req, res) => {
  try {
    const { programs, workouts, activeProgram } = req.body;

    // Save programs
    if (Array.isArray(programs)) {
      for (const program of programs) {
        if (program.id && program.name) {
          await programDb.upsert(req.user.id, program);
        }
      }
    }

    // Save workouts
    if (Array.isArray(workouts)) {
      for (const workout of workouts) {
        if (workout.id) {
          await workoutDb.upsert(req.user.id, workout);
        }
      }
    }

    // Set active program
    if (activeProgram?.id) {
      await programDb.setActive(req.user.id, activeProgram.id);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Full sync push error:', error);
    res.status(500).json({ error: 'Failed to sync data' });
  }
});

export default router;
