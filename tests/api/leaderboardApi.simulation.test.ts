import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredRow = {
  initials: string;
  total: number;
  stage1: number;
  stage2: number;
  stage3: number;
  created_at: string;
};

vi.mock("pg", () => {
  let createdAtTick = 0;
  let rows: StoredRow[] = [];

  function typedRows<T extends Record<string, unknown>>(value: Record<string, unknown>[]): T[] {
    return value as unknown as T[];
  }

  class Pool {
    async query<T extends Record<string, unknown>>(text: string, params: unknown[] = []): Promise<{ rows: T[] }> {
      const sql = text.toLowerCase().replace(/\s+/g, " ").trim();
      if (sql.startsWith("create table if not exists public.leaderboard_entries")) {
        return { rows: [] as T[] };
      }
      if (sql.startsWith("create index if not exists leaderboard_entries_rank_idx")) {
        return { rows: [] as T[] };
      }
      if (sql.includes("select to_regclass('public.leaderboard_entries') as table_name")) {
        return { rows: typedRows<T>([{ table_name: "leaderboard_entries" }]) };
      }
      if (sql.startsWith("select 1 as ok")) {
        return { rows: typedRows<T>([{ ok: 1 }]) };
      }
      if (sql.includes("insert into public.leaderboard_entries")) {
        const [initials, total, stage1, stage2, stage3] = params as [string, number, number, number, number];
        const inserted: StoredRow = {
          initials,
          total,
          stage1,
          stage2,
          stage3,
          created_at: new Date(Date.UTC(2026, 1, 19, 0, 0, createdAtTick++)).toISOString()
        };
        rows.push(inserted);
        return { rows: typedRows<T>([inserted]) };
      }
      if (sql.includes("from public.leaderboard_entries") && sql.includes("order by total desc, created_at asc")) {
        const limit = Math.max(1, Number(params[0] ?? 200));
        const ranked = [...rows]
          .sort((a, b) => {
            if (b.total !== a.total) {
              return b.total - a.total;
            }
            return a.created_at.localeCompare(b.created_at);
          })
          .slice(0, limit);
        return { rows: typedRows<T>(ranked) };
      }
      throw new Error(`Unmocked SQL query in test: ${text}`);
    }
  }

  return {
    Pool,
    __resetMockDb() {
      createdAtTick = 0;
      rows = [];
    }
  };
});

type MockReq = {
  method?: string;
  query?: Record<string, string | string[]>;
  body?: unknown;
};

type MockRes = {
  status: (code: number) => { json: (value: unknown) => void };
};

function createResponseCapture(): {
  res: MockRes;
  read: () => { statusCode: number; payload: unknown };
} {
  let statusCode = 200;
  let payload: unknown = null;
  const res: MockRes = {
    status(code: number) {
      statusCode = code;
      return {
        json(value: unknown) {
          payload = value;
        }
      };
    }
  };
  return {
    res,
    read: () => ({ statusCode, payload })
  };
}

async function invoke(
  handler: (req: MockReq, res: MockRes) => Promise<void>,
  req: MockReq
): Promise<{ statusCode: number; payload: unknown }> {
  const capture = createResponseCapture();
  await handler(req, capture.res);
  return capture.read();
}

describe("leaderboard api simulation", () => {
  beforeEach(async () => {
    vi.resetModules();
    process.env.DATABASE_URL = "postgres://demo:demo@db.example.com:5432/demo";
    const pg = (await import("pg")) as unknown as { __resetMockDb?: () => void };
    pg.__resetMockDb?.();
  });

  it("simulates bulk submissions and verifies ranked leaderboard order", async () => {
    const module = await import("../../api/leaderboard");
    const handler = module.default as (req: MockReq, res: MockRes) => Promise<void>;

    for (let i = 0; i < 120; i += 1) {
      const total = (i * 137) % 5000 + 1000;
      const stage1 = Math.floor(total * 0.28);
      const stage2 = Math.floor(total * 0.33);
      const stage3 = total - stage1 - stage2;
      const initials = `A${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + ((i * 7) % 26))}`;
      const response = await invoke(handler, {
        method: "POST",
        body: { initials, total, stage1, stage2, stage3 }
      });
      expect(response.statusCode).toBe(201);
    }

    const getResponse = await invoke(handler, {
      method: "GET",
      query: { limit: "20" }
    });

    expect(getResponse.statusCode).toBe(200);
    const payload = getResponse.payload as { entries: StoredRow[] };
    expect(payload.entries).toHaveLength(20);

    for (let i = 1; i < payload.entries.length; i += 1) {
      const prev = payload.entries[i - 1];
      const current = payload.entries[i];
      expect(prev.total).toBeGreaterThanOrEqual(current.total);
      if (prev.total === current.total) {
        expect(prev.created_at <= current.created_at).toBe(true);
      }
    }
  });

  it("simulates tie scores and keeps earliest submission first", async () => {
    const module = await import("../../api/leaderboard");
    const handler = module.default as (req: MockReq, res: MockRes) => Promise<void>;

    const first = await invoke(handler, {
      method: "POST",
      body: { initials: "AAA", total: 4200, stage1: 1400, stage2: 1400, stage3: 1400 }
    });
    const second = await invoke(handler, {
      method: "POST",
      body: { initials: "BBB", total: 4200, stage1: 1400, stage2: 1400, stage3: 1400 }
    });
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);

    const board = await invoke(handler, { method: "GET", query: { limit: "2" } });
    expect(board.statusCode).toBe(200);
    const entries = (board.payload as { entries: StoredRow[] }).entries;
    expect(entries[0]?.initials).toBe("AAA");
    expect(entries[1]?.initials).toBe("BBB");
  });

  it("simulates debug health endpoint and verifies connection diagnostics", async () => {
    const module = await import("../../api/leaderboard");
    const handler = module.default as (req: MockReq, res: MockRes) => Promise<void>;

    const debug = await invoke(handler, { method: "GET", query: { debug: "1" } });
    expect(debug.statusCode).toBe(200);
    expect(debug.payload).toMatchObject({
      ok: true,
      connectionConfigured: true,
      pingOk: true,
      tableExists: true,
      tlsMode: "sslmode=no-verify"
    });
  });
});
