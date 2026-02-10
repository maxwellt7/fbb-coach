import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  Pause,
  CheckCircle,
  RotateCcw,
  Plus,
  Trash2,
  Clock,
  X,
  Save,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../store/useStore';
import type { WorkoutSet } from '../types';
import { MUSCLE_GROUPS, calcVolume } from '../types';

export default function Tracker() {
  const navigate = useNavigate();
  const {
    activeProgram,
    currentWorkout,
    startWorkout,
    updateCurrentWorkout,
    completeSet,
    uncompleteSet,
    finishWorkout,
    cancelWorkout,
  } = useStore();

  const [elapsedTime, setElapsedTime] = useState(0);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState(0);
  const [restTimer, setRestTimer] = useState(0);
  const [restTimerActive, setRestTimerActive] = useState(false);
  const [restDuration, setRestDuration] = useState(90);

  // Timer effect
  useEffect(() => {
    if (!currentWorkout) return;

    const startTime = new Date(currentWorkout.date).getTime();
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [currentWorkout]);

  // Prevent accidental data loss during active workout
  useEffect(() => {
    if (!currentWorkout) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentWorkout]);

  // Rest timer countdown
  useEffect(() => {
    if (!restTimerActive || restTimer <= 0) {
      if (restTimerActive && restTimer <= 0) {
        setRestTimerActive(false);
      }
      return;
    }

    const interval = setInterval(() => {
      setRestTimer((prev) => {
        if (prev <= 1) {
          setRestTimerActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [restTimerActive, restTimer]);

  /** Parse rest string like "2-3 min", "90 sec", "90s", "2 min" to seconds */
  const parseRestDuration = (restStr: string): number => {
    const s = restStr.toLowerCase().trim();
    // "90 sec" or "90s"
    const secMatch = s.match(/^(\d+)\s*s(ec)?/);
    if (secMatch) return parseInt(secMatch[1]);
    // "2-3 min" — take the lower bound
    const rangeMinMatch = s.match(/^(\d+)-\d+\s*min/);
    if (rangeMinMatch) return parseInt(rangeMinMatch[1]) * 60;
    // "2 min" or "3min"
    const minMatch = s.match(/^(\d+)\s*min/);
    if (minMatch) return parseInt(minMatch[1]) * 60;
    return 0;
  };

  const startRestTimer = (customDuration?: number) => {
    setRestTimer(customDuration || restDuration);
    setRestTimerActive(true);
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartWorkout = (workoutDayId?: string) => {
    const sets = workoutDayId
      ? activeProgram?.workoutDays.find((d) => d.id === workoutDayId)?.exercises || []
      : [];
    startWorkout(activeProgram?.id, workoutDayId, sets);
  };

  const handleAddSet = () => {
    if (!currentWorkout) return;

    const newSet: WorkoutSet = {
      id: uuidv4(),
      exerciseId: uuidv4(),
      exerciseName: '',
      setNumber: 1,
      targetReps: 10,
      targetWeight: 0,
      completed: false,
    };

    updateCurrentWorkout({
      sets: [...currentWorkout.sets, newSet],
    });
  };

  const handleUpdateSet = (setId: string, updates: Partial<WorkoutSet>) => {
    if (!currentWorkout) return;

    updateCurrentWorkout({
      sets: currentWorkout.sets.map((s) =>
        s.id === setId ? { ...s, ...updates } : s
      ),
    });
  };

  const handleRemoveSet = (setId: string) => {
    if (!currentWorkout) return;

    updateCurrentWorkout({
      sets: currentWorkout.sets.filter((s) => s.id !== setId),
    });
  };

  const handleCompleteSet = (set: WorkoutSet) => {
    if (set.completed) {
      uncompleteSet(set.id);
    } else {
      completeSet(
        set.id,
        set.actualReps || set.targetReps,
        set.actualWeight || set.targetWeight,
        set.rpe
      );
      // Auto-start rest timer with prescribed duration
      if (set.rest) {
        const dur = parseRestDuration(set.rest);
        if (dur > 0) startRestTimer(dur);
      }
    }
  };

  const handleFinish = () => {
    finishWorkout(notes, rating);
    setShowFinishModal(false);
    navigate('/history');
  };

  const handleCancel = () => {
    if (confirm('Are you sure you want to cancel this workout? Progress will be lost.')) {
      cancelWorkout();
    }
  };

  // If no workout is active, show start options
  if (!currentWorkout) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Workout Tracker</h1>
          <p className="text-gray-400 mt-1">Start tracking your workout</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Quick Start */}
          <div className="glass rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">Quick Start</h2>
            <p className="text-gray-400 text-sm mb-4">
              Start an empty workout and add exercises as you go.
            </p>
            <button
              onClick={() => handleStartWorkout()}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl font-semibold hover:opacity-90 transition-opacity"
            >
              <Play className="w-5 h-5" />
              Start Empty Workout
            </button>
          </div>

          {/* From Program */}
          {activeProgram && (
            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-2">From Program</h2>
              <p className="text-sm text-primary-400 mb-4">{activeProgram.name}</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {activeProgram.workoutDays.map((day) => (
                  <button
                    key={day.id}
                    onClick={() => handleStartWorkout(day.id)}
                    className="w-full flex items-center justify-between p-3 bg-gray-800/50 rounded-xl hover:bg-gray-800 transition-colors"
                  >
                    <div className="text-left">
                      <p className="font-medium">{day.name}</p>
                      <p className="text-sm text-gray-500">
                        {day.exercises.length} exercises
                      </p>
                    </div>
                    <Play className="w-5 h-5 text-primary-400" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Active workout view
  const completedSets = currentWorkout.sets.filter((s) => s.completed).length;
  const totalSets = currentWorkout.sets.length;
  const totalVolume = calcVolume(currentWorkout.sets);

  // Group sets by exercise name for visual grouping
  const exerciseGroups: { name: string; sets: (WorkoutSet & { originalIndex: number })[] }[] = [];
  currentWorkout.sets.forEach((set, idx) => {
    const lastGroup = exerciseGroups[exerciseGroups.length - 1];
    if (lastGroup && lastGroup.name === set.exerciseName && set.exerciseName !== '') {
      lastGroup.sets.push({ ...set, originalIndex: idx });
    } else {
      exerciseGroups.push({ name: set.exerciseName, sets: [{ ...set, originalIndex: idx }] });
    }
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header with timer */}
      <div className="glass rounded-2xl p-4 sticky top-16 lg:top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary-400" />
              <span className="text-2xl font-mono font-bold">
                {formatTime(elapsedTime)}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span>{completedSets}/{totalSets} sets</span>
              <span className="hidden sm:inline">{totalVolume.toLocaleString()} lbs</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
              aria-label="Cancel workout"
            >
              <X className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowFinishModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
            >
              <Save className="w-5 h-5" />
              <span className="hidden sm:inline">Finish</span>
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-accent-500 transition-all duration-300"
            style={{
              width: totalSets > 0 ? `${(completedSets / totalSets) * 100}%` : '0%',
            }}
          />
        </div>

        {/* Rest Timer */}
        <div className="mt-3 flex items-center gap-3">
          {restTimerActive ? (
            <div className="flex items-center gap-2">
              <span className={`text-lg font-mono font-bold ${restTimer <= 10 ? 'text-red-400 animate-pulse' : 'text-yellow-400'}`}>
                Rest: {Math.floor(restTimer / 60)}:{(restTimer % 60).toString().padStart(2, '0')}
              </span>
              <button
                onClick={() => { setRestTimerActive(false); setRestTimer(0); }}
                className="text-xs px-2 py-1 bg-gray-800 text-gray-400 rounded hover:bg-gray-700 transition-colors"
              >
                Skip
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => startRestTimer()}
                className="flex items-center gap-1 text-sm px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors"
              >
                <Pause className="w-3 h-3" />
                Rest Timer
              </button>
              <select
                value={restDuration}
                onChange={(e) => setRestDuration(parseInt(e.target.value))}
                className="text-xs bg-gray-800 border-0 rounded px-2 py-1 text-gray-400 focus:outline-none"
                aria-label="Rest duration"
              >
                <option value={30}>30s</option>
                <option value={60}>60s</option>
                <option value={90}>90s</option>
                <option value={120}>2min</option>
                <option value={180}>3min</option>
                <option value={300}>5min</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Shared datalist for exercise autocomplete (rendered once) */}
      <datalist id="all-exercises">
        {MUSCLE_GROUPS.flatMap((g) => g.exercises).map((ex) => (
          <option key={ex} value={ex} />
        ))}
      </datalist>

      {/* Sets List - grouped by exercise */}
      <div className="space-y-4">
        {exerciseGroups.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-2">
            {group.name && group.sets.length > 1 && (
              <h3 className="text-sm font-medium text-gray-400 px-1">
                {group.name} — {group.sets.filter(s => s.completed).length}/{group.sets.length} sets
              </h3>
            )}
            {group.sets.map((set) => (
              <SetCard
                key={set.id}
                set={set}
                index={set.originalIndex}
                onUpdate={(updates) => handleUpdateSet(set.id, updates)}
                onComplete={() => handleCompleteSet(set)}
                onRemove={() => handleRemoveSet(set.id)}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Add Set Button */}
      <button
        onClick={handleAddSet}
        className="w-full flex items-center justify-center gap-2 py-4 glass rounded-xl text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
      >
        <Plus className="w-5 h-5" />
        Add Set
      </button>

      {/* Finish Modal */}
      {showFinishModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 w-full max-w-md animate-fadeIn">
            <h2 className="text-xl font-semibold mb-4">Finish Workout</h2>

            {/* Workout Summary */}
            <div className="mb-4 p-3 bg-gray-800/50 rounded-xl text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-gray-400">Duration</span>
                <span>{formatTime(elapsedTime)}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-400">Sets Completed</span>
                <span>{completedSets}/{totalSets}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Volume</span>
                <span>{totalVolume.toLocaleString()} lbs</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  How was your workout?
                </label>
                <div className="flex gap-2 justify-center" role="radiogroup" aria-label="Workout rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className={`text-3xl transition-colors ${
                        star <= rating ? 'text-yellow-400' : 'text-gray-600'
                      }`}
                      aria-label={`Rate ${star} out of 5 stars`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="workout-notes" className="block text-sm text-gray-400 mb-2">
                  Notes (optional)
                </label>
                <textarea
                  id="workout-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="How did it feel? Any PRs?"
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl focus:outline-none focus:border-primary-500 transition-colors resize-none"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowFinishModal(false)}
                  className="flex-1 py-3 bg-gray-800 rounded-xl hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFinish}
                  className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl font-semibold hover:opacity-90 transition-opacity"
                >
                  Save Workout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SetCard({
  set,
  index,
  onUpdate,
  onComplete,
  onRemove,
}: {
  set: WorkoutSet;
  index: number;
  onUpdate: (updates: Partial<WorkoutSet>) => void;
  onComplete: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`glass rounded-xl p-4 ${
        set.completed ? 'border-green-500/30 bg-green-500/5' : ''
      }`}
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="text-sm text-gray-500 w-6">{index + 1}.</span>
        <input
          type="text"
          value={set.exerciseName}
          onChange={(e) => onUpdate({ exerciseName: e.target.value })}
          placeholder="Exercise name"
          className="flex-1 bg-transparent text-lg font-medium focus:outline-none focus-visible:ring-1 focus-visible:ring-primary-500 rounded"
          list="all-exercises"
          aria-label="Exercise name"
        />
        <button
          onClick={onRemove}
          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
          aria-label="Remove set"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Target</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={set.targetReps}
              onChange={(e) => onUpdate({ targetReps: parseInt(e.target.value) || 0 })}
              className="w-full px-2 py-2 bg-gray-800/50 rounded-lg text-sm text-center focus:outline-none focus-visible:ring-1 focus-visible:ring-primary-500"
              aria-label="Target reps"
            />
            <span className="text-xs text-gray-500">×</span>
            <input
              type="number"
              value={set.targetWeight}
              onChange={(e) => onUpdate({ targetWeight: parseInt(e.target.value) || 0 })}
              className="w-full px-2 py-2 bg-gray-800/50 rounded-lg text-sm text-center focus:outline-none focus-visible:ring-1 focus-visible:ring-primary-500"
              aria-label="Target weight"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Actual Reps</label>
          <input
            type="number"
            value={set.actualReps ?? set.targetReps}
            onChange={(e) => onUpdate({ actualReps: parseInt(e.target.value) || 0 })}
            className="w-full px-2 py-2 bg-gray-800/50 rounded-lg text-sm text-center focus:outline-none focus-visible:ring-1 focus-visible:ring-primary-500"
            aria-label="Actual reps"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Actual Weight</label>
          <input
            type="number"
            value={set.actualWeight ?? set.targetWeight}
            onChange={(e) => onUpdate({ actualWeight: parseInt(e.target.value) || 0 })}
            className="w-full px-2 py-2 bg-gray-800/50 rounded-lg text-sm text-center focus:outline-none focus-visible:ring-1 focus-visible:ring-primary-500"
            aria-label="Actual weight"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">RPE</label>
          <select
            value={set.rpe || ''}
            onChange={(e) => onUpdate({ rpe: e.target.value ? parseInt(e.target.value) : undefined })}
            className="w-full px-2 py-2 bg-gray-800/50 rounded-lg text-sm text-center focus:outline-none focus-visible:ring-1 focus-visible:ring-primary-500"
            aria-label="RPE rating"
          >
            <option value="">-</option>
            {[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((rpe) => (
              <option key={rpe} value={rpe}>
                {rpe}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tempo / Intensity / Rest badges */}
      {(set.tempo || set.intensity || set.rest) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {set.tempo && (
            <span className="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded-full">
              {set.tempo}
            </span>
          )}
          {set.intensity && (
            <span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full">
              {set.intensity}
            </span>
          )}
          {set.rest && (
            <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full">
              Rest: {set.rest}
            </span>
          )}
        </div>
      )}

      {/* Exercise notes */}
      {set.notes && (
        <p className="mt-1.5 text-xs text-gray-500 italic">{set.notes}</p>
      )}

      <button
        onClick={onComplete}
        className={`mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-lg transition-colors ${
          set.completed
            ? 'bg-green-500/20 text-green-400 hover:bg-yellow-500/20 hover:text-yellow-400'
            : 'bg-primary-500/20 text-primary-400 hover:bg-primary-500/30'
        }`}
      >
        {set.completed ? (
          <>
            <RotateCcw className="w-4 h-4" />
            Undo
          </>
        ) : (
          <>
            <CheckCircle className="w-4 h-4" />
            Complete Set
          </>
        )}
      </button>
    </div>
  );
}
