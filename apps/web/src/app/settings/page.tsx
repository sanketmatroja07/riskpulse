'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';

type Tab = 'api-keys' | 'team' | 'billing' | 'organization';

export default function SettingsPage() {
  const { addToast } = useAppStore();
  const [tab, setTab] = useState<Tab>('api-keys');
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [billing, setBilling] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // New API key form
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string>('');

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('analyst');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [keysData, usersData, orgData] = await Promise.all([
        api.getApiKeys().catch(() => []),
        api.getUsers().catch(() => []),
        api.getMyOrg().catch(() => null),
      ]);
      setApiKeys(keysData);
      setUsers(usersData);
      setOrg(orgData);

      const [billingData, plansData] = await Promise.all([
        api.getBillingPlan().catch(() => null),
        api.getAvailablePlans().catch(() => []),
      ]);
      setBilling(billingData);
      setPlans(plansData);
    } catch {}
  };

  const createKey = async () => {
    if (!newKeyName.trim()) return;
    setLoading(true);
    try {
      const data = await api.createApiKey(newKeyName);
      setCreatedKey(data.key);
      setNewKeyName('');
      setApiKeys(prev => [data, ...prev]);
      addToast({ type: 'success', title: 'API key created' });
    } catch (err: any) {
      addToast({ type: 'error', title: err.message });
    } finally {
      setLoading(false);
    }
  };

  const revokeKey = async (id: string) => {
    try {
      await api.revokeApiKey(id);
      setApiKeys(prev => prev.filter(k => k.id !== id));
      addToast({ type: 'success', title: 'API key revoked' });
    } catch (err: any) {
      addToast({ type: 'error', title: err.message });
    }
  };

  const inviteMember = async () => {
    if (!inviteEmail || !inviteName) return;
    setLoading(true);
    try {
      const data = await api.inviteMember(inviteEmail, inviteName, inviteRole);
      setUsers(prev => [...prev, data]);
      setInviteEmail('');
      setInviteName('');
      addToast({ type: 'success', title: `Invited ${inviteEmail}` });
    } catch (err: any) {
      addToast({ type: 'error', title: err.message });
    } finally {
      setLoading(false);
    }
  };

  const upgradePlan = async (plan: string) => {
    setLoading(true);
    try {
      await api.upgradePlan(plan);
      await loadData();
      addToast({ type: 'success', title: `Upgraded to ${plan}` });
    } catch (err: any) {
      addToast({ type: 'error', title: err.message });
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'api-keys', label: 'API Keys' },
    { id: 'team', label: 'Team' },
    { id: 'billing', label: 'Billing' },
    { id: 'organization', label: 'Organization' },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-bg-card rounded-lg p-1 mb-8 w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              tab === t.id
                ? 'bg-primary text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* API Keys Tab */}
      {tab === 'api-keys' && (
        <div>
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">API Keys</h2>
            <p className="text-sm text-text-secondary">
              Use API keys to authenticate webhook requests from your systems.
            </p>
          </div>

          {/* Create key */}
          <div className="bg-bg-surface border border-border rounded-xl p-6 mb-6">
            <h3 className="text-sm font-medium mb-4">Create new API key</h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                placeholder="Key name (e.g. Production, Staging)"
                className="flex-1 px-4 py-2 bg-bg-card border border-border rounded-lg text-text-primary placeholder-text-muted focus:border-primary outline-none"
              />
              <button
                onClick={createKey}
                disabled={loading || !newKeyName.trim()}
                className="px-6 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition disabled:opacity-50"
              >
                Create
              </button>
            </div>

            {createdKey && (
              <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-sm text-green-400 mb-2 font-medium">New API key created (save it now!):</p>
                <code className="text-xs text-green-300 font-mono break-all">{createdKey}</code>
                <button
                  onClick={() => { navigator.clipboard.writeText(createdKey); addToast({ type: 'success', title: 'Copied!' }); }}
                  className="ml-3 text-xs text-green-400 underline"
                >
                  Copy
                </button>
              </div>
            )}
          </div>

          {/* Keys list */}
          <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-bg-card">
                <tr>
                  <th className="text-left px-6 py-3 text-text-secondary font-medium">Name</th>
                  <th className="text-left px-6 py-3 text-text-secondary font-medium">Key</th>
                  <th className="text-left px-6 py-3 text-text-secondary font-medium">Created</th>
                  <th className="text-left px-6 py-3 text-text-secondary font-medium">Last used</th>
                  <th className="text-right px-6 py-3 text-text-secondary font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map(k => (
                  <tr key={k.id} className="border-t border-border">
                    <td className="px-6 py-4 text-text-primary">{k.name}</td>
                    <td className="px-6 py-4 font-mono text-text-muted">{k.key_prefix}</td>
                    <td className="px-6 py-4 text-text-muted">{new Date(k.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-text-muted">{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => revokeKey(k.id)}
                        className="text-danger text-xs hover:underline"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
                {apiKeys.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-text-muted">
                      No API keys yet. Create one above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Team Tab */}
      {tab === 'team' && (
        <div>
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Team Members</h2>
            <p className="text-sm text-text-secondary">
              Manage who has access to your RiskPulse workspace.
              {billing && <span className="ml-1">({users.length}/{billing.max_members} seats used)</span>}
            </p>
          </div>

          {/* Invite */}
          <div className="bg-bg-surface border border-border rounded-xl p-6 mb-6">
            <h3 className="text-sm font-medium mb-4">Invite team member</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text"
                value={inviteName}
                onChange={e => setInviteName(e.target.value)}
                placeholder="Name"
                className="px-4 py-2 bg-bg-card border border-border rounded-lg text-text-primary placeholder-text-muted focus:border-primary outline-none"
              />
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="Email"
                className="px-4 py-2 bg-bg-card border border-border rounded-lg text-text-primary placeholder-text-muted focus:border-primary outline-none"
              />
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value)}
                className="px-4 py-2 bg-bg-card border border-border rounded-lg text-text-primary focus:border-primary outline-none"
              >
                <option value="analyst">Analyst</option>
                <option value="engineer">Engineer</option>
                <option value="admin">Admin</option>
                <option value="readonly">Read Only</option>
              </select>
              <button
                onClick={inviteMember}
                disabled={loading || !inviteEmail || !inviteName}
                className="px-6 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition disabled:opacity-50"
              >
                Invite
              </button>
            </div>
          </div>

          {/* Members list */}
          <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-bg-card">
                <tr>
                  <th className="text-left px-6 py-3 text-text-secondary font-medium">Name</th>
                  <th className="text-left px-6 py-3 text-text-secondary font-medium">Email</th>
                  <th className="text-left px-6 py-3 text-text-secondary font-medium">Role</th>
                  <th className="text-left px-6 py-3 text-text-secondary font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-6 py-4 text-text-primary">{u.name}</td>
                    <td className="px-6 py-4 text-text-muted">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        u.role === 'admin' ? 'bg-red-500/10 text-red-400' :
                        u.role === 'analyst' ? 'bg-blue-500/10 text-blue-400' :
                        u.role === 'engineer' ? 'bg-green-500/10 text-green-400' :
                        'bg-gray-500/10 text-gray-400'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs ${u.is_active ? 'text-green-400' : 'text-text-muted'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Billing Tab */}
      {tab === 'billing' && (
        <div>
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Billing & Plans</h2>
            <p className="text-sm text-text-secondary">Manage your subscription and usage.</p>
          </div>

          {/* Current plan */}
          {billing && (
            <div className="bg-bg-surface border border-border rounded-xl p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-text-primary">Current Plan: <span className="text-primary capitalize">{billing.plan}</span></h3>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-bg-card rounded-lg">
                  <div className="text-2xl font-bold text-text-primary">{billing.events_used?.toLocaleString()}</div>
                  <div className="text-xs text-text-muted">of {billing.event_quota?.toLocaleString()} events used</div>
                  <div className="mt-2 w-full bg-bg rounded-full h-2">
                    <div
                      className="bg-primary rounded-full h-2 transition-all"
                      style={{ width: `${Math.min(100, ((billing.events_used || 0) / (billing.event_quota || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="p-4 bg-bg-card rounded-lg">
                  <div className="text-2xl font-bold text-text-primary">{billing.max_members}</div>
                  <div className="text-xs text-text-muted">team member seats</div>
                </div>
                <div className="p-4 bg-bg-card rounded-lg">
                  <div className="text-2xl font-bold text-text-primary capitalize">{billing.plan}</div>
                  <div className="text-xs text-text-muted">current plan</div>
                </div>
              </div>
            </div>
          )}

          {/* Plan options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan: any) => (
              <div key={plan.slug} className={`bg-bg-surface border rounded-xl p-6 ${
                billing?.plan === plan.slug ? 'border-primary' : 'border-border'
              }`}>
                <h3 className="text-lg font-semibold mb-1">{plan.name}</h3>
                <div className="mb-4">
                  {plan.price > 0 ? (
                    <span className="text-3xl font-bold text-text-primary">${plan.price}<span className="text-sm font-normal text-text-muted">/mo</span></span>
                  ) : (
                    <span className="text-lg font-medium text-text-secondary">Contact us</span>
                  )}
                </div>
                <ul className="space-y-2 mb-6 text-sm">
                  <li className="text-text-muted">{plan.event_quota?.toLocaleString()} events/month</li>
                  <li className="text-text-muted">{plan.max_members} team members</li>
                  {plan.features?.map((f: string) => (
                    <li key={f} className="text-text-secondary flex items-start gap-2">
                      <svg className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                {billing?.plan === plan.slug ? (
                  <button disabled className="w-full py-2 border border-border rounded-lg text-text-muted text-sm">
                    Current plan
                  </button>
                ) : plan.price > 0 ? (
                  <button
                    onClick={() => upgradePlan(plan.slug)}
                    disabled={loading}
                    className="w-full py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                  >
                    {billing?.plan === 'enterprise' ? 'Downgrade' : 'Upgrade'}
                  </button>
                ) : (
                  <button className="w-full py-2 border border-primary text-primary rounded-lg text-sm font-medium hover:bg-primary/10 transition">
                    Contact sales
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Organization Tab */}
      {tab === 'organization' && org && (
        <div>
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Organization</h2>
            <p className="text-sm text-text-secondary">Manage your organization details.</p>
          </div>

          <div className="bg-bg-surface border border-border rounded-xl p-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm text-text-secondary mb-1">Organization name</label>
                <div className="text-text-primary font-medium">{org.name}</div>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Slug</label>
                <div className="text-text-muted font-mono">{org.slug}</div>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Plan</label>
                <div className="text-primary font-medium capitalize">{org.plan}</div>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Created</label>
                <div className="text-text-muted">{new Date(org.created_at).toLocaleDateString()}</div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-border">
              <h3 className="text-sm font-medium text-danger mb-2">Danger Zone</h3>
              <p className="text-xs text-text-muted mb-3">
                Request deletion of all your data under GDPR.
              </p>
              <button className="px-4 py-2 border border-danger/30 text-danger text-sm rounded-lg hover:bg-danger/10 transition">
                Request data deletion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
