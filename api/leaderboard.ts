import { Pool } from "pg";

type LeaderboardRow = {
  initials: string;
  total: number;
  stage1: number;
  stage2: number;
  stage3: number;
  created_at: string;
};

const connectionString =
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.DATABASE_URL;

let pool: Pool | null = null;
let schemaReady = false;

function getPool(): Pool {
  if (!connectionString) {
    throw new Error("Missing Postgres connection string");
  }
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      }
    });
  }
  return pool;
}

async function ensureSchema(): Promise<void> {
  if (schemaReady) {
    return;
  }
  const db = getPool();
  await db.query(`
    create table if not exists public.leaderboard_entries (
      id bigserial primary key,
      initials char(3) not null,
      total integer not null check (total >= 0),
      stage1 integer not null check (stage1 >= 0),
      stage2 integer not null check (stage2 >= 0),
      stage3 integer not null check (stage3 >= 0),
      created_at timestamptz not null default now()
    );
  `);
  await db.query(`
    create index if not exists leaderboard_entries_rank_idx
      on public.leaderboard_entries (total desc, created_at asc);
  `);
  schemaReady = true;
}

function sendJson(res: { status: (code: number) => { json: (value: unknown) => void } }, status: number, value: unknown): void {
  res.status(status).json(value);
}

function sanitizeInitials(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
}

function parseNonNegativeInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = Math.round(value);
    return parsed >= 0 ? parsed : null;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return null;
}

function parseBody(body: unknown): Record<string, unknown> {
  if (body instanceof Uint8Array) {
    const text = new TextDecoder().decode(body);
    return parseBody(text);
  }
  if (body && typeof body === "object") {
    return body as Record<string, unknown>;
  }
  if (typeof body === "string" && body.length > 0) {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

export default async function handler(
  req: { method?: string; query?: Record<string, string | string[]>; body?: unknown },
  res: { status: (code: number) => { json: (value: unknown) => void } }
): Promise<void> {
  try {
    await ensureSchema();
  } catch (error) {
    sendJson(res, 500, {
      error: "Leaderboard storage unavailable",
      detail: error instanceof Error ? error.message : "unknown_error"
    });
    return;
  }

  const db = getPool();

  if (req.method === "GET") {
    const limitParam = req.query?.limit;
    const limitValue = Array.isArray(limitParam) ? limitParam[0] : limitParam;
    const parsed = parseNonNegativeInt(limitValue ?? 200);
    const limit = Math.max(1, Math.min(500, parsed ?? 200));

    const result = await db.query<LeaderboardRow>(
      `select initials, total, stage1, stage2, stage3, created_at
       from public.leaderboard_entries
       order by total desc, created_at asc
       limit $1`,
      [limit]
    );
    sendJson(res, 200, { entries: result.rows });
    return;
  }

  if (req.method === "POST") {
    const body = parseBody(req.body);
    const initials = sanitizeInitials(body.initials);
    const total = parseNonNegativeInt(body.total);
    const stage1 = parseNonNegativeInt(body.stage1);
    const stage2 = parseNonNegativeInt(body.stage2);
    const stage3 = parseNonNegativeInt(body.stage3);

    if (!/^[A-Z]{3}$/.test(initials) || total === null || stage1 === null || stage2 === null || stage3 === null) {
      sendJson(res, 400, { error: "Invalid leaderboard payload" });
      return;
    }

    const result = await db.query<LeaderboardRow>(
      `insert into public.leaderboard_entries (initials, total, stage1, stage2, stage3)
       values ($1, $2, $3, $4, $5)
       returning initials, total, stage1, stage2, stage3, created_at`,
      [initials, total, stage1, stage2, stage3]
    );

    sendJson(res, 201, {
      entry: result.rows[0]
    });
    return;
  }

  sendJson(res, 405, { error: "Method not allowed" });
}
