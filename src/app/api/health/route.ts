import { withApiHandler } from "@/lib/api-handler";
import { getBotPublicKey } from "@/lib/solana";

export const runtime = "nodejs";

export async function GET() {
  return withApiHandler(async () => {
    return Response.json({
      ok: true,
      service: "solana-copy-bot",
      mode: process.env.BOT_MODE === "live" ? "live" : "dry_run",
      botWalletConfigured: Boolean(getBotPublicKey()),
      redisConfigured: Boolean(
        process.env.UPSTASH_REDIS_REST_URL &&
          process.env.UPSTASH_REDIS_REST_TOKEN,
      ),
      heliusConfigured: Boolean(process.env.HELIUS_API_KEY),
      timestamp: new Date().toISOString(),
    });
  });
}
