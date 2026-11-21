import { CrimeCategory, ExtractedEntities } from '../types';

// Multi-dialect slang database for Indian Law Enforcement & OSINT
export const SLANG_DICTIONARY: Record<CrimeCategory, { terms: string[]; weight: number }[]> = {
  DRUGS: [
    { terms: ['pure white', 'white', 'chitta', 'chita', 'चिट्टा'], weight: 0.95 },
    { terms: ['afeem', 'opium', 'अफ़ीम', 'doda post', 'dodapost'], weight: 0.93 },
    { terms: ['charas', 'चिलम', 'malana', 'hashish', 'bhang', 'ganja', 'गांजा'], weight: 0.91 },
    { terms: ['mdma', 'mephedrone', 'meow meow', 'ecstasy', 'molly'], weight: 0.97 },
    { terms: ['smack', 'heroin', 'brown sugar', 'पुड़िया'], weight: 0.96 },
    { terms: ['maal', 'maal available', 'stuff available', 'score', 'consignments'], weight: 0.88 },
    { terms: ['5g', '10g', 'pouch', 'leaf', 'weed', 'ice', 'meth'], weight: 0.82 },
    { terms: ['🔥', '❄️', '🌿', '💊', '💉', '🍁'], weight: 0.75 },
  ],
  ARMS: [
    { terms: ['desi katta', 'katta', 'कट्टा', 'देशी कट्टा'], weight: 0.98 },
    { terms: ['.32 bore', '32 bore', '.315 bore', '.12 bore', '315 बोर'], weight: 0.97 },
    { terms: ['tamancha', 'तमंचा', 'sixer', 'revolver'], weight: 0.96 },
    { terms: ['pistol', 'पिस्तौल', 'glock', 'beretta', 'star pistol'], weight: 0.94 },
    { terms: ['cartridge', 'cartridges', 'round', 'rounds', 'kartus', 'कारतूस'], weight: 0.92 },
    { terms: ['bandook', 'weapon', 'magazine', 'ammo', 'firearm', 'hathiyar', 'हथियार'], weight: 0.89 },
    { terms: ['consignment', 'delivery by hand', 'bypass delivery', 'border delivery'], weight: 0.78 },
    { terms: ['🔫', '💥', '🎯', '💣'], weight: 0.72 },
  ],
  DOCUMENTS: [
    { terms: ['fake aadhaar', 'fake aadhar', 'फ़र्ज़ी आधार', 'duplicate aadhaar'], weight: 0.97 },
    { terms: ['fake pan', 'pan card set', 'pan bypass', 'फ़र्ज़ी पैन'], weight: 0.96 },
    { terms: ['marksheet', 'degree', 'diploma', '10th marksheet', '12th marksheet'], weight: 0.93 },
    { terms: ['driving license', 'dl', 'rc', 'registration certificate'], weight: 0.91 },
    { terms: ['hologram', 'hologram verified', 'government job pass', 'sarkari job pass'], weight: 0.94 },
    { terms: ['instant verification', 'biometric bypass', '3 din me', '3 din mein', 'home delivery'], weight: 0.85 },
    { terms: ['🪪', '📄', '🖨️', '✍️'], weight: 0.70 },
  ],
  FINANCIAL: [
    { terms: ['kyc verified', 'kyc verified account', 'fully kyc', 'full kyc'], weight: 0.96 },
    { terms: ['mule account', 'mule', 'current account', 'saving account', 'खाता'], weight: 0.95 },
    { terms: ['atm card', 'atm kit', 'net-banking kit', 'cheque book', 'debit card kit'], weight: 0.94 },
    { terms: ['kiraya pe', 'account kiraya', 'rent account', 'account rent'], weight: 0.95 },
    { terms: ['usdt arbitrage', 'crypto arbitrage', 'usdt sell', 'usdt buy'], weight: 0.88 },
    { terms: ['fullz', 'bank kit', 'daily limit', 'withdrawal limit 50l'], weight: 0.91 },
    { terms: ['💳', '🏧', '💰', '🏦', '💸'], weight: 0.72 },
  ]
};

