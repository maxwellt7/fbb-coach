import { Outlet, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Dumbbell,
  ClipboardList,
  MessageCircle,
  History,
  Menu,
  X,
  Cloud,
  CloudOff,
  RefreshCw,
} from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../store/useStore';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/programs', icon: ClipboardList, label: 'Programs' },
  { path: '/tracker', icon: Dumbbell, label: 'Tracker' },
  { path: '/coach', icon: MessageCircle, label: 'AI Coach' },
  { path: '/history', icon: History, label: 'History' },
];

function SyncStatus() {
  const { syncEnabled, isSyncing, lastSynced, syncFromServer } = useStore();

  if (!syncEnabled) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-xs">
        <CloudOff className="w-4 h-4" />
        <span>Local only</span>
      </div>
    );
  }

  return (
    <button
      onClick={() => syncFromServer()}
      disabled={isSyncing}
      className="flex items-center gap-2 text-xs text-gray-400 hover:text-primary-400 transition-colors disabled:opacity-50"
    >
      {isSyncing ? (
        <RefreshCw className="w-4 h-4 animate-spin" />
      ) : (
        <Cloud className="w-4 h-4 text-green-500" />
      )}
      <span>
        {isSyncing
          ? 'Syncing...'
          : lastSynced
          ? `Synced ${new Date(lastSynced).toLocaleTimeString()}`
          : 'Cloud sync enabled'}
      </span>
    </button>
  );
}

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 glass border-b border-gray-800">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-accent-500 rounded-lg flex items-center justify-center">
              <Dumbbell className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg">FBB Coach</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 top-14 bg-black/40 z-40"
              onClick={() => setMobileMenuOpen(false)}
            />
            <nav className="relative z-50 px-4 pb-4 animate-fadeIn bg-gray-950/95 backdrop-blur-xl">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary-500/20 text-primary-400'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </>
        )}
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-64 glass border-r border-gray-800">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center animate-pulse-glow">
              <Dumbbell className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-xl">FBB Coach</h1>
              <p className="text-xs text-gray-500">AI Workout Assistant</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-primary-500/20 to-accent-500/20 text-white border border-primary-500/30'
                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 m-4 rounded-xl bg-gradient-to-br from-primary-900/50 to-accent-900/50 border border-primary-500/20">
          <p className="text-sm text-gray-300 mb-2">Need help?</p>
          <p className="text-xs text-gray-500">
            Ask the AI Coach for personalized workout advice and program recommendations.
          </p>
        </div>

        {/* Sync status */}
        <div className="p-4 border-t border-gray-800">
          <SyncStatus />
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
