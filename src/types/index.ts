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
  tempo?: string;      // "31X1", "4010"
  intensity?: string;  // "2 RIR", "85%"
  rest?: string;       // "2-3 min", "90 sec"
  reps?: string;       // "6-8" (rich string format from AI)
  sets?: number;       // Alias for setNumber from new schema
}

export interface WorkoutDay {
  id: string;
  name: string;
  dayOfWeek: number;
  exercises: WorkoutSet[];
  notes?: string;
  weekNumber?: number;
  dayNumber?: number;
}

export interface Program {
  id: string;
  name: string;
  description: string;
  duration: number; // weeks
  daysPerWeek: number;
  goal: 'strength' | 'hypertrophy' | 'powerlifting' | 'bodybuilding' | 'general' | 'crossfit' | 'hybrid';
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

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface MuscleGroup {
  name: string;
  exercises: string[];
}

export const MUSCLE_GROUPS: MuscleGroup[] = [
  { name: 'Chest', exercises: ['Bench Press', 'Incline Dumbbell Press', 'Cable Flyes', 'Dips', 'Push-ups'] },
  { name: 'Back', exercises: ['Deadlift', 'Barbell Rows', 'Pull-ups', 'Lat Pulldown', 'Cable Rows'] },
  { name: 'Shoulders', exercises: ['Overhead Press', 'Lateral Raises', 'Face Pulls', 'Rear Delt Flyes', 'Arnold Press', 'Filly Press'] },
  { name: 'Legs', exercises: ['Squat', 'Front Squat', 'Leg Press', 'Romanian Deadlift', 'Leg Curls', 'Leg Extensions', 'Lunges', 'Bulgarian Split Squats'] },
  { name: 'Arms', exercises: ['Barbell Curls', 'Tricep Pushdowns', 'Hammer Curls', 'Skull Crushers', 'Preacher Curls'] },
  { name: 'Core', exercises: ['Planks', 'Cable Crunches', 'Hanging Leg Raises', 'Ab Wheel', 'Russian Twists'] },
  { name: 'Olympic', exercises: ['Clean & Jerk', 'Snatch', 'Power Clean', 'Power Snatch', 'Hang Clean', 'Clean Pull'] },
  { name: 'Gymnastics', exercises: ['Muscle-ups', 'Ring Dips', 'Handstand Push-ups', 'Toes-to-Bar', 'Rope Climbs', 'Pistol Squats'] },
  { name: 'Conditioning', exercises: ['Wall Balls', 'Box Jumps', 'Burpees', 'Thrusters', 'Rowing', 'Ski Erg', 'Assault Bike'] },
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

export interface ProgramOverview {
  goal: string;
  style: string;
  level: string;
  cycleLength: string;
  frequency: string;
}

export const TRAINING_STYLES = [
  'Functional Bodybuilding',
  'CrossFit',
  'Hybrid',
  'Traditional Bodybuilding',
  'Powerlifting',
  'Strength & Conditioning',
] as const;
