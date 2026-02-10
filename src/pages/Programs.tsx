import { Link } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Play,
  CheckCircle,
  Calendar,
  Target,
  ChevronRight,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { format, parseISO } from 'date-fns';

export default function Programs() {
  const { programs, activeProgram, setActiveProgram, deleteProgram } = useStore();

  const goalLabels: Record<string, string> = {
    strength: 'Strength',
    hypertrophy: 'Hypertrophy',
    powerlifting: 'Powerlifting',
    bodybuilding: 'Bodybuilding',
    crossfit: 'CrossFit',
    hybrid: 'Hybrid',
    general: 'General Fitness',
  };

  const goalColors: Record<string, string> = {
    strength: 'from-red-500 to-orange-500',
    hypertrophy: 'from-blue-500 to-cyan-500',
    powerlifting: 'from-purple-500 to-pink-500',
    bodybuilding: 'from-green-500 to-emerald-500',
    crossfit: 'from-yellow-500 to-orange-500',
    hybrid: 'from-teal-500 to-blue-500',
    general: 'from-gray-500 to-gray-400',
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Programs</h1>
          <p className="text-gray-400 mt-1">Create and manage your workout programs</p>
        </div>
        <Link
          to="/programs/new"
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">New Program</span>
        </Link>
      </div>

      {/* Active Program Banner */}
      {activeProgram && (
        <div className="glass rounded-2xl p-6 border-l-4 border-primary-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-primary-400 mb-1">Active Program</p>
              <h2 className="text-xl font-semibold">{activeProgram.name}</h2>
              <p className="text-gray-400 text-sm mt-1">
                {activeProgram.daysPerWeek} days/week • {activeProgram.duration} weeks
              </p>
            </div>
            <Link
              to="/tracker"
              className="flex items-center gap-2 px-4 py-2 bg-primary-500/20 text-primary-400 rounded-xl hover:bg-primary-500/30 transition-colors"
            >
              <Play className="w-5 h-5" />
              Start Workout
            </Link>
          </div>
        </div>
      )}

      {/* Programs Grid */}
      {programs.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {programs.map((program) => (
            <div
              key={program.id}
              className={`glass rounded-2xl overflow-hidden ${
                activeProgram?.id === program.id ? 'ring-2 ring-primary-500' : ''
              }`}
            >
              {/* Header gradient */}
              <div
                className={`h-2 bg-gradient-to-r ${goalColors[program.goal] || goalColors.general}`}
              />

              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{program.name}</h3>
                    <p className="text-sm text-gray-400">{program.description}</p>
                  </div>
                  {activeProgram?.id === program.id && (
                    <CheckCircle className="w-5 h-5 text-primary-400 flex-shrink-0" />
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-xs px-2 py-1 bg-gray-800 rounded-full text-gray-300">
                    {goalLabels[program.goal]}
                  </span>
                  <span className="text-xs px-2 py-1 bg-gray-800 rounded-full text-gray-300 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {program.daysPerWeek} days/week
                  </span>
                  <span className="text-xs px-2 py-1 bg-gray-800 rounded-full text-gray-300 flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    {program.duration} weeks
                  </span>
                </div>

                <div className="text-xs text-gray-500 mb-4">
                  Created {format(parseISO(program.createdAt), 'MMM d, yyyy')}
                </div>

                <div className="flex gap-2">
                  {activeProgram?.id !== program.id ? (
                    <button
                      onClick={() => setActiveProgram(program)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-primary-500/20 text-primary-400 rounded-lg hover:bg-primary-500/30 transition-colors"
                    >
                      Set Active
                    </button>
                  ) : (
                    <button
                      onClick={() => setActiveProgram(null)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Deactivate
                    </button>
                  )}
                  <Link
                    to={`/programs/${program.id}`}
                    className="flex items-center justify-center gap-1 px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Edit
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this program?')) {
                        deleteProgram(program.id);
                      }
                    }}
                    className="flex items-center justify-center px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                    aria-label={`Delete ${program.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No Programs Yet</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Create your first workout program to start tracking your progress and following
            a structured training plan.
          </p>
          <Link
            to="/programs/new"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="w-5 h-5" />
            Create Your First Program
          </Link>
        </div>
      )}

      {/* Template Programs */}
      <div className="glass rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4">Program Templates</h2>
        <p className="text-gray-400 text-sm mb-4">
          Quick-start templates based on popular training methodologies
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <TemplateCard
            title="FBB Push/Pull/Legs"
            description="6-day split with tempo prescriptions"
            goal="hypertrophy"
            days={6}
          />
          <TemplateCard
            title="Upper/Lower Strength"
            description="4-day balanced strength program"
            goal="strength"
            days={4}
          />
          <TemplateCard
            title="Hybrid FBB + CrossFit"
            description="5-day FBB strength + CrossFit conditioning"
            goal="crossfit"
            days={5}
          />
          <TemplateCard
            title="Full Body FBB"
            description="3-day program for busy schedules"
            goal="general"
            days={3}
          />
        </div>
      </div>
    </div>
  );
}

function TemplateCard({
  title,
  description,
  goal,
  days,
}: {
  title: string;
  description: string;
  goal: string;
  days: number;
}) {
  const goalColors: Record<string, string> = {
    strength: 'from-red-500/20 to-orange-500/20 border-red-500/30',
    hypertrophy: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
    crossfit: 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30',
    hybrid: 'from-teal-500/20 to-blue-500/20 border-teal-500/30',
    general: 'from-gray-500/20 to-gray-400/20 border-gray-500/30',
  };

  return (
    <Link
      to={`/programs/new?template=${goal}`}
      className={`p-4 rounded-xl bg-gradient-to-br ${goalColors[goal]} border hover:scale-[1.02] transition-transform`}
    >
      <h3 className="font-medium mb-1">{title}</h3>
      <p className="text-sm text-gray-400 mb-2">{description}</p>
      <p className="text-xs text-gray-500">{days} days/week</p>
    </Link>
  );
}
