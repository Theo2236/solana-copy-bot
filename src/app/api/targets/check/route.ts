import { isAuthorizedDashboard } from "@/lib/auth";
import { isLikelySolanaAddress } from "@/lib/address";
import { getWalletActivity, getWalletSwapSample } from "@/lib/helius";

export const runtime = "nodejs";

/**
 * Valideert een kandidaat-wallet: checkt of het adres geldig is en haalt
 * recente SWAP-activiteit op via Helius. Gebruikt om te bepalen of een wallet
 * actief genoeg is om te volgen.
 */
export async function POST(request: Request) {
  if (!isAuthorizedDashboard(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { address?: string; debug?: boolean } = {};
  try {
    body = (await request.json()) as { address?: string; debug?: boolean };
  } catch {
    body = {};
  }

  const address = body.address?.trim();
  if (!address || !isLikelySolanaAddress(address)) {
    return Response.json(
      { error: "Ongeldig Solana-adres" },
      { status: 400 },
    );
  }

  const activity = await getWalletActivity(address);
  const sample = body.debug ? await getWalletSwapSample(address) : undefined;
  return Response.json({ ok: true, address, activity, sample });
}
