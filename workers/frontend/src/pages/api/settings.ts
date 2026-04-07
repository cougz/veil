import type { APIRoute } from 'astro';
import { isAuthorized, unauthorized, json } from '../../lib/api';

const VALID_KEYS = ['forward_to', 'reject_message'];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export const GET: APIRoute = async ({ locals, request }) => {
  if (!(await isAuthorized(request, locals.runtime.env))) return unauthorized();

  try {
    const db = locals.runtime.env.DB;
    
    const { results } = await db
      .prepare(`SELECT key, value FROM settings WHERE key IN (${VALID_KEYS.map(() => '?').join(', ')})`)
      .bind(...VALID_KEYS)
      .all();

    const settings: Record<string, string | null> = {};
    for (const key of VALID_KEYS) {
      settings[key] = null;
    }

    for (const row of results as { key: string; value: string }) {
      settings[row.key] = row.value;
    }
    
    return json(settings);
  } catch (error) {
    console.error('[Settings API] GET error:', error);
    return json({ error: 'Failed to fetch settings' }, 500);
  }
};

export const PUT: APIRoute = async ({ locals, request }) => {
  if (!(await isAuthorized(request, locals.runtime.env))) return unauthorized();

  try {
    const body = await request.json();
    const db = locals.runtime.env.DB;
    const bodyAny = body as any;

    const updates: { key: string; value: string }[] = [];

    for (const key of VALID_KEYS) {
      if (typeof bodyAny[key] === 'string') {
        const value = bodyAny[key].trim();
        
        if (key === 'forward_to' && value !== '' && !isValidEmail(value)) {
          return json({ error: 'Invalid email address format' }, 400);
        }
        
        updates.push({ key, value });
      }
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
  } catch (error) {
    console.error('[Settings API] Error:', error);
    return json({ error: 'Internal server error' }, 500);
  }
};
