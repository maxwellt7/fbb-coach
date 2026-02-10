export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  description?: string;
  videoUrl?: string;
}

export interface WorkoutSet {
  id: string;
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  targetReps: number;
  targetWeight: number;
  actualReps?: number;
  actualWeight?: number;
  rpe?: number;
  completed: boolean;
  notes?: string;
}

export interface WorkoutDay {
  id: string;
  name: string;
  dayOfWeek: number;
  exercises: WorkoutSet[];
  notes?: string;
}

export interface Program {
  id: string;
  name: string;
  description: string;
  duration: number; // weeks
  daysPerWeek: number;
  goal: 'strength' | 'hypertrophy' | 'powerlifting' | 'bodybuilding' | 'general';
  workoutDays: WorkoutDay[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutLog {
  id: string;
  programId?: string;
  workoutDayId?: string;
  date: string;
  duration: number; // minutes
  sets: WorkoutSet[];
  notes?: string;
  rating?: number;
  completed: boolean;
}

export interface UserStats {
  totalWorkouts: number;
  totalVolume: number;
  currentStreak: number;
  longestStreak: number;
  weeklyWorkouts: number;
  personalRecords: PersonalRecord[];
}

export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  weight: number;
  reps: number;
  date: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface MuscleGroup {
  name: string;
  exercises: string[];
}

export const MUSCLE_GROUPS: MuscleGroup[] = [
  { name: 'Chest', exercises: ['Bench Press', 'Incline Dumbbell Press', 'Cable Flyes', 'Dips', 'Push-ups'] },
  { name: 'Back', exercises: ['Deadlift', 'Barbell Rows', 'Pull-ups', 'Lat Pulldown', 'Cable Rows'] },
  { name: 'Shoulders', exercises: ['Overhead Press', 'Lateral Raises', 'Face Pulls', 'Rear Delt Flyes', 'Arnold Press'] },
  { name: 'Legs', exercises: ['Squat', 'Leg Press', 'Romanian Deadlift', 'Leg Curls', 'Leg Extensions', 'Lunges'] },
  { name: 'Arms', exercises: ['Barbell Curls', 'Tricep Pushdowns', 'Hammer Curls', 'Skull Crushers', 'Preacher Curls'] },
  { name: 'Core', exercises: ['Planks', 'Cable Crunches', 'Hanging Leg Raises', 'Ab Wheel', 'Russian Twists'] },
];

/** Calculate total volume (weight × reps) for an array of workout sets */
export function calcVolume(sets: WorkoutSet[]): number {
  return sets.reduce(
    (acc, s) => acc + (s.actualWeight || 0) * (s.actualReps || 0),
    0
  );
}

export const EQUIPMENT_TYPES = [
  'Barbell',
  'Dumbbell',
  'Cable Machine',
  'Smith Machine',
  'Bodyweight',
  'Resistance Bands',
  'Kettlebell',
  'Machine',
];
