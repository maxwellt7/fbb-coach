import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection
pool.on('connect', () => {
  console.log('Database pool connection established');
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

// Initialize database schema
export async function initializeDatabase() {
  const client = await pool.connect();
  try {
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    await client.query(schema);
    console.log('Database schema initialized');
  } catch (error) {
    console.error('Error initializing database schema:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Query helper with error handling
export async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.log('Slow query:', { text, duration, rows: result.rowCount });
    }
    return result;
  } catch (error) {
    console.error('Database query error:', { text, error: error.message });
    throw error;
  }
}

// Transaction helper
export async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// User operations
export const userDb = {
  async findByDeviceId(deviceId) {
    const result = await query('SELECT * FROM users WHERE device_id = $1', [deviceId]);
    return result.rows[0] || null;
  },

  async create(deviceId, email = null) {
    const result = await query(
      'INSERT INTO users (device_id, email) VALUES ($1, $2) RETURNING *',
      [deviceId, email]
    );
    return result.rows[0];
  },

  async findOrCreate(deviceId) {
    let user = await this.findByDeviceId(deviceId);
    if (!user) {
      user = await this.create(deviceId);
    }
    return user;
  },
};

// Program operations
export const programDb = {
  async findByUserId(userId) {
    const result = await query(
      `SELECT p.*, 
        (SELECT json_agg(
          json_build_object(
            'id', wd.id,
            'name', wd.name,
            'dayOfWeek', wd.day_of_week,
            'notes', wd.notes,
            'exercises', (
              SELECT COALESCE(json_agg(
                json_build_object(
                  'id', e.id,
                  'exerciseName', e.exercise_name,
                  'sets', e.sets,
                  'reps', e.reps,
                  'targetWeight', e.target_weight,
                  'tempo', e.tempo,
                  'intensity', e.intensity,
                  'rest', e.rest,
                  'notes', e.notes,
                  'setNumber', e.sets,
                  'targetReps', CAST(SPLIT_PART(e.reps, '-', 1) AS INTEGER)
                ) ORDER BY e.sort_order
              ), '[]'::json)
              FROM exercises e WHERE e.workout_day_id = wd.id
            )
          ) ORDER BY wd.sort_order
        ) 
        FROM workout_days wd WHERE wd.program_id = p.id) as workout_days
      FROM programs p 
      WHERE p.user_id = $1 
      ORDER BY p.updated_at DESC`,
      [userId]
    );
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      duration: row.duration,
      daysPerWeek: row.days_per_week,
      goal: row.goal,
      isActive: row.is_active,
      workoutDays: row.workout_days || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  },

  async upsert(userId, program) {
    return transaction(async (client) => {
      // Upsert program
      const programResult = await client.query(
        `INSERT INTO programs (id, user_id, name, description, duration, days_per_week, goal, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           duration = EXCLUDED.duration,
           days_per_week = EXCLUDED.days_per_week,
           goal = EXCLUDED.goal,
           is_active = EXCLUDED.is_active,
           updated_at = NOW()
         RETURNING *`,
        [
          program.id,
          userId,
          program.name,
          program.description || '',
          program.duration || 8,
          program.daysPerWeek || program.workoutDays?.length || 4,
          program.goal || 'hypertrophy',
          program.isActive || false,
        ]
      );

      const programId = programResult.rows[0].id;

      // Delete existing workout days and exercises (will cascade)
      await client.query('DELETE FROM workout_days WHERE program_id = $1', [programId]);

      // Insert workout days and exercises
      if (program.workoutDays && program.workoutDays.length > 0) {
        for (let i = 0; i < program.workoutDays.length; i++) {
          const day = program.workoutDays[i];
          const dayResult = await client.query(
            `INSERT INTO workout_days (id, program_id, name, day_of_week, notes, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [day.id, programId, day.name, day.dayOfWeek || 0, day.notes || '', i]
          );

          const dayId = dayResult.rows[0].id;

          if (day.exercises && day.exercises.length > 0) {
            for (let j = 0; j < day.exercises.length; j++) {
              const ex = day.exercises[j];
              await client.query(
                `INSERT INTO exercises (id, workout_day_id, exercise_name, sets, reps, target_weight, tempo, intensity, rest, notes, sort_order)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                [
                  ex.id,
                  dayId,
                  ex.exerciseName,
                  ex.sets || ex.setNumber || 3,
                  ex.reps || String(ex.targetReps || 10),
                  ex.targetWeight || 0,
                  ex.tempo || '',
                  ex.intensity || '',
                  ex.rest || '',
                  ex.notes || '',
                  j,
                ]
              );
            }
          }
        }
      }

      return programResult.rows[0];
    });
  },

  async delete(userId, programId) {
    const result = await query(
      'DELETE FROM programs WHERE id = $1 AND user_id = $2 RETURNING id',
      [programId, userId]
    );
    return result.rowCount > 0;
  },

  async setActive(userId, programId) {
    await transaction(async (client) => {
      // Deactivate all programs for user
      await client.query('UPDATE programs SET is_active = false WHERE user_id = $1', [userId]);
      // Activate the specified program
      if (programId) {
        await client.query(
          'UPDATE programs SET is_active = true WHERE id = $1 AND user_id = $2',
          [programId, userId]
        );
      }
    });
  },
};

