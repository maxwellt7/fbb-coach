import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Save,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Sparkles,
  Loader2,
  Copy,
  ArrowLeft,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../store/useStore';
import type { Program, WorkoutDay, WorkoutSet } from '../types';
import { MUSCLE_GROUPS } from '../types';
import { generateProgram } from '../services/api';

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const PROGRAM_TEMPLATES: Record<string, { name: string; description: string; goal: Program['goal']; duration: number; days: { name: string; dayOfWeek: number; exercises: { exerciseName: string; setNumber: number; targetReps: number; targetWeight: number }[] }[] }> = {
  hypertrophy: {
    name: 'Push/Pull/Legs',
    description: '6-day split focusing on movement patterns for maximum hypertrophy',
    goal: 'hypertrophy',
    duration: 8,
    days: [
      { name: 'Push A', dayOfWeek: 1, exercises: [
        { exerciseName: 'Bench Press', setNumber: 4, targetReps: 8, targetWeight: 135 },
        { exerciseName: 'Overhead Press', setNumber: 3, targetReps: 10, targetWeight: 95 },
        { exerciseName: 'Incline Dumbbell Press', setNumber: 3, targetReps: 12, targetWeight: 50 },
        { exerciseName: 'Lateral Raises', setNumber: 3, targetReps: 15, targetWeight: 15 },
        { exerciseName: 'Tricep Pushdowns', setNumber: 3, targetReps: 12, targetWeight: 40 },
      ]},
      { name: 'Pull A', dayOfWeek: 2, exercises: [
        { exerciseName: 'Deadlift', setNumber: 3, targetReps: 5, targetWeight: 225 },
        { exerciseName: 'Barbell Rows', setNumber: 4, targetReps: 8, targetWeight: 135 },
        { exerciseName: 'Pull-ups', setNumber: 3, targetReps: 10, targetWeight: 0 },
        { exerciseName: 'Face Pulls', setNumber: 3, targetReps: 15, targetWeight: 25 },
        { exerciseName: 'Barbell Curls', setNumber: 3, targetReps: 12, targetWeight: 50 },
      ]},
      { name: 'Legs A', dayOfWeek: 3, exercises: [
        { exerciseName: 'Squat', setNumber: 4, targetReps: 8, targetWeight: 185 },
        { exerciseName: 'Romanian Deadlift', setNumber: 3, targetReps: 10, targetWeight: 155 },
        { exerciseName: 'Leg Press', setNumber: 3, targetReps: 12, targetWeight: 270 },
        { exerciseName: 'Leg Curls', setNumber: 3, targetReps: 12, targetWeight: 80 },
        { exerciseName: 'Leg Extensions', setNumber: 3, targetReps: 15, targetWeight: 70 },
      ]},
      { name: 'Push B', dayOfWeek: 4, exercises: [
        { exerciseName: 'Overhead Press', setNumber: 4, targetReps: 8, targetWeight: 95 },
        { exerciseName: 'Incline Dumbbell Press', setNumber: 3, targetReps: 10, targetWeight: 55 },
        { exerciseName: 'Cable Flyes', setNumber: 3, targetReps: 12, targetWeight: 25 },
        { exerciseName: 'Arnold Press', setNumber: 3, targetReps: 12, targetWeight: 35 },
        { exerciseName: 'Skull Crushers', setNumber: 3, targetReps: 12, targetWeight: 50 },
      ]},
      { name: 'Pull B', dayOfWeek: 5, exercises: [
        { exerciseName: 'Barbell Rows', setNumber: 4, targetReps: 8, targetWeight: 145 },
        { exerciseName: 'Lat Pulldown', setNumber: 3, targetReps: 10, targetWeight: 120 },
        { exerciseName: 'Cable Rows', setNumber: 3, targetReps: 12, targetWeight: 100 },
        { exerciseName: 'Rear Delt Flyes', setNumber: 3, targetReps: 15, targetWeight: 15 },
        { exerciseName: 'Hammer Curls', setNumber: 3, targetReps: 12, targetWeight: 30 },
      ]},
      { name: 'Legs B', dayOfWeek: 6, exercises: [
        { exerciseName: 'Leg Press', setNumber: 4, targetReps: 10, targetWeight: 315 },
        { exerciseName: 'Lunges', setNumber: 3, targetReps: 10, targetWeight: 40 },
        { exerciseName: 'Leg Curls', setNumber: 3, targetReps: 12, targetWeight: 80 },
        { exerciseName: 'Leg Extensions', setNumber: 3, targetReps: 12, targetWeight: 70 },
        { exerciseName: 'Cable Crunches', setNumber: 3, targetReps: 15, targetWeight: 60 },
      ]},
    ],
  },
  strength: {
    name: 'Upper/Lower',
    description: '4-day balanced program for building strength',
    goal: 'strength',
    duration: 8,
    days: [
      { name: 'Upper A', dayOfWeek: 1, exercises: [
        { exerciseName: 'Bench Press', setNumber: 5, targetReps: 5, targetWeight: 165 },
        { exerciseName: 'Barbell Rows', setNumber: 4, targetReps: 6, targetWeight: 145 },
        { exerciseName: 'Overhead Press', setNumber: 3, targetReps: 8, targetWeight: 95 },
        { exerciseName: 'Pull-ups', setNumber: 3, targetReps: 8, targetWeight: 0 },
        { exerciseName: 'Barbell Curls', setNumber: 2, targetReps: 10, targetWeight: 50 },
      ]},
      { name: 'Lower A', dayOfWeek: 2, exercises: [
        { exerciseName: 'Squat', setNumber: 5, targetReps: 5, targetWeight: 225 },
        { exerciseName: 'Romanian Deadlift', setNumber: 3, targetReps: 8, targetWeight: 185 },
        { exerciseName: 'Leg Press', setNumber: 3, targetReps: 10, targetWeight: 315 },
        { exerciseName: 'Leg Curls', setNumber: 3, targetReps: 10, targetWeight: 80 },
        { exerciseName: 'Planks', setNumber: 3, targetReps: 60, targetWeight: 0 },
      ]},
      { name: 'Upper B', dayOfWeek: 4, exercises: [
        { exerciseName: 'Overhead Press', setNumber: 5, targetReps: 5, targetWeight: 105 },
        { exerciseName: 'Pull-ups', setNumber: 4, targetReps: 6, targetWeight: 0 },
        { exerciseName: 'Incline Dumbbell Press', setNumber: 3, targetReps: 10, targetWeight: 55 },
        { exerciseName: 'Cable Rows', setNumber: 3, targetReps: 10, targetWeight: 100 },
        { exerciseName: 'Tricep Pushdowns', setNumber: 2, targetReps: 12, targetWeight: 40 },
      ]},
      { name: 'Lower B', dayOfWeek: 5, exercises: [
        { exerciseName: 'Deadlift', setNumber: 5, targetReps: 5, targetWeight: 275 },
        { exerciseName: 'Squat', setNumber: 3, targetReps: 8, targetWeight: 185 },
        { exerciseName: 'Lunges', setNumber: 3, targetReps: 10, targetWeight: 40 },
        { exerciseName: 'Leg Extensions', setNumber: 3, targetReps: 12, targetWeight: 70 },
        { exerciseName: 'Hanging Leg Raises', setNumber: 3, targetReps: 12, targetWeight: 0 },
      ]},
    ],
  },
  general: {
    name: 'Full Body',
    description: '3-day program for busy schedules covering all major muscle groups',
    goal: 'general',
    duration: 8,
    days: [
      { name: 'Full Body A', dayOfWeek: 1, exercises: [
        { exerciseName: 'Squat', setNumber: 3, targetReps: 8, targetWeight: 155 },
        { exerciseName: 'Bench Press', setNumber: 3, targetReps: 8, targetWeight: 135 },
        { exerciseName: 'Barbell Rows', setNumber: 3, targetReps: 10, targetWeight: 115 },
        { exerciseName: 'Overhead Press', setNumber: 3, targetReps: 10, targetWeight: 75 },
        { exerciseName: 'Barbell Curls', setNumber: 2, targetReps: 12, targetWeight: 40 },
      ]},
      { name: 'Full Body B', dayOfWeek: 3, exercises: [
        { exerciseName: 'Deadlift', setNumber: 3, targetReps: 5, targetWeight: 205 },
        { exerciseName: 'Incline Dumbbell Press', setNumber: 3, targetReps: 10, targetWeight: 45 },
        { exerciseName: 'Lat Pulldown', setNumber: 3, targetReps: 10, targetWeight: 100 },
        { exerciseName: 'Lunges', setNumber: 3, targetReps: 10, targetWeight: 30 },
        { exerciseName: 'Planks', setNumber: 3, targetReps: 45, targetWeight: 0 },
      ]},
      { name: 'Full Body C', dayOfWeek: 5, exercises: [
        { exerciseName: 'Leg Press', setNumber: 3, targetReps: 10, targetWeight: 270 },
        { exerciseName: 'Dips', setNumber: 3, targetReps: 10, targetWeight: 0 },
        { exerciseName: 'Cable Rows', setNumber: 3, targetReps: 10, targetWeight: 80 },
        { exerciseName: 'Lateral Raises', setNumber: 3, targetReps: 15, targetWeight: 15 },
        { exerciseName: 'Hammer Curls', setNumber: 2, targetReps: 12, targetWeight: 25 },
      ]},
    ],
  },
};

