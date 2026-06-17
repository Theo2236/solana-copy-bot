import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { getRpcUrl } from "./config";

let connection: Connection | null = null;
let keypair: Keypair | null = null;

export function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(getRpcUrl(), "confirmed");
  }
  return connection;
}

export function getBotKeypair(): Keypair | null {
  if (keypair) return keypair;
  const secret = process.env.BOT_WALLET_PRIVATE_KEY;
  if (!secret) return null;

  try {
    if (secret.startsWith("[")) {
      const bytes = Uint8Array.from(JSON.parse(secret) as number[]);
      keypair = Keypair.fromSecretKey(bytes);
    } else {
      keypair = Keypair.fromSecretKey(bs58.decode(secret));
    }
    return keypair;
  } catch (error) {
    console.error("Invalid BOT_WALLET_PRIVATE_KEY", error);
    return null;
  }
}

export function getBotPublicKey(): string | null {
  return getBotKeypair()?.publicKey.toBase58() ?? null;
}

export async function getBotBalanceSol(): Promise<number> {
  const kp = getBotKeypair();
  if (!kp) return 0;
  const lamports = await getConnection().getBalance(kp.publicKey);
  return lamports / LAMPORTS_PER_SOL;
}

export async function getWalletBalanceSol(address: string): Promise<number> {
  try {
    const lamports = await getConnection().getBalance(new PublicKey(address));
    return lamports / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}

export async function sendVersionedTransaction(
  serializedTx: string,
): Promise<string> {
  const kp = getBotKeypair();
  if (!kp) {
    throw new Error("BOT_WALLET_PRIVATE_KEY not configured");
  }

  const tx = VersionedTransaction.deserialize(
    Buffer.from(serializedTx, "base64"),
  );
  tx.sign([kp]);

  const signature = await getConnection().sendTransaction(tx, {
    skipPreflight: false,
    maxRetries: 2,
  });

  await getConnection().confirmTransaction(signature, "confirmed");
  return signature;
}

/** Verstuurt een reeds gesigneerde versioned transaction. */
export async function sendSignedVersionedTransaction(
  tx: VersionedTransaction,
): Promise<string> {
  const signature = await getConnection().sendTransaction(tx, {
    skipPreflight: false,
    maxRetries: 2,
  });
  await getConnection().confirmTransaction(signature, "confirmed");
  return signature;
}

export function isValidPublicKey(value: string): boolean {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}
