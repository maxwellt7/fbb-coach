import { Link } from 'react-router-dom';
import {
  Dumbbell,
  TrendingUp,
  Flame,
  Trophy,
  ChevronRight,
  Play,
  Calendar,
  Target,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { format, isToday, parseISO } from 'date-fns';

export default function Dashboard() {
  const { activeProgram, workoutLogs, currentWorkout, getStats } = useStore();
  const stats = getStats();
  
  const recentWorkouts = workoutLogs
    .filter((l) => l.completed)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const todayWorkout = activeProgram?.workoutDays.find(
    (d) => d.dayOfWeek === new Date().getDay()
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">
            Welcome back! <span className="gradient-text">Let's crush it.</span>
          </h1>
          <p className="text-gray-400 mt-1">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        
        {currentWorkout ? (
          <Link
            to="/tracker"
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl font-semibold hover:opacity-90 transition-opacity"
          >
            <Play className="w-5 h-5" />
            Continue Workout
          </Link>
        ) : (
          <Link
            to="/tracker"
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl font-semibold hover:opacity-90 transition-opacity"
          >
            <Play className="w-5 h-5" />
            Start Workout
          </Link>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-2xl p-4 lg:p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-primary-500/20 rounded-xl flex items-center justify-center">
              <Dumbbell className="w-5 h-5 text-primary-400" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold">{stats.totalWorkouts}</p>
          <p className="text-sm text-gray-400">Total Workouts</p>
        </div>

        <div className="glass rounded-2xl p-4 lg:p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
              <Flame className="w-5 h-5 text-orange-400" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold">{stats.currentStreak}</p>
          <p className="text-sm text-gray-400">Day Streak</p>
        </div>

        <div className="glass rounded-2xl p-4 lg:p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold">
            {stats.totalVolume >= 1000
              ? `${(stats.totalVolume / 1000).toFixed(0)}k`
              : stats.totalVolume}
          </p>
          <p className="text-sm text-gray-400">Total Volume (lbs)</p>
        </div>

        <div className="glass rounded-2xl p-4 lg:p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-accent-500/20 rounded-xl flex items-center justify-center">
              <Trophy className="w-5 h-5 text-accent-400" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold">{stats.personalRecords.length}</p>
          <p className="text-sm text-gray-400">Personal Records</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Today's Workout */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-400" />
              Today's Workout
            </h2>
            {activeProgram && (
              <span className="text-xs px-2 py-1 bg-primary-500/20 text-primary-400 rounded-full">
                {activeProgram.name}
              </span>
            )}
          </div>

          {activeProgram && todayWorkout ? (
            <div className="space-y-3">
              <h3 className="font-medium text-lg">{todayWorkout.name}</h3>
              <div className="space-y-2">
                {todayWorkout.exercises.slice(0, 4).map((exercise, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0"
                  >
                    <span className="text-gray-300">{exercise.exerciseName}</span>
                    <span className="text-sm text-gray-500">
                      {exercise.targetReps} × {exercise.targetWeight}lbs
                    </span>
                  </div>
                ))}
                {todayWorkout.exercises.length > 4 && (
                  <p className="text-sm text-gray-500">
                    +{todayWorkout.exercises.length - 4} more exercises
                  </p>
                )}
              </div>
              <Link
                to="/tracker"
                className="flex items-center justify-center gap-2 w-full mt-4 py-3 bg-primary-500/20 text-primary-400 rounded-xl hover:bg-primary-500/30 transition-colors"
              >
                Start This Workout
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="text-center py-8">
              <Target className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 mb-4">
                {activeProgram
                  ? 'Rest day - no workout scheduled'
                  : 'No active program selected'}
              </p>
              <Link
                to="/programs"
                className="text-primary-400 hover:text-primary-300 text-sm"
              >
                {activeProgram ? 'View Program' : 'Browse Programs'} →
              </Link>
            </div>
          )}
        </div>

        {/* Recent Workouts */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Workouts</h2>
            <Link
              to="/history"
              className="text-sm text-primary-400 hover:text-primary-300"
            >
              View All
            </Link>
          </div>

          {recentWorkouts.length > 0 ? (
            <div className="space-y-3">
              {recentWorkouts.map((workout) => (
                <div
                  key={workout.id}
                  className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0"
                >
                  <div>
                    <p className="font-medium">
                      {isToday(parseISO(workout.date))
                        ? 'Today'
                        : format(parseISO(workout.date), 'MMM d')}
                    </p>
                    <p className="text-sm text-gray-500">
                      {workout.sets.length} sets • {workout.duration} min
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">
                      {workout.sets
                        .reduce(
                          (acc, s) => acc + (s.actualWeight || 0) * (s.actualReps || 0),
                          0
                        )
                        .toLocaleString()}{' '}
                      lbs
                    </p>
                    {workout.rating && (
                      <div className="flex gap-0.5 justify-end">
                        {[...Array(5)].map((_, i) => (
                          <span
                            key={i}
                            className={i < workout.rating! ? 'text-yellow-400' : 'text-gray-700'}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Dumbbell className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No workouts logged yet</p>
              <p className="text-sm text-gray-500">Start your first workout to see history</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/programs/new"
            className="flex flex-col items-center gap-2 p-4 bg-gray-800/50 rounded-xl hover:bg-gray-800 transition-colors"
          >
            <div className="w-12 h-12 bg-primary-500/20 rounded-xl flex items-center justify-center">
              <ClipboardList className="w-6 h-6 text-primary-400" />
            </div>
            <span className="text-sm text-center">Create Program</span>
          </Link>

          <Link
            to="/tracker"
            className="flex flex-col items-center gap-2 p-4 bg-gray-800/50 rounded-xl hover:bg-gray-800 transition-colors"
          >
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
              <Play className="w-6 h-6 text-green-400" />
            </div>
            <span className="text-sm text-center">Quick Workout</span>
          </Link>

          <Link
            to="/coach"
            className="flex flex-col items-center gap-2 p-4 bg-gray-800/50 rounded-xl hover:bg-gray-800 transition-colors"
          >
            <div className="w-12 h-12 bg-accent-500/20 rounded-xl flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-accent-400" />
            </div>
            <span className="text-sm text-center">Ask AI Coach</span>
          </Link>

          <Link
            to="/history"
            className="flex flex-col items-center gap-2 p-4 bg-gray-800/50 rounded-xl hover:bg-gray-800 transition-colors"
          >
            <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-orange-400" />
            </div>
            <span className="text-sm text-center">View Progress</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function ClipboardList(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" />
      <path d="M12 16h4" />
      <path d="M8 11h.01" />
      <path d="M8 16h.01" />
    </svg>
  );
}

function MessageCircle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}