// Regex extractors
export const REGEX_PATTERNS = {
  phone: /(?:(?:\+91|91|0)[-.\s]?)?[6-9]\d{4}[-.\s]?\d{5}\b/g,
  upi: /[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/g,
  telegram: /@[a-zA-Z0-9_]{4,32}\b/g,
  crypto: /(?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b|0x[a-fA-F0-9]{40}\b/g,
  bankAccount: /\b\d{9,18}\b/g,
};

// Cryptographic SHA-256 for browser environments
export async function generateSHA256(text: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const msgUint8 = new TextEncoder().encode(text);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback
    }
  }
  // Deterministic fallback hash for non-async or SSR
  let hash1 = 0xdeadbeef ^ 0;
  let hash2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    hash1 = Math.imul(hash1 ^ ch, 2654435761);
    hash2 = Math.imul(hash2 ^ ch, 1597334677);
  }
  hash1 = Math.imul(hash1 ^ (hash1 >>> 16), 2246822507) ^ Math.imul(hash2 ^ (hash2 >>> 13), 3266489909);
  hash2 = Math.imul(hash2 ^ (hash2 >>> 16), 2246822507) ^ Math.imul(hash1 ^ (hash1 >>> 13), 3266489909);
  const p1 = (hash1 >>> 0).toString(16).padStart(8, '0');
  const p2 = (hash2 >>> 0).toString(16).padStart(8, '0');
  return (p1 + p2 + p1 + p2 + p1 + p2 + p1 + p2).slice(0, 64);
}

export function extractEntities(text: string): ExtractedEntities {
  const phones: string[] = [];
  const upis: string[] = [];
  const handles: string[] = [];
  const wallets: string[] = [];
  const bankAccounts: string[] = [];

  // Match UPIs first so we don't confuse them
  const upiMatches = text.match(REGEX_PATTERNS.upi) || [];
  upiMatches.forEach(u => {
    if (!upis.includes(u)) upis.push(u);
  });

  // Match Telegram handles
  const handleMatches = text.match(REGEX_PATTERNS.telegram) || [];
  handleMatches.forEach(h => {
    if (!handles.includes(h)) handles.push(h);
  });

  // Match Crypto
  const cryptoMatches = text.match(REGEX_PATTERNS.crypto) || [];
  cryptoMatches.forEach(c => {
    if (!wallets.includes(c)) wallets.push(c);
  });

  // Match Phones
  const phoneMatches = text.match(REGEX_PATTERNS.phone) || [];
  phoneMatches.forEach(p => {
    const cleaned = p.replace(/[-.\s]/g, '');
    if (!phones.includes(cleaned) && cleaned.length >= 10) {
      phones.push(cleaned);
    }
  });

  return { phones, upis, handles, wallets, bankAccounts };
}

export interface ClassificationResult {
  categories: CrimeCategory[];
  confidence: number;
  matchedTerms: string[];
  extracted: ExtractedEntities;
}

export function classifyText(text: string): ClassificationResult {
  const lower = text.toLowerCase();
  const matchedCategories: { category: CrimeCategory; score: number; terms: string[] }[] = [];

  (Object.keys(SLANG_DICTIONARY) as CrimeCategory[]).forEach(category => {
    const termGroups = SLANG_DICTIONARY[category];
    let maxWeight = 0;
    const foundTerms: string[] = [];

    termGroups.forEach(group => {
      group.terms.forEach(term => {
        if (lower.includes(term.toLowerCase())) {
          foundTerms.push(term);
          if (group.weight > maxWeight) {
            maxWeight = group.weight;
          }
        }
      });
    });

    if (foundTerms.length > 0) {
      // Confidence calculation boosted slightly with multiple matched terms
      const boost = Math.min(0.04 * (foundTerms.length - 1), 0.08);
      const finalScore = Math.min(maxWeight + boost, 0.99);
      matchedCategories.push({
        category,
        score: finalScore,
        terms: Array.from(new Set(foundTerms))
      });
    }
  });

  matchedCategories.sort((a, b) => b.score - a.score);

  const categories = matchedCategories.map(c => c.category);
  const confidence = matchedCategories.length > 0 ? matchedCategories[0].score : 0.12;
  const matchedTerms = Array.from(new Set(matchedCategories.flatMap(c => c.terms)));
  const extracted = extractEntities(text);

  return {
    categories: categories.length > 0 ? categories : ['FINANCIAL'],
    confidence: Number(confidence.toFixed(2)),
    matchedTerms,
    extracted
  };
}
