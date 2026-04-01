/**
 * Module Card Component
 */

import React from 'react';
import { Module } from '../lib/api';

interface ModuleCardProps {
  module: Module;
  onView: (moduleId: string) => void;
  onStartRun: (moduleId: string) => void;
  onEdit: (moduleId: string) => void;
}

export function ModuleCard({ module, onView, onStartRun, onEdit }: ModuleCardProps) {
  const statusColors = {
    draft: 'bg-yellow-100 text-yellow-800',
    active: 'bg-green-100 text-green-800',
    archived: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{module.title}</h3>
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
            {module.description}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[module.status]}`}>
              {module.status}
            </span>
            <span className="text-xs text-gray-500">
              {module.vertical}
            </span>
            <span className="text-xs text-gray-500">
              v{module.currentVersion}
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mt-4 pt-4 border-t">
        <span className="text-xs text-gray-400">
          Updated {new Date(module.updatedAt).toLocaleDateString()}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => onView(module.moduleId)}
            className="px-3 py-1 text-sm text-gray-600 border rounded hover:bg-gray-50"
          >
            View
          </button>
          <button
            onClick={() => onEdit(module.moduleId)}
            className="px-3 py-1 text-sm text-gray-600 border rounded hover:bg-gray-50"
          >
            Edit
          </button>
          <button
            onClick={() => onStartRun(module.moduleId)}
            className="px-3 py-1 text-sm text-white bg-green-600 rounded hover:bg-green-700"
          >
            Start Run
          </button>
        </div>
      </div>
    </div>
  );
}
