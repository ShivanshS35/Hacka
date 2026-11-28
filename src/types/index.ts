export type CrimeCategory = 'DRUGS' | 'ARMS' | 'DOCUMENTS' | 'FINANCIAL';

export interface ExtractedEntities {
  phones: string[];
  upis: string[];
  handles: string[];
  wallets: string[];
  bankAccounts: string[];
  ifscCodes?: string[];
}

export interface InterceptPost {
  id: string;
  channel: string;
  channelSubscribers?: string;
  timestamp: string;
  capturedAt: string;
  rawText: string;
  categories: CrimeCategory[];
  confidence: number;
  matchedSlang: string[];
  /** True when Gemini (user's own key) classified this post because the lexicon was unsure. */
  aiAssisted?: boolean;
  aiReason?: string | null;
  aiModel?: string | null;
  aiStatus?: string | null;
  entities: ExtractedEntities;
  districtId: string;
  districtName: string;
  sha256: string;
  views: number;
  verified: boolean;
  sourceType?: 'LIVE_TELEGRAM_PREVIEW' | 'ANALYST_SUBMISSION' | 'UPLOADED_DATASET' | 'SYNTHETIC_DEMO' | 'LOCAL_ANALYSIS' | 'LEGACY_UNKNOWN' | 'DEMO';
  sourceTimestamp?: string | null;
  sourceReference?: string | null;
  capturedAtUtc?: string;
  sha256Scope?: string;
  evidenceDigest?: { note?: string; certified: false; status: string; hashAlgorithm: string; hashScope: string; packetHash: string; timestampUtc: string };
  status: 'PENDING' | 'FLAGGED' | 'INVESTIGATING' | 'DIGESTED' | 'UNCLASSIFIED';
}

export interface DistrictIntel {
  id: string;
  name: string;
  hindiName: string;
  division?: string; // Administrative division (Jaipur, Jodhpur, Bikaner, Ajmer, Udaipur, Kota, Bharatpur)
  x: number; // centroid SVG coordinate
  y: number;
  path: string; // SVG path
  threatLevel: 'CRITICAL' | 'HIGH' | 'ELEVATED' | 'MODERATE';
  flaggedCount: number;
  topCategories: CrimeCategory[];
  activeChannels: string[];
  topIdentifiers: string[];
  coordinates?: [number, number]; // [longitude, latitude]
}

export interface DistrictConnection {
  id: string;
  from: string; // district id
  to: string; // district id
  identifier: string; // e.g. raj.pay@oksbi
  type: 'UPI' | 'PHONE' | 'CRYPTO' | 'TELEGRAM' | 'BANK';
  category: CrimeCategory;
}

export interface EntityNode {
  id: string;
  label: string;
  type: 'post' | 'upi' | 'phone' | 'telegram' | 'crypto' | 'bank_account' | 'ifsc' | 'district';
  category?: CrimeCategory | 'UNCLASSIFIED';
  channels?: string[];
  isHero?: boolean;
}

export interface EntityEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  category?: CrimeCategory | 'UNCLASSIFIED';
}

export type ActiveMode = 'ALL' | 'DRUGS' | 'ARMS' | 'DOCUMENTS' | 'FINANCIAL';

export interface AlertEvidence {
  text: string;
  capturedAtUtc?: string;
  sourceType?: string;
  sha256: string;
  sha256Scope: string;
}

export interface ThreatAlert {
  alertId: string;
  postId: string;
  channel: string;
  categories: CrimeCategory[];
  confidence: number;
  matchedSlang: string[];
  entities: ExtractedEntities;
  districtId: string;
  evidence: AlertEvidence;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskScore: number;
  riskReasons: string[];
}

export interface CoordinatedGroup {
  size: number;
  channels: string[];
  crossChannel: boolean;
  maxSimilarity: number;
  postIds: string[];
}
