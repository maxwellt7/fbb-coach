import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Programs from './pages/Programs';
import ProgramBuilder from './pages/ProgramBuilder';
import Tracker from './pages/Tracker';
import Coach from './pages/Coach';
import History from './pages/History';

function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

export default App;
