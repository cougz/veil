import type { APIRoute } from 'astro';
import { isAuthorized, unauthorized, json } from '../../lib/api';

const VALID_KEYS = ['forward_to', 'reject_message'];

export const GET: APIRoute = async ({ locals, request }) => {
  if (!isAuthorized(request, locals.runtime.env)) return unauthorized();

  try {
    const db = locals.runtime.env.DB;
    
    console.log('[Settings API] GET request received');
    
    const { results } = await db
      .prepare('SELECT key, value FROM settings WHERE key IN (?, ?)')
      .bind(...VALID_KEYS)
      .all();

    console.log('[Settings API] Query results:', JSON.stringify(results));

    const settings: Record<string, string | null> = {
      forward_to: null,
      reject_message: null,
    };

    for (const row of results as { key: string; value: string }[]) {
      settings[row.key] = row.value;
    }

    console.log('[Settings API] Returning settings:', JSON.stringify(settings));
    
    return json(settings);
  } catch (error) {
    console.error('[Settings API] GET error:', error);
    return json({ error: 'Failed to fetch settings' }, 500);
  }
};

export const PUT: APIRoute = async ({ locals, request }) => {
  if (!isAuthorized(request, locals.runtime.env)) return unauthorized();

  try {
    const body = await request.json();
    const db = locals.runtime.env.DB;

    console.log('[Settings API] Received PUT request with body:', JSON.stringify(body));

    const updates: { key: string; value: string }[] = [];

    if (typeof (body as any)?.forward_to === 'string') {
      const value = (body as any).forward_to.trim();
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        console.log('[Settings API] Invalid email format:', value);
        return json({ error: 'Invalid email address for forward_to' }, 400);
      }
      updates.push({ key: 'forward_to', value });
    }

    if (typeof (body as any)?.reject_message === 'string') {
      const value = (body as any).reject_message.trim();
      updates.push({ key: 'reject_message', value });
    }

    if (updates.length === 0) {
      console.log('[Settings API] No valid settings provided');
      return json({ error: 'No valid settings provided' }, 400);
    }

    console.log('[Settings API] Processing updates:', JSON.stringify(updates));

    for (const { key, value } of updates) {
      console.log(`[Settings API] Updating ${key} = "${value}"`);
      
      if (value === '') {
        const result = await db.prepare('DELETE FROM settings WHERE key = ?').bind(key).run();
        console.log(`[Settings API] Deleted ${key}, result:`, result);
      } else {
        const result = await db
          .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
          .bind(key, value)
          .run();
        console.log(`[Settings API] Inserted ${key}, result:`, result);
      }
    }

    // Verify the save
    const { results } = await db
      .prepare('SELECT key, value FROM settings')
      .all();
    console.log('[Settings API] Current settings in DB:', JSON.stringify(results));

    return json({ success: true });
  } catch (error) {
    console.error('[Settings API] Error:', error);
    return json({ error: 'Internal server error' }, 500);
  }
};
