import { geminiHeaders } from './geminiKey';
import {
  ComplaintSummary,
  InterceptPost, DistrictIntel, CrimeCategory, EntityNode, EntityEdge, ThreatAlert, CoordinatedGroup,
  AnalystStatus, VerifyResult, AuditEntry, AuditChainStatus, Platform,
} from '../types';

const RAW_API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000';
const API_BASE_URL = `${RAW_API_URL.replace(/\/+$/, '')}/api`;
const WS_URL =
  (import.meta.env.VITE_WS_URL as string) ||
  `${RAW_API_URL.replace(/\/+$/, '').replace(/^http/, 'ws')}/ws/stream`;

export interface ScanTextPayload {
  text: string;
  channel?: string;
  districtId?: string;
  platform?: Platform;
  analyst?: string;
}

export interface ChannelScanPayload {
  channel: string;
  limit?: number;
}

const ANALYST_KEY = 'prahari.analyst';

/** Free-text name recorded in the audit log. There are no accounts in this prototype, so it is not authenticated. */
export function getAnalystName(): string {
  try {
    return (localStorage.getItem(ANALYST_KEY) || 'analyst').slice(0, 64);
  } catch {
    return 'analyst';
  }
}

export function setAnalystName(name: string): void {
  try {
    localStorage.setItem(ANALYST_KEY, name.trim().slice(0, 64) || 'analyst');
  } catch {
    /* storage unavailable */
  }
}

