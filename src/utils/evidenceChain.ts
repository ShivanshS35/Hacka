import { VerifyResult } from '../types';

/** True unless the backend reported a failed chain or signature check (records with no chain entry count as OK). */
export function chainOk(r: VerifyResult): boolean {
  const c = r.evidenceChain;
  if (!c || !c.chained) return true;
  return Boolean(c.recordHashValid && c.chainLinkValid && c.signatureValid);
}

/** One-line summary of the evidence-chain + Ed25519 check, or null for an older backend that does not send it. */
export function describeChain(r: VerifyResult): string | null {
  const c = r.evidenceChain;
  if (!c) return null;
  if (!c.chained) return 'NOT SIGNED: captured before the evidence chain existed, so there is no signature to check.';
  if (chainOk(r)) {
    return `SIGNED & CHAINED: entry #${c.sequence}, Ed25519 signature valid (key ${c.keyId}), link to the previous entry intact.`;
  }
  const failed = [
    !c.recordHashValid && 'stored record',
    !c.chainLinkValid && 'chain link',
    !c.signatureValid && 'signature',
  ].filter(Boolean).join(', ');
  return `CHAIN CHECK FAILED (${failed})${c.reason ? `: ${c.reason}` : ''}. Treat this record as altered.`;
}

export const NO_TIMESTAMP_NOTE = 'No trusted timestamp: RFC 3161 is not implemented, so the capture time is the server clock.';
