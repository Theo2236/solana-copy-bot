import { isAuthorizedDashboard } from "@/lib/auth";
import { withApiHandler } from "@/lib/api-handler";
import { getPositions } from "@/lib/store";

export const runtime = "nodejs";

const COLUMNS = [
  "id",
  "status",
  "mint",
  "symbol",
  "sourceWallet",
  "entrySol",
  "exitSol",
  "pnlSol",
  "closeReason",
  "openedAt",
  "closedAt",
] as const;

function csvCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: Request) {
  return withApiHandler(async () => {
    if (!isAuthorizedDashboard(request)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const positions = await getPositions();
    const header = COLUMNS.join(",");
    const lines = positions.map((position) =>
      COLUMNS.map((column) =>
        csvCell((position as unknown as Record<string, unknown>)[column]),
      ).join(","),
    );
    const csv = [header, ...lines].join("\n");

    const date = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="positions-${date}.csv"`,
      },
    });
  });
}
