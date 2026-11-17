import postgres from 'postgres';
import { SCHEMA, SCHEMA_VERSION } from './schema';
import { TOPICS } from './topics';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Sql = postgres.Sql<any>;
const g = globalThis as unknown as { __sql?: Sql; __ready?: Promise<void> };

function connect(): Sql {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
  if (!url) throw new Error('DATABASE_URL is not set');
  const local = /localhost|127\.0\.0\.1/.test(url);
  return postgres(url, { ssl: local ? false : 'require', max: 5, idle_timeout: 20, connect_timeout: 15, prepare: false });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function init(sql: Sql) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await sql.begin(async (tx: any) => {
    await tx`select pg_advisory_xact_lock(72700127)`;
    const reg = await tx`select to_regclass('public.settings') as r`;
    let ver = 0;
    if (reg[0].r) {
      const v = await tx`select value from settings where key = 'schema_version'`;
      ver = v[0] ? Number(v[0].value) : 0;
    }
    if (ver >= SCHEMA_VERSION) return;
    await tx.unsafe(SCHEMA);
    for (const t of TOPICS) {
      await tx`insert into topics(id, title, category) values (${t.id}, ${t.title}, ${t.category}) on conflict (id) do nothing`;
    }
    await tx`insert into settings(key, value) values ('schema_version', ${tx.json(SCHEMA_VERSION)})
             on conflict (key) do update set value = excluded.value`;
  });
}

/** Returns a ready-to-use client; creates the schema and seeds topics on first use. */
export async function db(): Promise<Sql> {
  g.__sql ??= connect();
  const sql = g.__sql;
  g.__ready ??= init(sql).catch((e) => {
    g.__ready = undefined;
    throw e;
  });
  await g.__ready;
  return sql;
}

export async function audit(actor: string, action: string, detail: unknown = {}) {
  const sql = await db();
  await sql`insert into audit_log(actor, action, detail) values (${actor}, ${action}, ${sql.json(detail as never)})`;
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const sql = await db();
  const r = await sql`select value from settings where key = ${key}`;
  return r[0] ? (r[0].value as T) : fallback;
}

export async function setSetting(key: string, value: unknown) {
  const sql = await db();
  await sql`insert into settings(key, value) values (${key}, ${sql.json(value as never)})
            on conflict (key) do update set value = excluded.value`;
}