// Workout log operations
export const workoutDb = {
  async findByUserId(userId, limit = 100) {
    const result = await query(
      `SELECT wl.*,
        (SELECT COALESCE(json_agg(
          json_build_object(
            'id', ws.id,
            'exerciseId', ws.exercise_id,
            'exerciseName', ws.exercise_name,
            'setNumber', ws.set_number,
            'targetReps', ws.target_reps,
            'targetWeight', ws.target_weight,
            'actualReps', ws.actual_reps,
            'actualWeight', ws.actual_weight,
            'rpe', ws.rpe,
            'completed', ws.completed,
            'notes', ws.notes
          ) ORDER BY ws.sort_order
        ), '[]'::json)
        FROM workout_sets ws WHERE ws.workout_log_id = wl.id) as sets
      FROM workout_logs wl
      WHERE wl.user_id = $1
      ORDER BY wl.date DESC
      LIMIT $2`,
      [userId, limit]
    );
    return result.rows.map(row => ({
      id: row.id,
      programId: row.program_id,
      workoutDayId: row.workout_day_id,
      date: row.date,
      duration: row.duration,
      notes: row.notes,
      rating: row.rating,
      completed: row.completed,
      sets: row.sets || [],
    }));
  },

  async upsert(userId, workout) {
    return transaction(async (client) => {
      const workoutResult = await client.query(
        `INSERT INTO workout_logs (id, user_id, program_id, workout_day_id, date, duration, notes, rating, completed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           duration = EXCLUDED.duration,
           notes = EXCLUDED.notes,
           rating = EXCLUDED.rating,
           completed = EXCLUDED.completed
         RETURNING *`,
        [
          workout.id,
          userId,
          workout.programId || null,
          workout.workoutDayId || null,
          workout.date || new Date().toISOString(),
          workout.duration || 0,
          workout.notes || '',
          workout.rating || null,
          workout.completed || false,
        ]
      );

      const workoutId = workoutResult.rows[0].id;

      // Delete existing sets
      await client.query('DELETE FROM workout_sets WHERE workout_log_id = $1', [workoutId]);

      // Insert sets
      if (workout.sets && workout.sets.length > 0) {
        for (let i = 0; i < workout.sets.length; i++) {
          const set = workout.sets[i];
          await client.query(
            `INSERT INTO workout_sets (id, workout_log_id, exercise_id, exercise_name, set_number, target_reps, target_weight, actual_reps, actual_weight, rpe, completed, notes, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
              set.id,
              workoutId,
              set.exerciseId || null,
              set.exerciseName || '',
              set.setNumber || 1,
              set.targetReps || 10,
              set.targetWeight || 0,
              set.actualReps || null,
              set.actualWeight || null,
              set.rpe || null,
              set.completed || false,
              set.notes || '',
              i,
            ]
          );
        }
      }

      return workoutResult.rows[0];
    });
  },

  async delete(userId, workoutId) {
    const result = await query(
      'DELETE FROM workout_logs WHERE id = $1 AND user_id = $2 RETURNING id',
      [workoutId, userId]
    );
    return result.rowCount > 0;
  },
};

// Chat history operations
export const chatDb = {
  async findByUserId(userId, limit = 50) {
    const result = await query(
      `SELECT * FROM chat_messages 
       WHERE user_id = $1 
       ORDER BY created_at ASC 
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows.map(row => ({
      id: row.id,
      role: row.role,
      content: row.content,
      timestamp: row.created_at,
    }));
  },

  async create(userId, role, content) {
    const result = await query(
      'INSERT INTO chat_messages (user_id, role, content) VALUES ($1, $2, $3) RETURNING *',
      [userId, role, content]
    );
    return result.rows[0];
  },

  async clear(userId) {
    await query('DELETE FROM chat_messages WHERE user_id = $1', [userId]);
  },
};

export default pool;