function templateToWorkoutDays(template: typeof PROGRAM_TEMPLATES[string]): WorkoutDay[] {
  return template.days.map((day) => ({
    id: uuidv4(),
    name: day.name,
    dayOfWeek: day.dayOfWeek,
    exercises: day.exercises.map((ex) => ({
      id: uuidv4(),
      exerciseId: uuidv4(),
      exerciseName: ex.exerciseName,
      setNumber: ex.setNumber,
      targetReps: ex.targetReps,
      targetWeight: ex.targetWeight,
      completed: false,
    })),
  }));
}

export default function ProgramBuilder() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { programs, addProgram, updateProgram } = useStore();

  const existingProgram = id ? programs.find((p) => p.id === id) : null;
  const templateKey = searchParams.get('template');
  const template = templateKey ? PROGRAM_TEMPLATES[templateKey] : null;

  const [name, setName] = useState(existingProgram?.name || template?.name || '');
  const [description, setDescription] = useState(existingProgram?.description || template?.description || '');
  const [duration, setDuration] = useState(existingProgram?.duration || template?.duration || 8);
  const [goal, setGoal] = useState<Program['goal']>(existingProgram?.goal || template?.goal || 'hypertrophy');
  const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>(
    existingProgram?.workoutDays || (template ? templateToWorkoutDays(template) : [])
  );
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Track dirty state
  const markDirty = useCallback(() => setIsDirty(true), []);

  // Protect against accidental navigation
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const addWorkoutDay = () => {
    const newDay: WorkoutDay = {
      id: uuidv4(),
      name: `Day ${workoutDays.length + 1}`,
      dayOfWeek: workoutDays.length % 7,
      exercises: [],
    };
    setWorkoutDays([...workoutDays, newDay]);
    setExpandedDay(newDay.id);
    markDirty();
  };

  const duplicateWorkoutDay = (day: WorkoutDay) => {
    const newDay: WorkoutDay = {
      ...day,
      id: uuidv4(),
      name: `${day.name} (Copy)`,
      exercises: day.exercises.map((e) => ({ ...e, id: uuidv4() })),
    };
    setWorkoutDays([...workoutDays, newDay]);
    setExpandedDay(newDay.id);
    markDirty();
  };

  const updateWorkoutDay = (dayId: string, updates: Partial<WorkoutDay>) => {
    setWorkoutDays(
      workoutDays.map((d) => (d.id === dayId ? { ...d, ...updates } : d))
    );
    markDirty();
  };

  const removeWorkoutDay = (dayId: string) => {
    setWorkoutDays(workoutDays.filter((d) => d.id !== dayId));
    markDirty();
  };

  const addExercise = (dayId: string) => {
    const newSet: WorkoutSet = {
      id: uuidv4(),
      exerciseId: uuidv4(),
      exerciseName: '',
      setNumber: 1,
      targetReps: 10,
      targetWeight: 0,
      completed: false,
    };

    setWorkoutDays(
      workoutDays.map((d) =>
        d.id === dayId ? { ...d, exercises: [...d.exercises, newSet] } : d
      )
    );
    markDirty();
  };

  const updateExercise = (dayId: string, setId: string, updates: Partial<WorkoutSet>) => {
    setWorkoutDays(
      workoutDays.map((d) =>
        d.id === dayId
          ? {
              ...d,
              exercises: d.exercises.map((e) =>
                e.id === setId ? { ...e, ...updates } : e
              ),
            }
          : d
      )
    );
    markDirty();
  };

  const removeExercise = (dayId: string, setId: string) => {
    setWorkoutDays(
      workoutDays.map((d) =>
        d.id === dayId
          ? { ...d, exercises: d.exercises.filter((e) => e.id !== setId) }
          : d
      )
    );
    markDirty();
  };

  const duplicateSet = (dayId: string, exercise: WorkoutSet) => {
    const newSet: WorkoutSet = {
      ...exercise,
      id: uuidv4(),
      setNumber: exercise.setNumber + 1,
    };

    setWorkoutDays(
      workoutDays.map((d) => {
        if (d.id !== dayId) return d;
        const exerciseIndex = d.exercises.findIndex((e) => e.id === exercise.id);
        const newExercises = [...d.exercises];
        newExercises.splice(exerciseIndex + 1, 0, newSet);
        return { ...d, exercises: newExercises };
      })
    );
    markDirty();
  };

  const handleAIGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await generateProgram({
        goal,
        daysPerWeek: workoutDays.length || 4,
        experienceLevel: 'intermediate',
        equipment: ['Barbell', 'Dumbbell', 'Cable Machine', 'Machine'],
      });
      setName(result.name || name);
      setDescription(result.description || description);
      if (result.workoutDays?.length) {
        setWorkoutDays(
          result.workoutDays.map((day) => ({
            id: uuidv4(),
            name: day.name,
            dayOfWeek: day.dayOfWeek,
            exercises: day.exercises.map((ex) => ({
              id: uuidv4(),
              exerciseId: uuidv4(),
              exerciseName: ex.exerciseName,
              setNumber: ex.setNumber || 3,
              targetReps: ex.targetReps || 10,
              targetWeight: ex.targetWeight || 0,
              completed: false,
            })),
          }))
        );
        markDirty();
      }
    } catch {
      alert('Failed to generate program. Make sure the server is running with API keys configured.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert('Please enter a program name');
      return;
    }

    const programData = {
      name,
      description,
      duration,
      daysPerWeek: workoutDays.length,
      goal,
      workoutDays,
    };

    if (existingProgram) {
      updateProgram(existingProgram.id, programData);
    } else {
      addProgram(programData);
    }

    setIsDirty(false);
    navigate('/programs');
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (isDirty && !confirm('You have unsaved changes. Leave anyway?')) return;
              navigate('/programs');
            }}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Back to programs"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">
              {existingProgram ? 'Edit Program' : 'Create Program'}
            </h1>
            <p className="text-gray-400 mt-1">Design your workout program</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAIGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-accent-500/20 text-accent-400 rounded-xl hover:bg-accent-500/30 transition-colors disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            <span className="hidden sm:inline">{isGenerating ? 'Generating...' : 'AI Generate'}</span>
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl font-semibold hover:opacity-90 transition-opacity"
          >
            <Save className="w-5 h-5" />
            Save
          </button>
        </div>
      </div>

      {/* Basic Info */}
      <div className="glass rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4">Program Details</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="program-name" className="block text-sm text-gray-400 mb-2">Program Name</label>
            <input
              id="program-name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); markDirty(); }}
              placeholder="e.g., Hypertrophy Block"
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl focus:outline-none focus:border-primary-500 transition-colors"
            />
          </div>
          <div>
            <label htmlFor="program-goal" className="block text-sm text-gray-400 mb-2">Goal</label>
            <select
              id="program-goal"
              value={goal}
              onChange={(e) => { setGoal(e.target.value as Program['goal']); markDirty(); }}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl focus:outline-none focus:border-primary-500 transition-colors"
            >
              <option value="strength">Strength</option>
              <option value="hypertrophy">Hypertrophy</option>
              <option value="powerlifting">Powerlifting</option>
              <option value="bodybuilding">Bodybuilding</option>
              <option value="general">General Fitness</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="program-desc" className="block text-sm text-gray-400 mb-2">Description</label>
            <textarea
              id="program-desc"
              value={description}
              onChange={(e) => { setDescription(e.target.value); markDirty(); }}
              placeholder="Describe your program..."
              rows={2}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl focus:outline-none focus:border-primary-500 transition-colors resize-none"
            />
          </div>
          <div>
            <label htmlFor="program-duration" className="block text-sm text-gray-400 mb-2">
              Duration (weeks)
            </label>
            <input
              id="program-duration"
              type="number"
              value={duration}
              onChange={(e) => { setDuration(Math.min(52, Math.max(1, parseInt(e.target.value) || 1))); markDirty(); }}
              min={1}
              max={52}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl focus:outline-none focus:border-primary-500 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Workout Days */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Workout Days</h2>
          <button
            onClick={addWorkoutDay}
            className="flex items-center gap-2 px-3 py-2 bg-primary-500/20 text-primary-400 rounded-lg hover:bg-primary-500/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Day
          </button>
        </div>

        {workoutDays.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>No workout days added yet.</p>
            <p className="text-sm">Click "Add Day" to start building your program.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {workoutDays.map((day) => (
              <div
                key={day.id}
                className="bg-gray-800/30 rounded-xl border border-gray-700/50 overflow-hidden"
              >
                {/* Day Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800/50 transition-colors"
                  onClick={() =>
                    setExpandedDay(expandedDay === day.id ? null : day.id)
                  }
                >
                  <div className="flex items-center gap-3">
                    <GripVertical className="w-4 h-4 text-gray-600" />
                    <div>
                      <input
                        type="text"
                        value={day.name}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateWorkoutDay(day.id, { name: e.target.value });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-transparent font-medium focus:outline-none focus-visible:ring-1 focus-visible:ring-primary-500 rounded"
                        placeholder="Day name"
                        aria-label="Workout day name"
                      />
                      <p className="text-sm text-gray-500">
                        {day.exercises.length} exercises
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={day.dayOfWeek}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateWorkoutDay(day.id, {
                          dayOfWeek: parseInt(e.target.value),
                        });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="text-sm bg-gray-700 border-0 rounded-lg px-2 py-1 focus:outline-none"
                      aria-label="Day of week"
                    >
                      {DAYS_OF_WEEK.map((dayName, idx) => (
                        <option key={idx} value={idx}>
                          {dayName}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateWorkoutDay(day);
                      }}
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                      aria-label="Duplicate workout day"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Remove this workout day?')) {
                          removeWorkoutDay(day.id);
                        }
                      }}
                      className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                      aria-label="Remove workout day"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {expandedDay === day.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedDay === day.id && (
                  <div className="p-4 pt-0 border-t border-gray-700/50">
                    {/* Exercises */}
                    <div className="space-y-3">
                      {day.exercises.map((exercise, idx) => (
                        <div
                          key={exercise.id}
                          className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg"
                        >
                          <span className="text-sm text-gray-500 w-6">
                            {idx + 1}.
                          </span>
                          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                            <input
                              type="text"
                              value={exercise.exerciseName}
                              onChange={(e) =>
                                updateExercise(day.id, exercise.id, {
                                  exerciseName: e.target.value,
                                })
                              }
                              placeholder="Exercise name"
                              className="col-span-2 md:col-span-1 px-3 py-2 bg-gray-700/50 rounded-lg text-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-primary-500"
                              list={`exercises-${day.id}`}
                              aria-label="Exercise name"
                            />
                            <datalist id={`exercises-${day.id}`}>
                              {MUSCLE_GROUPS.flatMap((g) => g.exercises).map(
                                (ex) => (
                                  <option key={ex} value={ex} />
                                )
                              )}
                            </datalist>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={exercise.setNumber}
                                onChange={(e) =>
                                  updateExercise(day.id, exercise.id, {
                                    setNumber: parseInt(e.target.value) || 1,
                                  })
                                }
                                min={1}
                                className="w-16 px-2 py-2 bg-gray-700/50 rounded-lg text-sm text-center focus:outline-none focus-visible:ring-1 focus-visible:ring-primary-500"
                                aria-label="Number of sets"
                              />
                              <span className="text-sm text-gray-500">sets</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={exercise.targetReps}
                                onChange={(e) =>
                                  updateExercise(day.id, exercise.id, {
                                    targetReps: parseInt(e.target.value) || 0,
                                  })
                                }
                                min={0}
                                className="w-16 px-2 py-2 bg-gray-700/50 rounded-lg text-sm text-center focus:outline-none focus-visible:ring-1 focus-visible:ring-primary-500"
                                aria-label="Target reps"
                              />
                              <span className="text-sm text-gray-500">reps</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={exercise.targetWeight}
                                onChange={(e) =>
                                  updateExercise(day.id, exercise.id, {
                                    targetWeight: parseInt(e.target.value) || 0,
                                  })
                                }
                                min={0}
                                className="w-20 px-2 py-2 bg-gray-700/50 rounded-lg text-sm text-center focus:outline-none focus-visible:ring-1 focus-visible:ring-primary-500"
                                aria-label="Target weight"
                              />
                              <span className="text-sm text-gray-500">lbs</span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => duplicateSet(day.id, exercise)}
                              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                              aria-label="Duplicate set"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => removeExercise(day.id, exercise.id)}
                              className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                              aria-label="Remove exercise"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => addExercise(day.id)}
                      className="mt-3 flex items-center gap-2 px-4 py-2 w-full justify-center bg-gray-700/30 text-gray-400 rounded-lg hover:bg-gray-700/50 hover:text-white transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Exercise
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
