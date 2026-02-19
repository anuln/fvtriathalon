import { Pool } from "pg";

type LeaderboardRow = {
  initials: string;
  total: number;
  stage1: number;
  stage2: number;
  stage3: number;
  created_at: string;
};

type JsonResponse = {
  status: (code: number) => { json: (value: unknown) => void };
};

type RequestLike = {
  method?: string;
  query?: Record<string, string | string[]>;
  body?: unknown;
};

type ConnectionSpec = {
  value: string | null;
  source: string | null;
};

const CONNECTION_ENV_KEYS = [
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "DATABASE_URL",
  "SUPABASE_DB_URL",
  "SUPABASE_DATABASE_URL",
  "SUPABASE_POSTGRES_URL",
  "SUPABASE_POOLER_URL",
  "SUPABASE_POOLER_TRANSACTION_URL"
] as const;

function resolveConnectionSpec(): ConnectionSpec {
  for (const key of CONNECTION_ENV_KEYS) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return {
        value,
        source: key
      };
    }
  }
  return {
    value: null,
    source: null
  };
}

const connectionSpec = resolveConnectionSpec();

let pool: Pool | null = null;
let schemaReady = false;

function shouldUseSsl(connectionString: string): boolean {
  if (/sslmode=disable/i.test(connectionString)) {
    return false;
  }
  return !/(localhost|127\.0\.0\.1)/i.test(connectionString);
}

function normalizeSslConnectionString(connectionString: string): string {
  try {
    const normalized = new URL(connectionString);
    normalized.searchParams.set("sslmode", "no-verify");
    normalized.searchParams.delete("sslcert");
    normalized.searchParams.delete("sslkey");
    normalized.searchParams.delete("sslrootcert");
    return normalized.toString();
  } catch {
    return connectionString;
  }
}

function getPool(): Pool {
  if (!connectionSpec.value) {
    throw new Error(
      `Missing Postgres connection string. Configure one of: ${CONNECTION_ENV_KEYS.join(", ")}`
    );
  }

  const useSsl = shouldUseSsl(connectionSpec.value);
  const connectionString = useSsl
    ? normalizeSslConnectionString(connectionSpec.value)
    : connectionSpec.value;

  if (!pool) {
    pool = new Pool(
      useSsl
        ? {
            connectionString,
            ssl: {
              rejectUnauthorized: false
            }
          }
        : {
            connectionString
          }
    );
  }
  return pool;
}

function readQueryValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function isPermissionError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  return (error as { code?: unknown }).code === "42501";
}

function errorDetail(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "unknown_error";
}

async function leaderboardTableExists(db: Pool): Promise<boolean> {
  const result = await db.query<{ table_name: string | null }>(
    "select to_regclass('public.leaderboard_entries') as table_name"
  );
  return Boolean(result.rows[0]?.table_name);
}

async function ensureSchema(): Promise<void> {
  if (schemaReady) {
    return;
  }

  const db = getPool();
  try {
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
  } catch (error) {
    if (isPermissionError(error) && (await leaderboardTableExists(db))) {
      schemaReady = true;
      console.warn(
        "[leaderboard] schema setup skipped due permissions; existing table will be used"
      );
      return;
    }
    throw error;
  }
}

function sendJson(res: JsonResponse, status: number, value: unknown): void {
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

function buildStorageUnavailablePayload(error: unknown): Record<string, unknown> {
  const tlsMode = connectionSpec.value
    ? shouldUseSsl(connectionSpec.value)
      ? "sslmode=no-verify"
      : "ssl-disabled"
    : "not-configured";
  return {
    error: "Leaderboard storage unavailable",
    detail: errorDetail(error),
    connectionSource: connectionSpec.source,
    tlsMode,
    hint: `Configure one of: ${CONNECTION_ENV_KEYS.join(", ")}`
  };
}

async function sendDebugSnapshot(res: JsonResponse): Promise<void> {
  const configured = Boolean(connectionSpec.value);
  if (!configured) {
    sendJson(res, 200, {
      ok: false,
      connectionConfigured: false,
      connectionSource: null,
      tlsMode: "not-configured",
      schemaReady,
      hint: `Configure one of: ${CONNECTION_ENV_KEYS.join(", ")}`
    });
    return;
  }

  try {
    const db = getPool();
    const pingResult = await db.query<{ ok: number }>("select 1 as ok");
    const tableExists = await leaderboardTableExists(db);
    sendJson(res, 200, {
      ok: true,
      connectionConfigured: true,
      connectionSource: connectionSpec.source,
      tlsMode: shouldUseSsl(connectionSpec.value) ? "sslmode=no-verify" : "ssl-disabled",
      schemaReady,
      pingOk: pingResult.rows[0]?.ok === 1,
      tableExists
    });
  } catch (error) {
    sendJson(res, 200, {
      ok: false,
      connectionConfigured: true,
      connectionSource: connectionSpec.source,
      tlsMode: shouldUseSsl(connectionSpec.value) ? "sslmode=no-verify" : "ssl-disabled",
      schemaReady,
      detail: errorDetail(error)
    });
  }
}

export default async function handler(req: RequestLike, res: JsonResponse): Promise<void> {
  if (req.method === "GET" && readQueryValue(req.query?.debug) === "1") {
    await sendDebugSnapshot(res);
    return;
  }

  try {
    await ensureSchema();
  } catch (error) {
    console.error("[leaderboard] storage unavailable", error);
    sendJson(res, 503, buildStorageUnavailablePayload(error));
    return;
  }

  const db = getPool();

  if (req.method === "GET") {
    const parsed = parseNonNegativeInt(readQueryValue(req.query?.limit) || 200);
    const limit = Math.max(1, Math.min(500, parsed ?? 200));

    try {
      const result = await db.query<LeaderboardRow>(
        `select initials, total, stage1, stage2, stage3, created_at
         from public.leaderboard_entries
         order by total desc, created_at asc
         limit $1`,
        [limit]
      );
      sendJson(res, 200, { entries: result.rows });
    } catch (error) {
      console.error("[leaderboard] read failed", error);
      sendJson(res, 500, {
        error: "Leaderboard read failed",
        detail: errorDetail(error)
      });
    }
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

    try {
      const result = await db.query<LeaderboardRow>(
        `insert into public.leaderboard_entries (initials, total, stage1, stage2, stage3)
         values ($1, $2, $3, $4, $5)
         returning initials, total, stage1, stage2, stage3, created_at`,
        [initials, total, stage1, stage2, stage3]
      );

      sendJson(res, 201, {
        entry: result.rows[0]
      });
    } catch (error) {
      console.error("[leaderboard] submit failed", error);
      sendJson(res, 500, {
        error: "Leaderboard submit failed",
        detail: errorDetail(error)
      });
    }
    return;
  }

  sendJson(res, 405, { error: "Method not allowed" });
}
