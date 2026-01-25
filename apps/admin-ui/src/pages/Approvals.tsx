/**
 * Approvals Page - LMS Publishing Workflow
 */

import React, { useState } from 'react';
import { useApprovals } from '../hooks/useApi';
import { api, Approval } from '../lib/api';

interface ApprovalsProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export function Approvals({ onNavigate }: ApprovalsProps) {
  const { data: approvals, loading, error, refetch } = useApprovals();
  const [filter, setFilter] = useState<string>('pending');
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [comments, setComments] = useState('');

  const filteredApprovals = approvals?.filter(a => filter === 'all' || a.status === filter) || [];

  const handleApprove = async (approval: Approval) => {
    setReviewingId(approval.id);
  };

  const handleReject = async (approval: Approval) => {
    setReviewingId(approval.id);
  };

  const submitReview = async (approvalId: number, decision: 'approved' | 'rejected') => {
    const response = await api.reviewApproval(approvalId, decision, comments);
    if (response.success) {
      setReviewingId(null);
      setComments('');
      refetch();
      alert(`Approval ${decision}`);
    } else {
      alert('Failed to submit review: ' + response.error);
    }
  };

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Approval Workflow</h1>
        <div className="flex gap-4">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
          <button
            onClick={refetch}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Pending Review</h3>
          <p className="text-3xl font-bold text-yellow-600 mt-1">
            {approvals?.filter(a => a.status === 'pending').length || 0}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Approved Today</h3>
          <p className="text-3xl font-bold text-green-600 mt-1">
            {approvals?.filter(a =>
              a.status === 'approved' &&
              a.reviewedAt &&
              new Date(a.reviewedAt).toDateString() === new Date().toDateString()
            ).length || 0}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Rejected Today</h3>
          <p className="text-3xl font-bold text-red-600 mt-1">
            {approvals?.filter(a =>
              a.status === 'rejected' &&
              a.reviewedAt &&
              new Date(a.reviewedAt).toDateString() === new Date().toDateString()
            ).length || 0}
          </p>
        </div>
      </div>

      {/* Approvals List */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          Loading approvals...
        </div>
      ) : error ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-red-500">
          {error}
        </div>
      ) : filteredApprovals.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No {filter === 'all' ? '' : filter} approvals found.
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow divide-y">
          {filteredApprovals.map(approval => (
            <div key={approval.id} className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {approval.stage} Approval
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[approval.status]}`}>
                      {approval.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Run: <span className="font-mono">{approval.runId}</span>
                  </p>
                  <p className="text-sm text-gray-500">
                    Requested by {approval.requestedBy} on {new Date(approval.requestedAt).toLocaleString()}
                  </p>
                  {approval.reviewedAt && (
                    <p className="text-sm text-gray-500">
                      Reviewed by {approval.reviewedBy} on {new Date(approval.reviewedAt).toLocaleString()}
                    </p>
                  )}
                  {approval.comments && (
                    <p className="text-sm text-gray-600 mt-2 italic">
                      "{approval.comments}"
                    </p>
                  )}
                </div>

                {approval.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => onNavigate('runs', { runId: approval.runId })}
                      className="px-3 py-1 text-sm text-gray-600 border rounded hover:bg-gray-50"
                    >
                      View Run
                    </button>
                    <button
                      onClick={() => handleApprove(approval)}
                      className="px-3 py-1 text-sm text-white bg-green-600 rounded hover:bg-green-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(approval)}
                      className="px-3 py-1 text-sm text-white bg-red-600 rounded hover:bg-red-700"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {reviewingId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Review Approval</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Comments (optional)
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
                className="w-full border rounded-lg p-2"
                placeholder="Add any notes about this decision..."
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setReviewingId(null);
                  setComments('');
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => submitReview(reviewingId, 'rejected')}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Reject
              </button>
              <button
                onClick={() => submitReview(reviewingId, 'approved')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
