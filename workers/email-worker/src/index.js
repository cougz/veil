export default {
  async email(message, env, ctx) {
    const alias = message.to.toLowerCase().trim();
    const now = Date.now();
    const mode = (env.MODE ?? 'catchall').toLowerCase();
    const forwardTo = env.FORWARD_TO;
    const rejectMessage = env.REJECT_MESSAGE ?? 'This address is no longer active';

    const row = await env.DB
      .prepare('SELECT status FROM aliases WHERE address = ?')
      .bind(alias)
      .first();

    if (row?.status === 'blocked') {
      message.setReject(rejectMessage);
      return;
    }

    if (!row) {
      if (mode === 'specific') {
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
    } else {
      await env.DB
        .prepare(`
          UPDATE aliases
          SET last_seen = ?, mail_count = mail_count + 1
          WHERE address = ?
        `)
        .bind(now, alias)
        .run();
    }

    await message.forward(forwardTo);
  }
};
