export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    { v: process.env.VERCEL_GIT_COMMIT_SHA || "dev" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
