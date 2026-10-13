import { getDb } from '../../../db';
import { env } from "cloudflare:workers";
import { movements } from '../../../db/schema';
import { desc, eq } from 'drizzle-orm';
import { validate, Movement } from '../../../lib/ledger';

export const dynamic = 'force-dynamic';

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

let tableChecked = false;
async function ensureSchema() {
  if (tableChecked) return;
  if (!env?.DB) return;
  try {
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS movements (id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL, amount INTEGER NOT NULL, date TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL, payment TEXT NOT NULL, created_at TEXT NOT NULL)"
    ).run();
    tableChecked = true;
  } catch (e) {
    try {
      await env.DB.exec(
        "CREATE TABLE IF NOT EXISTS movements (id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL, amount INTEGER NOT NULL, date TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL, payment TEXT NOT NULL, created_at TEXT NOT NULL);"
      );
      tableChecked = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Error creating table in D1:', msg);
      throw new Error('Inicializando tabla D1: ' + msg);
    }
  }
}

export async function GET() {
  try {
    if (!env?.DB) {
      return json({ error: "Falta vincular la base de datos D1 como 'DB' en Settings > Bindings de Cloudflare." }, 500);
    }
    await ensureSchema();
    const rows = await getDb().select().from(movements).orderBy(desc(movements.date), desc(movements.createdAt));
    return json(rows || []);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('GET error:', msg);
    return json({ error: msg }, 500);
  }
}

async function save(request: Request, edit: boolean) {
  try {
    if (!env?.DB) {
      return json({ error: "Falta vincular la base de datos D1 como 'DB' en Settings > Bindings de Cloudflare." }, 500);
    }
    await ensureSchema();
    const m = await request.json() as Movement;
    if (!validate(m)) return json({ error: 'Revisá el monto, la fecha y los datos del movimiento.' }, 400);
    const data = {
      type: m.type,
      amount: m.amount,
      date: m.date,
      description: m.description.trim(),
      category: m.category,
      payment: m.payment
    };
    if (edit) {
      if (typeof m.id !== 'string') return json({ error: 'Movimiento inválido.' }, 400);
      const rows = await getDb().update(movements).set(data).where(eq(movements.id, m.id)).returning();
      if (!rows.length) return json({ error: 'El movimiento ya no existe.' }, 404);
      return json(rows[0]);
    }
    const record = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    await getDb().insert(movements).values(record);
    return json(record, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Save error:', msg);
    return json({ error: msg }, 500);
  }
}

export async function POST(request: Request) {
  return save(request, false);
}

export async function PUT(request: Request) {
  return save(request, true);
}

export async function DELETE(request: Request) {
  try {
    if (!env?.DB) {
      return json({ error: "Falta vincular la base de datos D1 como 'DB' en Settings > Bindings de Cloudflare." }, 500);
    }
    await ensureSchema();
    const { id } = await request.json() as { id: unknown };
    if (typeof id !== 'string') return json({ error: 'Movimiento inválido.' }, 400);
    const result = await getDb().delete(movements).where(eq(movements.id, id)).returning();
    if (!result.length) return json({ error: 'El movimiento ya no existe.' }, 404);
    return json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Delete error:', msg);
    return json({ error: msg }, 500);
  }
}
