/**
 * API Client for LearnGlobal.ai Admin UI
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface Module {
  id: number;
  moduleId: string;
  title: string;
  description: string;
  vertical: string;
  author: string;
  status: 'draft' | 'active' | 'archived';
  currentVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface Run {
  id: number;
  runId: string;
  moduleId: string;
  currentState: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  triggeredBy: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface AuditEvent {
  id: number;
  eventType: string;
  actor: string;
  fromState?: string;
  toState?: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface Approval {
  id: number;
  runId: string;
  stage: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  requestedBy: string;
  reviewedAt?: string;
  reviewedBy?: string;
  comments?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<ApiResponse<T>> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const response = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Modules
  async getModules(): Promise<ApiResponse<Module[]>> {
    return this.request('GET', '/modules');
  }

  async getModule(moduleId: string): Promise<ApiResponse<Module>> {
    return this.request('GET', `/modules/${moduleId}`);
  }

  async createModule(data: {
    title: string;
    description: string;
    vertical: string;
    author: string;
    spec: unknown;
  }): Promise<ApiResponse<Module>> {
    return this.request('POST', '/modules', data);
  }

  async updateModule(
    moduleId: string,
    data: Partial<Module>
  ): Promise<ApiResponse<Module>> {
    return this.request('PUT', `/modules/${moduleId}`, data);
  }

  // Runs
  async getRuns(moduleId?: string): Promise<ApiResponse<Run[]>> {
    const path = moduleId ? `/modules/${moduleId}/runs` : '/runs';
    return this.request('GET', path);
  }

  async getRun(runId: string): Promise<ApiResponse<Run>> {
    return this.request('GET', `/runs/${runId}`);
  }

  async startRun(
    moduleId: string,
    config?: { triggeredBy: string; config?: Record<string, unknown> }
  ): Promise<ApiResponse<Run>> {
    return this.request('POST', `/modules/${moduleId}/runs`, config);
  }

  async pauseRun(runId: string): Promise<ApiResponse<Run>> {
    return this.request('POST', `/runs/${runId}/pause`);
  }

  async resumeRun(runId: string): Promise<ApiResponse<Run>> {
    return this.request('POST', `/runs/${runId}/resume`);
  }

  async rerunFromState(
    runId: string,
    fromState: string
  ): Promise<ApiResponse<Run>> {
    return this.request('POST', `/runs/${runId}/rerun`, { fromState });
  }

  // Audit Events
  async getAuditEvents(runId: string): Promise<ApiResponse<AuditEvent[]>> {
    return this.request('GET', `/runs/${runId}/events`);
  }

  // Approvals
  async getApprovals(status?: string): Promise<ApiResponse<Approval[]>> {
    const path = status ? `/approvals?status=${status}` : '/approvals';
    return this.request('GET', path);
  }

  async requestApproval(
    runId: string,
    stage: string
  ): Promise<ApiResponse<Approval>> {
    return this.request('POST', '/approvals', { runId, stage });
  }

  async reviewApproval(
    approvalId: number,
    decision: 'approved' | 'rejected',
    comments?: string
  ): Promise<ApiResponse<Approval>> {
    return this.request('POST', `/approvals/${approvalId}/review`, {
      decision,
      comments,
    });
  }

  // Chat
  async sendChatMessage(
    moduleId: string,
    message: string,
    history?: ChatMessage[]
  ): Promise<ApiResponse<{ response: string; sources?: string[] }>> {
    return this.request('POST', '/chat', { moduleId, message, history });
  }

  // Verticals
  async getVerticals(): Promise<
    ApiResponse<Array<{ id: string; name: string; config: unknown }>>
  > {
    return this.request('GET', '/verticals');
  }

  async getVertical(
    verticalId: string
  ): Promise<ApiResponse<{ id: string; name: string; config: unknown }>> {
    return this.request('GET', `/verticals/${verticalId}`);
  }

  async createVertical(data: {
    id: string;
    name: string;
    config: unknown;
  }): Promise<ApiResponse<{ id: string }>> {
    return this.request('POST', '/verticals', data);
  }

  async updateVertical(
    verticalId: string,
    data: { name?: string; config?: unknown }
  ): Promise<ApiResponse<{ id: string }>> {
    return this.request('PUT', `/verticals/${verticalId}`, data);
  }

  // Health
  async getHealth(): Promise<
    ApiResponse<{ status: string; version: string; uptime: number }>
  > {
    return this.request('GET', '/health');
  }
}

export const api = new ApiClient();
