/**
 * Dashboard Page
 */

import React from 'react';
import { useModules, useRuns } from '../hooks/useApi';
import { ModuleCard } from '../components/ModuleCard';
import { RunStatus } from '../components/RunStatus';

interface DashboardProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { data: modules, loading: modulesLoading, error: modulesError } = useModules();
  const { data: runs, loading: runsLoading, refetch: refetchRuns } = useRuns();

  const recentModules = modules?.slice(0, 4) || [];
  const activeRuns = runs?.filter(r => r.status === 'running' || r.status === 'paused') || [];
  const recentRuns = runs?.slice(0, 5) || [];

  const handleStartRun = async (moduleId: string) => {
    if (!confirm('Start a new pipeline run for this module?')) return;
    // Would call API here
    onNavigate('runs', { moduleId });
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Total Modules</h3>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {modulesLoading ? '...' : modules?.length || 0}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Active Runs</h3>
          <p className="text-3xl font-bold text-blue-600 mt-1">
            {runsLoading ? '...' : activeRuns.length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Completed Today</h3>
          <p className="text-3xl font-bold text-green-600 mt-1">
            {runsLoading ? '...' : runs?.filter(r =>
              r.status === 'completed' &&
              new Date(r.completedAt || '').toDateString() === new Date().toDateString()
            ).length || 0}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Failed Today</h3>
          <p className="text-3xl font-bold text-red-600 mt-1">
            {runsLoading ? '...' : runs?.filter(r =>
              r.status === 'failed' &&
              new Date(r.startedAt).toDateString() === new Date().toDateString()
            ).length || 0}
          </p>
        </div>
      </div>

      {/* Active Runs */}
      {activeRuns.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Active Runs</h2>
            <button
              onClick={() => onNavigate('runs')}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              View all runs →
            </button>
          </div>
          <div className="space-y-4">
            {activeRuns.map(run => (
              <RunStatus
                key={run.runId}
                run={run}
                onView={(runId) => onNavigate('runs', { runId })}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent Modules */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Recent Modules</h2>
          <button
            onClick={() => onNavigate('modules')}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            View all modules →
          </button>
        </div>

        {modulesLoading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            Loading modules...
          </div>
        ) : modulesError ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-red-500">
            {modulesError}
          </div>
        ) : recentModules.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 mb-4">No modules yet. Create your first module to get started.</p>
            <button
              onClick={() => onNavigate('modules')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Create Module
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentModules.map(module => (
              <ModuleCard
                key={module.moduleId}
                module={module}
                onView={(id) => onNavigate('modules', { moduleId: id })}
                onEdit={(id) => onNavigate('modules', { moduleId: id, edit: 'true' })}
                onStartRun={handleStartRun}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recent Run Activity */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
        </div>
        <div className="bg-white rounded-lg shadow">
          {runsLoading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : recentRuns.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No pipeline runs yet.
            </div>
          ) : (
            <div className="divide-y">
              {recentRuns.map(run => (
                <div key={run.runId} className="p-4 flex justify-between items-center">
                  <div>
                    <span className="font-mono text-sm text-gray-600">{run.runId}</span>
                    <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${
                      run.status === 'completed' ? 'bg-green-100 text-green-800' :
                      run.status === 'failed' ? 'bg-red-100 text-red-800' :
                      run.status === 'running' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {run.status}
                    </span>
                    <p className="text-sm text-gray-500 mt-1">
                      {run.currentState.replace(/-/g, ' ')}
                    </p>
                  </div>
                  <span className="text-sm text-gray-400">
                    {new Date(run.startedAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