export const prahariApi = {
  /**
   * Check if the real Python backend is running
   */
  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(10000) });
      return res.ok;
    } catch {
      return false;
    }
  },

  /**
   * Fetch live intercepts feed from real backend
   */
  async getFeed(category: CrimeCategory | 'ALL' = 'ALL'): Promise<InterceptPost[]> {
    try {
      const url = category && category !== 'ALL'
        ? `${API_BASE_URL}/feed?category=${category}&limit=300`
        : `${API_BASE_URL}/feed?limit=300`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch feed');
      return await res.json();
    } catch (e) {
      console.warn('[Prahari API] Falling back to local feed:', e);
      return [];
    }
  },

  /**
   * Scan arbitrary raw text with Python Hinglish/Slang detection engine
   */
  async scanText(payload: ScanTextPayload): Promise<InterceptPost> {
    const res = await fetch(`${API_BASE_URL}/scan/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...geminiHeaders() },
      body: JSON.stringify({ analyst: getAnalystName(), ...payload }),
    });
    if (!res.ok) throw new Error('Text scanning failed');
    return await res.json();
  },

  /**
   * Scrape and scan real Telegram public broadcast channel via web preview
   */
  async scanChannel(payload: ChannelScanPayload): Promise<{ channel: string; scraped_count: number; intercepts: InterceptPost[] }> {
    const res = await fetch(`${API_BASE_URL}/scan/channel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...geminiHeaders() },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Channel scan failed (${res.status})`);
    return await res.json();
  },

  /**
   * Ingest exported CSV/JSON dataset file into Python backend
   */
  async ingestFile(
    file: File,
    platform?: Platform
  ): Promise<{ filename: string; ingested_count: number; duplicates_skipped?: number; image_only_skipped?: number; records: InterceptPost[] }> {
    const formData = new FormData();
    formData.append('file', file);
    if (platform && platform !== 'UNKNOWN') formData.append('platform', platform);
    formData.append('analyst', getAnalystName());
    const res = await fetch(`${API_BASE_URL}/ingest/file`, {
      method: 'POST',
      headers: geminiHeaders(),
      body: formData,
    });
    if (!res.ok) {
      let message = `File ingestion failed (${res.status})`;
      try {
        const error = await res.json();
        if (error.detail) message = String(error.detail);
      } catch {
        // Keep the HTTP status message when the response has no JSON body.
      }
      throw new Error(message);
    }
    const result = await res.json();
    if (result.error) throw new Error(result.error);
    return result;
  },

  /** Upload a screenshot/photo. `ocrText` is the text read in the browser; the server uses its own OCR when it has one. */
  async ingestImage(
    file: File,
    opts: { channel?: string; platform?: Platform; ocrText?: string; districtId?: string } = {}
  ): Promise<InterceptPost> {
    const formData = new FormData();
    formData.append('file', file);
    if (opts.channel) formData.append('channel', opts.channel);
    if (opts.platform) formData.append('platform', opts.platform);
    if (opts.ocrText) formData.append('ocrText', opts.ocrText);
    if (opts.districtId) formData.append('districtId', opts.districtId);
    formData.append('analyst', getAnalystName());
    const res = await fetch(`${API_BASE_URL}/ingest/image`, { method: 'POST', headers: geminiHeaders(), body: formData });
    if (!res.ok) {
      let message = `Image upload failed (${res.status})`;
      try {
        const error = await res.json();
        if (error.detail) message = String(error.detail);
      } catch {
        // keep the status message
      }
      throw new Error(message);
    }
    return await res.json();
  },

  /** Re-hash the stored text on the backend and compare with the digest recorded at capture. */
  async verifyHash(postId: string): Promise<{ result?: VerifyResult; status: 'ok' | 'not_found' | 'offline' }> {
    try {
      const res = await fetch(`${API_BASE_URL}/dossier/${encodeURIComponent(postId)}/verify?analyst=${encodeURIComponent(getAnalystName())}`, {
        method: 'POST',
        signal: AbortSignal.timeout(20000),
      });
      if (res.status === 404) return { status: 'not_found' };
      if (!res.ok) return { status: 'offline' };
      return { status: 'ok', result: await res.json() };
    } catch {
      return { status: 'offline' };
    }
  },

  async setStatus(postId: string, status: AnalystStatus, note: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/posts/${encodeURIComponent(postId)}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note, analyst: getAnalystName() }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async getAudit(limit = 8): Promise<AuditEntry[] | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/audit?limit=${limit}`);
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  },

  async verifyAuditChain(): Promise<AuditChainStatus | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/audit/verify`);
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  },

  /** URL the browser can open to download the alerts as CSV or JSON (the server sets the file name). */
  exportUrl(format: 'csv' | 'json', filters: { risk?: string; status?: string } = {}): string {
    const q = new URLSearchParams({ format, analyst: getAnalystName() });
    if (filters.risk && filters.risk !== 'ALL') q.set('risk', filters.risk);
    if (filters.status && filters.status !== 'ALL') q.set('status', filters.status);
    return `${API_BASE_URL}/export?${q.toString()}`;
  },

  /** Ask the backend to verify the saved Gemini key (lists models; no usage charged). */
  async checkGeminiKey(): Promise<{
    valid: boolean;
    reason: string;
    generation?: { ok: boolean; model?: string; sample?: string; confidence?: number; status?: string; tried?: string[]; available?: string[] };
  }> {
    try {
      const res = await fetch(`${API_BASE_URL}/gemini/check`, {
        method: 'POST',
        headers: geminiHeaders(),
        signal: AbortSignal.timeout(75000),
      });
      return await res.json();
    } catch {
      return { valid: false, reason: 'Backend unreachable' };
    }
  },

  /**
   * Fetch dynamically correlated Entity Graph from Python Graph Engine
   */
  async getGraph(): Promise<{ nodes: EntityNode[]; edges: EntityEdge[] } | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/graph`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  /** Risk-scored alerts with evidence seal. Returns null when the backend is unreachable. */
  async getAlerts(): Promise<ThreatAlert[] | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/alerts?limit=100`);
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  },

  /** Upload cybercrime complaint exports (Suspect Repository CSVs). Kept on the server only; never in the site. */
  async uploadComplaints(files: File[], adminToken?: string): Promise<{ files: number; rows: number; errors: string[]; summary: ComplaintSummary }> {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    form.append('analyst', getAnalystName());
    const headers: Record<string, string> = {};
    if (adminToken) headers['X-Admin-Token'] = adminToken;
    const res = await fetch(`${API_BASE_URL}/complaints/upload`, { method: 'POST', headers, body: form });
    if (!res.ok) {
      let message = `Upload failed (${res.status})`;
      try {
        const err = await res.json();
        if (err.detail) message = String(err.detail);
      } catch {
        /* keep status message */
      }
      throw new Error(message);
    }
    return res.json();
  },

  async getComplaintSummary(): Promise<ComplaintSummary | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/complaints/summary`);
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  },

  async clearComplaints(adminToken?: string): Promise<boolean> {
    try {
      const headers: Record<string, string> = {};
      if (adminToken) headers['X-Admin-Token'] = adminToken;
      const res = await fetch(`${API_BASE_URL}/complaints?analyst=${encodeURIComponent(getAnalystName())}`, { method: 'DELETE', headers });
      return res.ok;
    } catch {
      return false;
    }
  },

  /** Near-duplicate / coordinated ad groups. Returns null when the backend is unreachable. */
  async getCoordinated(): Promise<CoordinatedGroup[] | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/coordinated`);
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  },

  /**
   * Subscribe to real-time WebSocket stream for new intercepts
   */
  subscribeToStream(onNewIntercept: (post: InterceptPost) => void): () => void {
    let ws: WebSocket | null = null;
    let isClosed = false;

    const connect = () => {
      try {
        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
          console.log('[Prahari Stream] Connected to live OSINT WebSocket');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'NEW_INTERCEPT' && data.data) {
              onNewIntercept(data.data as InterceptPost);
            }
          } catch (err) {
            console.error('[Prahari Stream] Parse error:', err);
          }
        };

        ws.onclose = () => {
          if (!isClosed) {
            setTimeout(connect, 3000);
          }
        };

        ws.onerror = () => {
          if (ws) ws.close();
        };
      } catch {
        // Ignored
      }
    };

    connect();

    return () => {
      isClosed = true;
      if (ws) ws.close();
    };
  },
};
