const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 100;

function isRateLimited(key) {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  
  if (!entry) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return false;
  }
  
  if (now - entry.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return false;
  }
  
  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }
  
  entry.count++;
  return false;
}

export default {
  async email(message, env, ctx) {
    try {
      const alias = message.to.toLowerCase().trim();
      const now = Date.now();
      const mode = (env.MODE ?? 'catchall').toLowerCase();
      const forwardTo = env.FORWARD_TO;
      const rejectMessage = env.REJECT_MESSAGE ?? 'This address is no longer active';

      if (!forwardTo) {
        console.error('FORWARD_TO not set', { alias, from: message.from });
        message.setReject('Server misconfiguration: FORWARD_TO not set');
        return;
      }

      if (!env.DB) {
        console.error('DB not bound', { alias, from: message.from });
        message.setReject('Server misconfiguration: database not bound');
        return;
      }

      const rateLimitKey = message.from ?? 'unknown';
      if (isRateLimited(rateLimitKey)) {
        console.warn('Rate limited', { alias, from: message.from });
        message.setReject('Rate limit exceeded');
        return;
      }

      const row = await env.DB
        .prepare('SELECT status, expires_at FROM aliases WHERE address = ?')
        .bind(alias)
        .first();

      if (row?.status === 'blocked') {
        console.info('Blocked', { alias, from: message.from });
        message.setReject(rejectMessage);
        return;
      }

      if (row?.expires_at && row.expires_at < now) {
        console.info('Expired', { alias, from: message.from, expiredAt: row.expires_at });
        message.setReject(rejectMessage);
        return;
      }

      if (!row) {
        if (mode === 'specific') {
          console.info('Rejected (specific mode)', { alias, from: message.from });
          message.setReject(rejectMessage);
          return;
        }
        await env.DB
          .prepare(`
            INSERT INTO aliases (address, status, first_seen, last_seen, mail_count)
            VALUES (?, 'active', ?, ?, 1)
          `)
          .bind(alias, now, now)
          .run();
        console.info('Created alias', { alias, from: message.from });
      } else {
        await env.DB
          .prepare(`
            UPDATE aliases
            SET last_seen = ?, mail_count = mail_count + 1
            WHERE address = ?
          `)
          .bind(now, alias)
          .run();
        console.info('Updated alias', { alias, from: message.from });
      }

      await message.forward(forwardTo);
      console.info('Forwarded', { alias, from: message.from, to: forwardTo });
    } catch (error) {
      console.error('Error', { error: error.message, stack: error.stack });
      message.setReject('Internal server error');
    }
  }
};
