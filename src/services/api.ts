import { InterceptPost, DistrictIntel, CrimeCategory, EntityNode, EntityEdge } from '../types';

const API_BASE_URL = 'http://localhost:8000/api';
const WS_URL = 'ws://localhost:8000/ws/stream';

export interface ScanTextPayload {
  text: string;
  channel?: string;
  districtId?: string;
}

export interface ChannelScanPayload {
  channel: string;
  limit?: number;
}

export const prahariApi = {
  /**
   * Check if the real Python backend is running
   */
  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(2500) });
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
        ? `${API_BASE_URL}/feed?category=${category}`
        : `${API_BASE_URL}/feed`;
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Text scanning failed');
    return await res.json();
  },

  /**
   * Scrape and scan real Telegram public broadcast channel via web preview
   */
  async scanChannel(payload: ChannelScanPayload): Promise<{ channel: string; intercepts: InterceptPost[] }> {
    const res = await fetch(`${API_BASE_URL}/scan/channel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Channel scraping failed');
    return await res.json();
  },

  /**
   * Ingest exported CSV/JSON dataset file into Python backend
   */
  async ingestFile(file: File): Promise<{ filename: string; ingested_count: number; records: InterceptPost[] }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE_URL}/ingest/file`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('File ingestion failed');
    return await res.json();
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
