import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'text-red-400 bg-red-500/10 border-red-500/20';
    case 'high': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
    case 'medium': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
    case 'low': return 'text-green-400 bg-green-500/10 border-green-500/20';
    default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case 'new': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    case 'investigating': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
    case 'acknowledged': return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
    case 'pending_review': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
    case 'escalated': return 'text-red-400 bg-red-500/10 border-red-500/20';
    case 'resolved': return 'text-green-400 bg-green-500/10 border-green-500/20';
    case 'closed': return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    case 'dismissed': return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
  }
}

export function entityTypeIcon(type: string): string {
  switch (type) {
    case 'user': return '👤';
    case 'device': return '📱';
    case 'ip': return '🌐';
    case 'card': return '💳';
    case 'merchant': return '🏪';
    case 'email': return '📧';
    default: return '📦';
  }
}

export function riskColor(score: number): string {
  if (score >= 0.8) return 'text-red-400';
  if (score >= 0.6) return 'text-orange-400';
  if (score >= 0.4) return 'text-yellow-400';
  return 'text-green-400';
}

export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + '...';
}
