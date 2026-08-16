import { NextRequest } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reader feedback wall, backed by the Eazo managed PostgreSQL database.
// Public, anonymous submissions — no per-user auth required for this experience.
export async function GET() {
  try {
    const { rows } = await pool.query(
      "SELECT role, score, text, chapter, EXTRACT(EPOCH FROM created_at) * 1000 AS _t FROM feedback ORDER BY created_at ASC LIMIT 200",
    );
    return Response.json(
      rows.map((r) => ({
        role: r.role,
        score: Number(r.score),
        text: r.text,
        chapter: Number(r.chapter),
        _t: Number(r._t),
      })),
    );
  } catch {
    return Response.json([], { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  const data = await request.json().catch(() => null);
  if (!data || typeof data.text !== "string" || !data.text.trim()) {
    return Response.json({ ok: false, error: "bad-json" }, { status: 400 });
  }
  try {
    await pool.query("INSERT INTO feedback (role, score, text, chapter) VALUES ($1, $2, $3, $4)", [
      String(data.role || "读者").slice(0, 60),
      Number(data.score) || 0,
      String(data.text).slice(0, 500),
      Number(data.chapter) || 0,
    ]);
    const { rows } = await pool.query("SELECT COUNT(*)::int AS c FROM feedback");
    return Response.json({ ok: true, count: rows[0].c });
  } catch {
    return Response.json({ ok: false, error: "db" }, { status: 500 });
  }
}
