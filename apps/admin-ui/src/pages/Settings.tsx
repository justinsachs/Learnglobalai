/**
 * Settings Page - Configuration Management
 */

import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface SettingsProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

interface Vertical {
  id: string;
  name: string;
  config: Record<string, unknown>;
}

export function Settings({ onNavigate }: SettingsProps) {
  const [verticals, setVerticals] = useState<Vertical[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingVertical, setEditingVertical] = useState<Vertical | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<'verticals' | 'api' | 'notifications'>('verticals');

  useEffect(() => {
    loadVerticals();
  }, []);

  const loadVerticals = async () => {
    setLoading(true);
    const response = await api.getVerticals();
    if (response.success) {
      setVerticals(response.data || []);
    }
    setLoading(false);
  };

  const handleCreateVertical = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const verticalData = {
      id: (formData.get('id') as string).toLowerCase().replace(/\s+/g, '-'),
      name: formData.get('name') as string,
      config: {
        brandColors: {
          primary: formData.get('primaryColor') || '#1a73e8',
          secondary: formData.get('secondaryColor') || '#4285f4',
        },
        defaultConstraints: {
          minTotalWords: parseInt(formData.get('minWords') as string) || 5000,
          minWordsPerMajorHeading: 500,
          maxBulletRatio: 0.08,
        },
        mediaPreferences: {
          avatarStyle: formData.get('avatarStyle') || 'professional',
          audioTone: formData.get('audioTone') || 'conversational',
        },
      },
    };

    const response = await api.createVertical(verticalData);
    if (response.success) {
      setShowCreate(false);
      form.reset();
      loadVerticals();
      alert('Vertical created successfully!');
    } else {
      alert('Error: ' + response.error);
    }
  };

  const handleUpdateVertical = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingVertical) return;

    const form = e.currentTarget;
    const formData = new FormData(form);

    const updateData = {
      name: formData.get('name') as string,
      config: {
        ...editingVertical.config,
        brandColors: {
          primary: formData.get('primaryColor') || '#1a73e8',
          secondary: formData.get('secondaryColor') || '#4285f4',
        },
      },
    };

    const response = await api.updateVertical(editingVertical.id, updateData);
    if (response.success) {
      setEditingVertical(null);
      loadVerticals();
      alert('Vertical updated successfully!');
    } else {
      alert('Error: ' + response.error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'verticals', label: 'Verticals' },
            { id: 'api', label: 'API Configuration' },
            { id: 'notifications', label: 'Notifications' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Verticals Tab */}
      {activeTab === 'verticals' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">Brand Verticals</h2>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              + Add Vertical
            </button>
          </div>

          {loading ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              Loading verticals...
            </div>
          ) : verticals.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              No verticals configured. Add your first vertical to get started.
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow divide-y">
              {verticals.map((vertical) => (
                <div key={vertical.id} className="p-4 flex justify-between items-center">
                  <div>
                    <h3 className="font-medium text-gray-900">{vertical.name}</h3>
                    <p className="text-sm text-gray-500 font-mono">{vertical.id}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingVertical(vertical)}
                      className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* API Configuration Tab */}
      {activeTab === 'api' && (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <h3 className="font-medium text-gray-900 mb-4">API Endpoints</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="text-sm font-mono">API Base URL</span>
                <span className="text-sm text-gray-600">http://localhost:3000/api/v1</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="text-sm font-mono">WebSocket URL</span>
                <span className="text-sm text-gray-600">ws://localhost:3000/ws</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 mb-4">External Services</h3>
            <div className="space-y-3">
              <div className="p-3 border rounded">
                <div className="flex justify-between items-center">
                  <span className="font-medium">OpenAI</span>
                  <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                    Connected
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">GPT-4 for content generation</p>
              </div>
              <div className="p-3 border rounded">
                <div className="flex justify-between items-center">
                  <span className="font-medium">HeyGen</span>
                  <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                    Connected
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">Avatar video generation</p>
              </div>
              <div className="p-3 border rounded">
                <div className="flex justify-between items-center">
                  <span className="font-medium">NotebookLM</span>
                  <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                    Mock Mode
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">Audio podcast generation</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-medium text-gray-900 mb-4">Notification Preferences</h3>
          <div className="space-y-4">
            {[
              { id: 'run_complete', label: 'Pipeline run completed', enabled: true },
              { id: 'run_failed', label: 'Pipeline run failed', enabled: true },
              { id: 'approval_needed', label: 'Approval required', enabled: true },
              { id: 'daily_summary', label: 'Daily summary', enabled: false },
            ].map((pref) => (
              <div key={pref.id} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{pref.label}</span>
                <button
                  className={`w-12 h-6 rounded-full transition-colors ${
                    pref.enabled ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${
                      pref.enabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add New Vertical</h3>
            <form onSubmit={handleCreateVertical}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">ID (slug)</label>
                  <input
                    type="text"
                    name="id"
                    required
                    pattern="[a-z0-9-]+"
                    className="mt-1 block w-full rounded-md border p-2"
                    placeholder="e.g., medviro"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="mt-1 block w-full rounded-md border p-2"
                    placeholder="e.g., MedViro Healthcare"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Primary Color</label>
                  <input
                    type="color"
                    name="primaryColor"
                    defaultValue="#1a73e8"
                    className="mt-1 block w-full h-10 rounded-md border p-1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Min Total Words</label>
                  <input
                    type="number"
                    name="minWords"
                    defaultValue={5000}
                    className="mt-1 block w-full rounded-md border p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Avatar Style</label>
                  <select name="avatarStyle" className="mt-1 block w-full rounded-md border p-2">
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="friendly">Friendly</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Vertical
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingVertical && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Edit Vertical</h3>
            <form onSubmit={handleUpdateVertical}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">ID (read-only)</label>
                  <input
                    type="text"
                    value={editingVertical.id}
                    disabled
                    className="mt-1 block w-full rounded-md border p-2 bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={editingVertical.name}
                    required
                    className="mt-1 block w-full rounded-md border p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Primary Color</label>
                  <input
                    type="color"
                    name="primaryColor"
                    defaultValue={(editingVertical.config?.brandColors as any)?.primary || '#1a73e8'}
                    className="mt-1 block w-full h-10 rounded-md border p-1"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingVertical(null)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
