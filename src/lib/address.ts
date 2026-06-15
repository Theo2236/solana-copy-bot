const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Lichte validatie of een string een plausibel Solana-adres (base58) is. */
export function isLikelySolanaAddress(value: string): boolean {
  return BASE58_RE.test(value.trim());
}
