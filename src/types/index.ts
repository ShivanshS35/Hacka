export type CrimeCategory = 'DRUGS' | 'ARMS' | 'DOCUMENTS' | 'FINANCIAL';

export interface ExtractedEntities {
  phones: string[];
  upis: string[];
  handles: string[];
  wallets: string[];
  bankAccounts: string[];
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
  entities: ExtractedEntities;
  districtId: string;
  districtName: string;
  sha256: string;
  views: number;
  verified: boolean;
  status: 'PENDING' | 'FLAGGED' | 'INVESTIGATING' | 'SEALED';
}

export interface DistrictIntel {
  id: string;
  name: string;
  hindiName: string;
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
  type: 'UPI' | 'PHONE' | 'CRYPTO' | 'TELEGRAM';
  category: CrimeCategory;
}

export interface EntityNode {
  id: string;
  label: string;
  type: 'post' | 'upi' | 'phone' | 'telegram' | 'crypto' | 'district';
  category?: CrimeCategory;
  channels?: string[];
  riskScore: number;
  isHero?: boolean;
}

export interface EntityEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  category?: CrimeCategory;
}

export type ActiveMode = 'ALL' | 'DRUGS' | 'ARMS' | 'DOCUMENTS' | 'FINANCIAL';
