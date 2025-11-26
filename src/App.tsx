import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useData } from './hooks/useData';
import { FilterProvider, useFilters } from './context/FilterContext';
import Layout from './components/Layout';
import Overview from './pages/Overview';
import ChatDetails from './pages/ChatDetails';
import Reactions from './pages/Reactions';
import ActivityPatterns from './pages/ActivityPatterns';

function AppContent() {
  const data = useData();
  const { setChatSummary } = useFilters();

  // Sync chat summary to filter context
  useEffect(() => {
    if (data.chatSummary.length > 0) {
      setChatSummary(data.chatSummary);
    }
  }, [data.chatSummary, setChatSummary]);

  if (data.loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-accent-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-dark-400 font-display">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-display font-semibold text-dark-100 mb-2">
            Failed to load data
          </h1>
          <p className="text-dark-400 text-sm">{data.error}</p>
          <p className="text-dark-500 text-xs mt-4">
            Make sure you've run <code className="text-accent-cyan">python process.py</code> to generate the data files.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Overview data={data} />} />
        <Route path="/trends" element={<Navigate to="/" replace />} />
        <Route path="/chats" element={<ChatDetails data={data} />} />
        <Route path="/reactions" element={<Reactions data={data} />} />
        <Route path="/activity" element={<ActivityPatterns data={data} />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <FilterProvider>
      <AppContent />
    </FilterProvider>
  );
}
