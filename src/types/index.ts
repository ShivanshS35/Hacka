export type CrimeCategory = 'DRUGS' | 'ARMS' | 'DOCUMENTS' | 'FINANCIAL';

export interface ExtractedEntities {
  phones: string[];
  upis: string[];
  handles: string[];
  wallets: string[];
  bankAccounts: string[];
  ifscCodes?: string[];
}

export type Platform = 'TELEGRAM' | 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK' | 'X' | 'YOUTUBE' | 'SHARECHAT' | 'OLX' | 'QUIKR' | 'OTHER' | 'UNKNOWN';
export type Direction = 'SELL' | 'BUY' | 'RENT_OFFER' | 'RENT_WANTED' | 'UNKNOWN';
export type AnalystStatus = 'NEW' | 'REVIEWING' | 'ESCALATED' | 'FALSE_POSITIVE' | 'CLOSED';

export interface ImageInfo {
  sha256: string;
  phash: string;
  width: number;
  height: number;
  bytes: number;
  format?: string;
  ocrSource?: 'server_tesseract' | 'browser_ocr' | 'none';
  note?: string;
}

export interface SimilarImage {
  postId: string;
  channel?: string;
  distance: number;
}

export interface SharedIdentifier {
  type: string;
  value: string;
  reason: string;
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
  /** Generic handles, placeholder numbers and helplines: shown but never used for linking. */
  sharedIdentifiers?: SharedIdentifier[];
  platform?: Platform;
  direction?: Direction;
  analystStatus?: AnalystStatus;
  analystNote?: string;
  image?: ImageInfo | null;
  similarImages?: SimilarImage[];
  /** Set by the backend when this exact message was already stored (nothing new was added). */
  duplicate?: boolean;
  districtId: string;
  districtName: string;
  sha256: string;
  views: number;
  verified: boolean;
  sourceType?: 'LIVE_TELEGRAM_PREVIEW' | 'ANALYST_SUBMISSION' | 'UPLOADED_DATASET' | 'UPLOADED_IMAGE' | 'SYNTHETIC_DEMO' | 'LOCAL_ANALYSIS' | 'LEGACY_UNKNOWN' | 'DEMO';
  sourceTimestamp?: string | null;
  sourceReference?: string | null;
  capturedAtUtc?: string;
  sha256Scope?: string;
  evidenceDigest?: { note?: string; certified: false; status: string; hashAlgorithm: string; hashScope: string; packetHash: string; timestampUtc: string };
  /** Signed append-only chain link (records captured before the chain existed have none). */
  evidenceChain?: {
    sequence: number;
    recordSha256: string;
    prevHash: string;
    chainHash: string;
    createdAt: string;
    stationSignature: { algorithm: 'Ed25519'; keyId: string; signature: string; signedFields: string[]; canonicalization: string };
    rfc3161Timestamp: { notImplemented: true; note: string };
    linkScheme: string;
  };
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
  flaggedCount?: number;
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
  platform?: Platform;
  direction?: Direction;
  image?: ImageInfo | null;
  analystStatus?: AnalystStatus;
  analystNote?: string;
  statusActor?: string | null;
  statusUpdatedAt?: string | null;
  categories: CrimeCategory[];
  confidence: number;
  matchedSlang: string[];
  entities: ExtractedEntities;
  districtId: string;
  evidence: AlertEvidence;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskScore: number;
  riskReasons: string[];
  /** Set only when complaint data has been uploaded and an identifier matches. */
  complaintCount?: number;
  complaintMatches?: ComplaintMatch[];
  complaintMatchedOn?: string[];
}

export interface ComplaintMatch {
  ackNo: string;
  districtId: string;
  policeStation: string;
  category: string;
  subCategory: string;
  reportedOn: string;
  platform: string;
  matchedOn: string;
}

export interface ComplaintSummary {
  complaints: number;
  loadedAt: string | null;
  identifiers: number;
  identifierTypes: Record<string, number>;
  byDistrict: Record<string, number>;
  byCategory: Record<string, number>;
  bySubCategory: Record<string, number>;
  topics: Record<string, number>;
  repeatIdentifiers: { key: string; type: string; complaints: number }[];
  repeatIdentifierCount: number;
  postsMatched?: number;
  postsChecked?: number;
  note: string;
}

export interface CoordinatedGroup {
  size: number;
  channels: string[];
  crossChannel: boolean;
  maxSimilarity: number;
  postIds: string[];
}

export interface VerifyResult {
  postId: string;
  match: boolean;
  recomputed: string;
  recorded: { column?: string; record?: string; evidenceDigest?: string };
  textCopiesAgree: boolean;
  algorithm: string;
  scope: string;
  checkedAtUtc: string;
  note: string;
  /** Evidence-chain link + Ed25519 signature check (absent on older backends). */
  evidenceChain?: {
    chained: boolean;
    sequence?: number;
    keyId?: string;
    recordHashValid?: boolean;
    chainLinkValid?: boolean;
    signatureValid?: boolean;
    reason?: string | null;
    note?: string;
  };
}

export interface AuditEntry {
  id: number;
  ts: string;
  actor: string;
  action: string;
  postId: string | null;
  detail: Record<string, unknown>;
  prevHash: string;
  entryHash: string;
}

export interface AuditChainStatus {
  ok: boolean;
  entries: number;
  headHash?: string | null;
  brokenAtId?: number;
}
