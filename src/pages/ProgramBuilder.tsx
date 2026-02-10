import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Save,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  GripVertical,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../store/useStore';
import type { Program, WorkoutDay, WorkoutSet } from '../types';
import { MUSCLE_GROUPS } from '../types';

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export default function ProgramBuilder() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { programs, addProgram, updateProgram } = useStore();

  const existingProgram = id ? programs.find((p) => p.id === id) : null;

  const [name, setName] = useState(existingProgram?.name || '');
  const [description, setDescription] = useState(existingProgram?.description || '');
  const [duration, setDuration] = useState(existingProgram?.duration || 8);
  const [goal, setGoal] = useState<Program['goal']>(existingProgram?.goal || 'hypertrophy');
  const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>(
    existingProgram?.workoutDays || []
  );
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const addWorkoutDay = () => {
    const newDay: WorkoutDay = {
      id: uuidv4(),
      name: `Day ${workoutDays.length + 1}`,
      dayOfWeek: workoutDays.length % 7,
      exercises: [],
    };
    setWorkoutDays([...workoutDays, newDay]);
    setExpandedDay(newDay.id);
  };

  const updateWorkoutDay = (dayId: string, updates: Partial<WorkoutDay>) => {
    setWorkoutDays(
      workoutDays.map((d) => (d.id === dayId ? { ...d, ...updates } : d))
    );
  };

  const removeWorkoutDay = (dayId: string) => {
    setWorkoutDays(workoutDays.filter((d) => d.id !== dayId));
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
  };

  const removeExercise = (dayId: string, setId: string) => {
    setWorkoutDays(
      workoutDays.map((d) =>
        d.id === dayId
          ? { ...d, exercises: d.exercises.filter((e) => e.id !== setId) }
          : d
      )
    );
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

    navigate('/programs');
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">
            {existingProgram ? 'Edit Program' : 'Create Program'}
          </h1>
          <p className="text-gray-400 mt-1">Design your workout program</p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl font-semibold hover:opacity-90 transition-opacity"
        >
          <Save className="w-5 h-5" />
          Save
        </button>
      </div>

      {/* Basic Info */}
      <div className="glass rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4">Program Details</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Program Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Hypertrophy Block"
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl focus:outline-none focus:border-primary-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Goal</label>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value as Program['goal'])}
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
            <label className="block text-sm text-gray-400 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your program..."
              rows={2}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl focus:outline-none focus:border-primary-500 transition-colors resize-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Duration (weeks)
            </label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
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
                        className="bg-transparent font-medium focus:outline-none focus:border-b focus:border-primary-500"
                        placeholder="Day name"
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
                        if (confirm('Remove this workout day?')) {
                          removeWorkoutDay(day.id);
                        }
                      }}
                      className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
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
                              className="col-span-2 md:col-span-1 px-3 py-2 bg-gray-700/50 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                              list={`exercises-${day.id}`}
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
                                className="w-16 px-2 py-2 bg-gray-700/50 rounded-lg text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary-500"
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
                                className="w-16 px-2 py-2 bg-gray-700/50 rounded-lg text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary-500"
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
                                className="w-20 px-2 py-2 bg-gray-700/50 rounded-lg text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary-500"
                              />
                              <span className="text-sm text-gray-500">lbs</span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => duplicateSet(day.id, exercise)}
                              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                              title="Duplicate set"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => removeExercise(day.id, exercise.id)}
                              className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
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
