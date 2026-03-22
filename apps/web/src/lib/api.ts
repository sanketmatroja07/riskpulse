// In local dev, Next.js rewrites /api/* to localhost:8000/api/*
// So we use empty string (relative URL) to hit the proxy
const API_BASE = '';

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('rp_token', token);
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('rp_token');
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('rp_token');
      localStorage.removeItem('rp_user');
      localStorage.removeItem('rp_org');
    }
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      this.clearToken();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || `HTTP ${res.status}`);
    }

    return res.json();
  }

  // ── Auth ──────────────────────────────────────────────────

  async signup(data: { email: string; password: string; name: string; company_name: string }) {
    const res = await this.request<any>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setToken(res.access_token);
    if (typeof window !== 'undefined') {
      localStorage.setItem('rp_user', JSON.stringify(res.user));
      if (res.org) localStorage.setItem('rp_org', JSON.stringify(res.org));
    }
    return res;
  }

  async login(email: string, password: string) {
    const data = await this.request<any>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.access_token);
    if (typeof window !== 'undefined') {
      localStorage.setItem('rp_user', JSON.stringify(data.user));
      if (data.org) localStorage.setItem('rp_org', JSON.stringify(data.org));
    }
    return data;
  }

  async getMe() {
    return this.request<any>('/api/auth/me');
  }

  async getMyOrg() {
    return this.request<any>('/api/auth/org');
  }

  async getUsers() {
    return this.request<any[]>('/api/auth/users');
  }

  async inviteMember(email: string, name: string, role: string = 'analyst') {
    return this.request<any>(`/api/auth/invite?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}&role=${role}`, {
      method: 'POST',
    });
  }

  // ── API Keys ──────────────────────────────────────────────

  async createApiKey(name: string = 'Default') {
    return this.request<any>('/api/auth/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async getApiKeys() {
    return this.request<any[]>('/api/auth/api-keys');
  }

  async revokeApiKey(id: string) {
    return this.request<any>(`/api/auth/api-keys/${id}`, { method: 'DELETE' });
  }

  // ── Dashboard ─────────────────────────────────────────────

  async getDashboardStats() {
    return this.request<any>('/api/dashboard/stats');
  }

  // ── Alerts ────────────────────────────────────────────────

  async getAlerts(params: Record<string, any> = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request<any>(`/api/alerts?${qs}`);
  }

  async getAlert(id: string) {
    return this.request<any>(`/api/alerts/${id}`);
  }

  async updateAlert(id: string, data: any) {
    return this.request<any>(`/api/alerts/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async bulkAlertAction(data: any) {
    return this.request<any>('/api/alerts/bulk-action', { method: 'POST', body: JSON.stringify(data) });
  }

  async createCaseFromAlert(alertId: string) {
    return this.request<any>(`/api/alerts/${alertId}/create-case`, { method: 'POST' });
  }

  // ── Cases ─────────────────────────────────────────────────

  async getCases(params: Record<string, any> = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request<any>(`/api/cases?${qs}`);
  }

  async getCase(id: string) {
    return this.request<any>(`/api/cases/${id}`);
  }

  async createCase(data: any) {
    return this.request<any>('/api/cases', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateCase(id: string, data: any) {
    return this.request<any>(`/api/cases/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async makeCaseDecision(id: string, data: any) {
    return this.request<any>(`/api/cases/${id}/decision`, { method: 'POST', body: JSON.stringify(data) });
  }

  async getCaseEvidence(id: string) {
    return this.request<any[]>(`/api/cases/${id}/evidence`);
  }

  async collectEvidence(id: string) {
    return this.request<any[]>(`/api/cases/${id}/collect-evidence`, { method: 'POST' });
  }

  async getCaseNarratives(id: string) {
    return this.request<any[]>(`/api/cases/${id}/narratives`);
  }

  async generateNarrative(id: string) {
    return this.request<any>(`/api/cases/${id}/generate-narrative`, { method: 'POST' });
  }

  async getCaseGraph(id: string) {
    return this.request<any>(`/api/cases/${id}/graph`);
  }

  async getCaseTimeline(id: string) {
    return this.request<any[]>(`/api/cases/${id}/timeline`);
  }

  async getCaseComments(id: string) {
    return this.request<any[]>(`/api/cases/${id}/comments`);
  }

  async addCaseComment(id: string, data: any) {
    return this.request<any>(`/api/cases/${id}/comments`, { method: 'POST', body: JSON.stringify(data) });
  }

  async getCaseMitigations(id: string) {
    return this.request<any[]>(`/api/cases/${id}/mitigations`);
  }

  async suggestMitigations(id: string) {
    return this.request<any[]>(`/api/cases/${id}/suggest-mitigations`, { method: 'POST' });
  }

  // ── Entities ──────────────────────────────────────────────

  async getEntities(params: Record<string, any> = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request<any>(`/api/entities?${qs}`);
  }

  async getEntity(id: string) {
    return this.request<any>(`/api/entities/${id}`);
  }

  async getEntityGraph(id: string, depth: number = 2) {
    return this.request<any>(`/api/entities/${id}/graph?depth=${depth}`);
  }

  async getEntityEvents(id: string) {
    return this.request<any[]>(`/api/entities/${id}/events`);
  }

  async getEntityTransactions(id: string) {
    return this.request<any[]>(`/api/entities/${id}/transactions`);
  }

  async getEntityAlerts(id: string) {
    return this.request<any[]>(`/api/entities/${id}/alerts`);
  }

  // ── Events ────────────────────────────────────────────────

  async getEvents(params: Record<string, any> = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request<any>(`/api/events?${qs}`);
  }

  async ingestEvent(data: any) {
    return this.request<any>('/api/events/ingest', { method: 'POST', body: JSON.stringify(data) });
  }

  async simulateEvents(count: number = 5) {
    return this.request<any>(`/api/events/simulate?count=${count}`, { method: 'POST' });
  }

  // ── Rules ─────────────────────────────────────────────────

  async getRules(params: Record<string, any> = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request<any>(`/api/rules?${qs}`);
  }

  async getRule(id: string) {
    return this.request<any>(`/api/rules/${id}`);
  }

  async createRule(data: any) {
    return this.request<any>('/api/rules', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateRule(id: string, data: any) {
    return this.request<any>(`/api/rules/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async toggleRule(id: string) {
    return this.request<any>(`/api/rules/${id}/toggle`, { method: 'POST' });
  }

  async deployRule(id: string, data: any = {}) {
    return this.request<any>(`/api/rules/${id}/deploy`, { method: 'POST', body: JSON.stringify(data) });
  }

  async backtestRule(id: string, days: number = 7) {
    return this.request<any>(`/api/rules/${id}/backtest?days=${days}`, { method: 'POST' });
  }

  // ── Features ──────────────────────────────────────────────

  async getFeatures(params: Record<string, any> = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request<any>(`/api/features?${qs}`);
  }

  async createFeature(data: any) {
    return this.request<any>('/api/features', { method: 'POST', body: JSON.stringify(data) });
  }

  async deployFeature(id: string, data: any = {}) {
    return this.request<any>(`/api/features/${id}/deploy`, { method: 'POST', body: JSON.stringify(data) });
  }

  // ── Deployments ───────────────────────────────────────────

  async getDeployments(params: Record<string, any> = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request<any>(`/api/deployments?${qs}`);
  }

  async rollbackDeployment(id: string) {
    return this.request<any>(`/api/deployments/${id}/rollback`, { method: 'POST' });
  }

  // ── Search ────────────────────────────────────────────────

  async search(q: string) {
    return this.request<any>(`/api/search?q=${encodeURIComponent(q)}`);
  }

  // ── Notifications ─────────────────────────────────────────

  async getNotifications(params: Record<string, any> = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request<any>(`/api/notifications?${qs}`);
  }

  async markNotificationRead(id: string) {
    return this.request<any>(`/api/notifications/${id}/read`, { method: 'POST' });
  }

  async markAllNotificationsRead() {
    return this.request<any>('/api/notifications/read-all', { method: 'POST' });
  }

  // ── Metrics ───────────────────────────────────────────────

  async getSystemMetrics() {
    return this.request<any>('/api/metrics/system');
  }

  async getAuditLog(params: Record<string, any> = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request<any>(`/api/metrics/audit-log?${qs}`);
  }

  // ── Billing ───────────────────────────────────────────────

  async getBillingPlan() {
    return this.request<any>('/api/billing/plan');
  }

  async getAvailablePlans() {
    return this.request<any[]>('/api/billing/plans');
  }

  async upgradePlan(plan: string) {
    return this.request<any>('/api/billing/upgrade', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    });
  }
}

export const api = new ApiClient();
