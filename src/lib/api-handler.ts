export async function withApiHandler(
  fn: () => Promise<Response>,
): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    console.error("[api]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
