/** Solscan-links voor wallets, tokens (mints) en transacties. */

const BASE = "https://solscan.io";

export function solscanAddress(address: string): string {
  return `${BASE}/account/${address}`;
}

export function solscanToken(mint: string): string {
  return `${BASE}/token/${mint}`;
}

export function solscanTx(signature: string): string {
  return `${BASE}/tx/${signature}`;
}

/** Kort een adres of signature af tot `abcd…wxyz`. */
export function shortenAddress(value: string, chars = 4): string {
  if (value.length <= chars * 2 + 1) return value;
  return `${value.slice(0, chars)}…${value.slice(-chars)}`;
}
