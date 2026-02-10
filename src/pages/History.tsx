import { useState, useRef, useMemo } from 'react';
import {
  Calendar,
  TrendingUp,
  Dumbbell,
  Clock,
  Trophy,
  ChevronDown,
  ChevronUp,
  Filter,
  Download,
  Upload,
  Search,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { format, parseISO, startOfWeek, isWithinInterval, subWeeks } from 'date-fns';
import { calcVolume } from '../types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

type TimeFilter = 'all' | 'week' | 'month' | '3months';

export default function History() {
  const { workoutLogs, getPersonalRecords, exportData, importData } = useStore();
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedExercise, setSelectedExercise] = useState<string>('');

  const personalRecords = getPersonalRecords();

  // Get unique exercise names from all workout logs
  const allExerciseNames = useMemo(() => {
    const names = new Set<string>();
    workoutLogs.forEach((log) => {
      log.sets.forEach((set) => {
        if (set.completed && set.exerciseName) names.add(set.exerciseName);
      });
    });
    return Array.from(names).sort();
  }, [workoutLogs]);

  // Build exercise-specific chart data
  const exerciseChartData = useMemo(() => {
    if (!selectedExercise) return [];
    return workoutLogs
      .filter((log) => log.completed)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .reduce<{ date: string; bestWeight: number; bestVolume: number }[]>((acc, log) => {
        const matching = log.sets.filter(
          (s) => s.completed && s.exerciseName === selectedExercise && s.actualWeight
        );
        if (matching.length === 0) return acc;
        const bestWeight = Math.max(...matching.map((s) => s.actualWeight || 0));
        const bestVolume = Math.max(
          ...matching.map((s) => (s.actualWeight || 0) * (s.actualReps || 0))
        );
        acc.push({
          date: format(parseISO(log.date), 'MMM d'),
          bestWeight,
          bestVolume,
        });
        return acc;
      }, []);
  }, [selectedExercise, workoutLogs]);

  // Filter logs based on time period
  const filteredLogs = workoutLogs
    .filter((log) => {
      if (!log.completed) return false;
      const logDate = parseISO(log.date);
      const now = new Date();

      switch (timeFilter) {
        case 'week':
          return isWithinInterval(logDate, {
            start: subWeeks(now, 1),
            end: now,
          });
        case 'month':
          return isWithinInterval(logDate, {
            start: subWeeks(now, 4),
            end: now,
          });
        case '3months':
          return isWithinInterval(logDate, {
            start: subWeeks(now, 12),
            end: now,
          });
        default:
          return true;
      }
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Calculate chart data
  const volumeChartData = filteredLogs
    .slice()
    .reverse()
    .map((log) => ({
      date: format(parseISO(log.date), 'MMM d'),
      volume: calcVolume(log.sets),
    }));

  const weeklyChartData = (() => {
    const weeks: { [key: string]: number } = {};
    filteredLogs.forEach((log) => {
      const weekStart = format(startOfWeek(parseISO(log.date)), 'MMM d');
      weeks[weekStart] = (weeks[weekStart] || 0) + 1;
    });
    return Object.entries(weeks)
      .map(([week, count]) => ({ week, workouts: count }))
      .slice(-8);
  })();

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Workout History</h1>
          <p className="text-gray-400 mt-1">Track your progress over time</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const data = exportData();
              const blob = new Blob([data], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `fbb-coach-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-1 px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm"
            title="Export all data"
            aria-label="Export all data"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm"
            title="Import data from backup"
            aria-label="Import data from backup"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Import</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (event) => {
                const result = event.target?.result;
                if (typeof result === 'string') {
                  if (confirm('This will replace all current data. Continue?')) {
                    const success = importData(result);
                    alert(success ? 'Data imported successfully!' : 'Invalid backup file.');
                  }
                }
              };
              reader.readAsText(file);
              e.target.value = '';
            }}
          />
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
            aria-label="Time period filter"
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
          >
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="3months">Last 3 Months</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Dumbbell className="w-5 h-5" />}
          label="Workouts"
          value={filteredLogs.length}
          color="primary"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Total Volume"
          value={`${(
            filteredLogs.reduce((acc, log) => acc + calcVolume(log.sets), 0) / 1000
          ).toFixed(0)}k lbs`}
          color="green"
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Avg Duration"
          value={`${Math.round(
            filteredLogs.reduce((acc, log) => acc + log.duration, 0) /
              (filteredLogs.length || 1)
          )} min`}
          color="orange"
        />
        <StatCard
          icon={<Trophy className="w-5 h-5" />}
          label="PRs Set"
          value={personalRecords.length}
          color="accent"
        />
      </div>

      {/* Charts */}
      {filteredLogs.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Volume Chart */}
          <div className="glass rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">Volume Over Time</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={volumeChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
                  <YAxis stroke="#9CA3AF" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#9CA3AF' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="volume"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    dot={{ fill: '#0ea5e9', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Weekly Frequency */}
          <div className="glass rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">Weekly Frequency</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="week" stroke="#9CA3AF" fontSize={12} />
                  <YAxis stroke="#9CA3AF" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#9CA3AF' }}
                  />
                  <Bar dataKey="workouts" fill="#d946ef" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Exercise Progress */}
      {allExerciseNames.length > 0 && (
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Search className="w-5 h-5 text-primary-400" />
            Exercise Progress
          </h2>
          <div className="mb-4">
            <select
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
              aria-label="Select exercise to track"
              className="w-full md:w-64 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
            >
              <option value="">Select an exercise...</option>
              {allExerciseNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          {selectedExercise && exerciseChartData.length > 0 ? (
            <div className="grid lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm text-gray-400 mb-2">Best Weight per Session</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={exerciseChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
                      <YAxis stroke="#9CA3AF" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1F2937',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: '#9CA3AF' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="bestWeight"
                        stroke="#22c55e"
                        strokeWidth={2}
                        dot={{ fill: '#22c55e', strokeWidth: 2 }}
                        name="Weight (lbs)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <h3 className="text-sm text-gray-400 mb-2">Best Set Volume per Session</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={exerciseChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
                      <YAxis stroke="#9CA3AF" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1F2937',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: '#9CA3AF' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="bestVolume"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={{ fill: '#f59e0b', strokeWidth: 2 }}
                        name="Volume (lbs)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : selectedExercise ? (
            <p className="text-gray-500 text-sm">No data found for {selectedExercise} in logged workouts.</p>
          ) : null}
        </div>
      )}

      {/* Personal Records */}
      {personalRecords.length > 0 && (
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            Personal Records
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {personalRecords.slice(0, 9).map((pr, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg"
              >
                <div>
                  <p className="font-medium">{pr.exerciseName}</p>
                  <p className="text-sm text-gray-500">
                    {format(parseISO(pr.date), 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-yellow-400">
                    {pr.weight} × {pr.reps}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(pr.weight * pr.reps).toLocaleString()} lbs
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Workout Logs */}
      <div className="glass rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4">Workout Log</h2>

        {filteredLogs.length > 0 ? (
          <div className="space-y-3">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="bg-gray-800/30 rounded-xl overflow-hidden"
              >
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800/50 transition-colors"
                  onClick={() =>
                    setExpandedLog(expandedLog === log.id ? null : log.id)
                  }
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary-500/20 rounded-xl flex flex-col items-center justify-center">
                      <span className="text-xs text-primary-400">
                        {format(parseISO(log.date), 'MMM')}
                      </span>
                      <span className="text-lg font-bold">
                        {format(parseISO(log.date), 'd')}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">
                        {format(parseISO(log.date), 'EEEE')}
                      </p>
                      <p className="text-sm text-gray-500">
                        {log.sets.filter((s) => s.completed).length} sets •{' '}
                        {log.duration} min
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                      <p className="font-medium">
                        {calcVolume(log.sets).toLocaleString()} lbs
                      </p>
                      {log.rating && (
                        <div className="flex gap-0.5 justify-end">
                          {[...Array(5)].map((_, i) => (
                            <span
                              key={i}
                              className={
                                i < log.rating! ? 'text-yellow-400' : 'text-gray-700'
                              }
                            >
                              ★
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {expandedLog === log.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {expandedLog === log.id && (
                  <div className="px-4 pb-4 border-t border-gray-700/50">
                    <div className="pt-4 space-y-2">
                      {log.sets
                        .filter((s) => s.completed)
                        .map((set, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between py-2 text-sm"
                          >
                            <span className="text-gray-300">{set.exerciseName}</span>
                            <span className="text-gray-500">
                              {set.actualReps} × {set.actualWeight} lbs
                              {set.rpe && ` @ RPE ${set.rpe}`}
                            </span>
                          </div>
                        ))}
                    </div>
                    {log.notes && (
                      <div className="mt-4 pt-4 border-t border-gray-700/50">
                        <p className="text-sm text-gray-400">{log.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No workouts in this time period</p>
            <p className="text-sm text-gray-500">
              Complete a workout to see it here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: 'primary' | 'green' | 'orange' | 'accent';
}) {
  const colors = {
    primary: 'bg-primary-500/20 text-primary-400',
    green: 'bg-green-500/20 text-green-400',
    orange: 'bg-orange-500/20 text-orange-400',
    accent: 'bg-accent-500/20 text-accent-400',
  };

  return (
    <div className="glass rounded-2xl p-4">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colors[color]}`}
      >
        {icon}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
}
