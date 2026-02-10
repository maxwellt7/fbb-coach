import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';

// Lazy-load heavier pages (recharts, react-markdown, large forms)
const Programs = lazy(() => import('./pages/Programs'));
const ProgramBuilder = lazy(() => import('./pages/ProgramBuilder'));
const Tracker = lazy(() => import('./pages/Tracker'));
const Coach = lazy(() => import('./pages/Coach'));
const History = lazy(() => import('./pages/History'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="programs" element={<Programs />} />
            <Route path="programs/new" element={<ProgramBuilder />} />
            <Route path="programs/:id" element={<ProgramBuilder />} />
            <Route path="tracker" element={<Tracker />} />
            <Route path="coach" element={<Coach />} />
            <Route path="history" element={<History />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
