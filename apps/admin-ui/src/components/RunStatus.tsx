/**
 * Run Status Component
 */

import React from 'react';
import { Run } from '../lib/api';

interface RunStatusProps {
  run: Run;
  onPause?: (runId: string) => void;
  onResume?: (runId: string) => void;
  onView?: (runId: string) => void;
}

export function RunStatus({ run, onPause, onResume, onView }: RunStatusProps) {
  const statusColors = {
    pending: 'bg-gray-100 text-gray-800',
    running: 'bg-blue-100 text-blue-800',
    paused: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  };

  const stateIcons: Record<string, string> = {
    'draft-module-spec': '📝',
    'outline-generated': '📋',
    'sourcepack-generated': '📄',
    'qa-passed': '✅',
    'notebook-created': '📓',
    'notebook-sources-uploaded': '📤',
    'media-prompt-pack-generated': '🎬',
    'heygen-script-generated': '🎭',
    'heygen-video-requested': '🎥',
    'heygen-video-ready': '✨',
    'lms-published': '🎓',
    'chat-configured': '💬',
    'audit-finalized': '📊',
  };

  const getProgressPercent = (): number => {
    const states = Object.keys(stateIcons);
    const currentIndex = states.indexOf(run.currentState);
    if (currentIndex === -1) return 0;
    return Math.round(((currentIndex + 1) / states.length) * 100);
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-gray-600">{run.runId}</span>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[run.status]}`}>
              {run.status}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Module: {run.moduleId}
          </p>
        </div>
        <div className="text-right">
          <span className="text-sm text-gray-500">
            {stateIcons[run.currentState] || '⏳'} {run.currentState.replace(/-/g, ' ')}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Progress</span>
          <span>{getProgressPercent()}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              run.status === 'failed' ? 'bg-red-500' :
              run.status === 'completed' ? 'bg-green-500' :
              'bg-blue-500'
            }`}
            style={{ width: `${getProgressPercent()}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center mt-4 pt-4 border-t">
        <span className="text-xs text-gray-400">
          Started {new Date(run.startedAt).toLocaleString()}
        </span>
        <div className="flex gap-2">
          {onView && (
            <button
              onClick={() => onView(run.runId)}
              className="px-3 py-1 text-sm text-gray-600 border rounded hover:bg-gray-50"
            >
              View Details
            </button>
          )}
          {run.status === 'running' && onPause && (
            <button
              onClick={() => onPause(run.runId)}
              className="px-3 py-1 text-sm text-yellow-600 border border-yellow-300 rounded hover:bg-yellow-50"
            >
              Pause
            </button>
          )}
          {run.status === 'paused' && onResume && (
            <button
              onClick={() => onResume(run.runId)}
              className="px-3 py-1 text-sm text-green-600 border border-green-300 rounded hover:bg-green-50"
            >
              Resume
            </button>
          )}
        </div>
      </div>

      {/* Error display */}
      {run.error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {run.error}
        </div>
      )}
    </div>
  );
}
