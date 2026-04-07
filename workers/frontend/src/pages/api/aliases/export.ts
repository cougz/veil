import type { APIRoute } from 'astro';
import { isAuthorized, unauthorized } from '../../../lib/api';

export const GET: APIRoute = async ({ locals, request }) => {
  if (!(await isAuthorized(request, locals.runtime.env))) return unauthorized();

  const db = locals.runtime.env.DB;
  const { results } = await db
    .prepare('SELECT * FROM aliases ORDER BY last_seen DESC')
    .all();

  const headers = ['address', 'status', 'first_seen', 'last_seen', 'mail_count', 'expires_at'];
  const rows = results.map((row: any) => 
    headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(',')
  );

  const csv = [headers.join(','), ...rows].join('\n');
  
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="aliases.csv"'
    }
  });
};
