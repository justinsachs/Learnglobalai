/**
 * Modules Page
 */

import React, { useState } from 'react';
import { useModules } from '../hooks/useApi';
import { ModuleCard } from '../components/ModuleCard';
import { api } from '../lib/api';

interface ModulesProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export function Modules({ onNavigate }: ModulesProps) {
  const { data: modules, loading, error, refetch } = useModules();
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filteredModules = modules?.filter(m => {
    const matchesFilter = filter === 'all' || m.status === filter || m.vertical === filter;
    const matchesSearch = !search ||
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.description.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  }) || [];

  const verticals = [...new Set(modules?.map(m => m.vertical) || [])];

  const handleStartRun = async (moduleId: string) => {
    if (!confirm('Start a new pipeline run for this module?')) return;

    const response = await api.startRun(moduleId, { triggeredBy: 'admin-ui' });
    if (response.success) {
      alert(`Run started: ${response.data?.runId}`);
      onNavigate('runs', { moduleId });
    } else {
      alert('Failed to start run: ' + response.error);
    }
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const objectives = (formData.get('objectives') as string)
      .split('\n')
      .filter(o => o.trim());

    const moduleData = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      vertical: formData.get('vertical') as string,
      author: formData.get('author') as string,
      spec: {
        moduleId: 'mod-' + Date.now(),
        title: formData.get('title'),
        vertical: formData.get('vertical'),
        version: '1.0.0',
        author: formData.get('author'),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        description: formData.get('description'),
        targetAudienceRoles: ['technician', 'supervisor'],
        learningObjectives: objectives,
        standardsMap: [],
        scenarios: [],
        requiredArtifacts: [],
        constraints: {
          minWordsPerMajorHeading: 500,
          minTotalWords: 5000,
          maxBulletRatio: 0.08,
          forbiddenFormattingRules: [],
          requiredDisclaimers: ['This training is for educational purposes only.'],
          maxHeadingLevel: 4,
        },
        safetyBoundaries: {
          scopeOfAdvice: 'This training covers general procedures.',
          disclaimers: ['Always follow your organization\'s protocols.'],
          escalationTriggers: [],
          prohibitedTopics: [],
        },
        mediaPreferences: {
          videoMinutesTarget: 10,
          avatarStyle: 'professional',
          audioTone: 'conversational',
          infographicStyle: 'modern',
        },
      },
    };

    const response = await api.createModule(moduleData);
    if (response.success) {
      setShowCreate(false);
      form.reset();
      refetch();
      alert('Module created successfully!');
    } else {
      alert('Error: ' + response.error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Training Modules</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Create Module
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <input
          type="text"
          placeholder="Search modules..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-md px-4 py-2 border rounded-lg"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
        {verticals.length > 0 && (
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="all">All Verticals</option>
            {verticals.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        )}
      </div>

      {/* Modules Grid */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          Loading modules...
        </div>
      ) : error ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-red-500">
          {error}
        </div>
      ) : filteredModules.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 mb-4">
            {search || filter !== 'all'
              ? 'No modules match your criteria.'
              : 'No modules yet. Create your first module to get started.'}
          </p>
          {!search && filter === 'all' && (
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Create Module
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredModules.map(module => (
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

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Create New Training Module</h3>
            <form onSubmit={handleCreate}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Title</label>
                  <input
                    type="text"
                    name="title"
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    name="description"
                    rows={3}
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Vertical/Brand</label>
                  <select
                    name="vertical"
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                  >
                    <option value="medviro">MedViro</option>
                    <option value="clearclaims">ClearClaims</option>
                    <option value="response-roofing">Response Roofing</option>
                    <option value="learnglobal">LearnGlobal (Generic)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Author</label>
                  <input
                    type="text"
                    name="author"
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Learning Objectives (one per line)
                  </label>
                  <textarea
                    name="objectives"
                    rows={4}
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border font-mono text-sm"
                    placeholder="Understand the fundamentals of...&#10;Apply proper procedures for...&#10;Demonstrate compliance with..."
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  Create Module
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
