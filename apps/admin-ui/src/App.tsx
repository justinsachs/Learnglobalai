/**
 * Main Application Component
 */

import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Modules } from './pages/Modules';
import { Runs } from './pages/Runs';
import { Approvals } from './pages/Approvals';
import { Chat } from './pages/Chat';
import { Settings } from './pages/Settings';

type PageId = 'dashboard' | 'modules' | 'runs' | 'approvals' | 'chat' | 'settings';

export function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const [pageParams, setPageParams] = useState<Record<string, string>>({});

  const handleNavigate = (page: string, params?: Record<string, string>) => {
    setCurrentPage(page as PageId);
    setPageParams(params || {});
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} />;
      case 'modules':
        return <Modules onNavigate={handleNavigate} />;
      case 'runs':
        return <Runs onNavigate={handleNavigate} params={pageParams} />;
      case 'approvals':
        return <Approvals onNavigate={handleNavigate} />;
      case 'chat':
        return <Chat onNavigate={handleNavigate} params={pageParams} />;
      case 'settings':
        return <Settings onNavigate={handleNavigate} />;
      default:
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={handleNavigate}>
      {renderPage()}
    </Layout>
  );
}

export default App;
