/**
 * Runs Page - Pipeline Execution Monitoring
 */

import React, { useState } from 'react';
import { usePollingRuns } from '../hooks/useApi';
import { RunStatus } from '../components/RunStatus';
import { api, AuditEvent } from '../lib/api';

interface RunsProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
  params?: Record<string, string>;
}

export function Runs({ onNavigate, params }: RunsProps) {
  const { data: runs, loading, error, refetch } = usePollingRuns(params?.moduleId, {
    interval: 3000,
    enabled: true,
  });

  const [selectedRun, setSelectedRun] = useState<string | null>(params?.runId || null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [filter, setFilter] = useState<string>('all');

  const filteredRuns = runs?.filter(r => filter === 'all' || r.status === filter) || [];

  const handleViewDetails = async (runId: string) => {
    setSelectedRun(runId);
    const response = await api.getAuditEvents(runId);
    if (response.success) {
      setAuditEvents(response.data || []);
    }
  };

  const handlePause = async (runId: string) => {
    const response = await api.pauseRun(runId);
    if (response.success) {
      refetch();
    } else {
      alert('Failed to pause: ' + response.error);
    }
  };

  const handleResume = async (runId: string) => {
    const response = await api.resumeRun(runId);
    if (response.success) {
      refetch();
    } else {
      alert('Failed to resume: ' + response.error);
    }
  };

  const handleRerun = async (runId: string, fromState: string) => {
    if (!confirm(`Rerun from state "${fromState}"?`)) return;
    const response = await api.rerunFromState(runId, fromState);
    if (response.success) {
      refetch();
      alert(`Rerun started: ${response.data?.runId}`);
    } else {
      alert('Failed to rerun: ' + response.error);
    }
  };

  const selectedRunData = runs?.find(r => r.runId === selectedRun);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Pipeline Runs</h1>
        <div className="flex gap-4">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="all">All Status</option>
            <option value="running">Running</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          <button
            onClick={refetch}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Runs List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {params?.moduleId ? `Runs for ${params.moduleId}` : 'All Runs'}
          </h2>

          {loading ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              Loading runs...
            </div>
          ) : error ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-red-500">
              {error}
            </div>
          ) : filteredRuns.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              No pipeline runs found.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRuns.map(run => (
                <div
                  key={run.runId}
                  className={`cursor-pointer ${selectedRun === run.runId ? 'ring-2 ring-blue-500 rounded-lg' : ''}`}
                  onClick={() => handleViewDetails(run.runId)}
                >
                  <RunStatus
                    run={run}
                    onPause={handlePause}
                    onResume={handleResume}
                    onView={handleViewDetails}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Run Details */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Run Details</h2>

          {selectedRunData ? (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h3 className="font-mono text-lg">{selectedRunData.runId}</h3>
                <p className="text-sm text-gray-500">Module: {selectedRunData.moduleId}</p>
              </div>

              {/* State Timeline */}
              <div className="p-4 border-b">
                <h4 className="font-medium text-gray-900 mb-2">State Timeline</h4>
                <div className="space-y-2">
                  {auditEvents.length === 0 ? (
                    <p className="text-sm text-gray-500">No events recorded yet.</p>
                  ) : (
                    auditEvents.map((event, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <span className="text-sm font-medium">
                              {event.eventType}
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(event.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          {event.fromState && event.toState && (
                            <p className="text-xs text-gray-500">
                              {event.fromState} → {event.toState}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="p-4">
                <h4 className="font-medium text-gray-900 mb-2">Actions</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedRunData.status === 'failed' && (
                    <button
                      onClick={() => handleRerun(selectedRunData.runId, selectedRunData.currentState)}
                      className="px-3 py-1 text-sm bg-orange-500 text-white rounded hover:bg-orange-600"
                    >
                      Retry from {selectedRunData.currentState}
                    </button>
                  )}
                  {selectedRunData.status === 'completed' && (
                    <button
                      onClick={() => onNavigate('chat', { moduleId: selectedRunData.moduleId })}
                      className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Open Chat
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              Select a run to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
