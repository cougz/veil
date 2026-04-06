import type { APIRoute } from 'astro';
import { isAuthorized, unauthorized, json } from '../../lib/api';

const VALID_KEYS = ['forward_to', 'reject_message'];

export const GET: APIRoute = async ({ locals, request }) => {
  if (!isAuthorized(request, locals.runtime.env)) return unauthorized();

  const db = locals.runtime.env.DB;
  const { results } = await db
    .prepare('SELECT key, value FROM settings WHERE key IN (?, ?)')
    .bind(...VALID_KEYS)
    .all();

  const settings: Record<string, string | null> = {
    forward_to: null,
    reject_message: null,
  };

  for (const row of results as { key: string; value: string }[]) {
    settings[row.key] = row.value;
  }

  return json(settings);
};

export const PUT: APIRoute = async ({ locals, request }) => {
  if (!isAuthorized(request, locals.runtime.env)) return unauthorized();

  const body = await request.json();
  const db = locals.runtime.env.DB;

  const updates: { key: string; value: string }[] = [];

  if (typeof (body as any)?.forward_to === 'string') {
    const value = (body as any).forward_to.trim();
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return json({ error: 'Invalid email address for forward_to' }, 400);
    }
    updates.push({ key: 'forward_to', value });
  }

  if (typeof (body as any)?.reject_message === 'string') {
    const value = (body as any).reject_message.trim();
    updates.push({ key: 'reject_message', value });
  }

  if (updates.length === 0) {
    return json({ error: 'No valid settings provided' }, 400);
  }

  for (const { key, value } of updates) {
    if (value === '') {
      await db.prepare('DELETE FROM settings WHERE key = ?').bind(key).run();
    } else {
      await db
        .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
        .bind(key, value)
        .run();
    }
  }

  return json({ success: true });
};
