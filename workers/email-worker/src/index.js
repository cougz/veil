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
    console.log('Email worker started', { to: message.to, from: message.from });
    
    const forwardTo = env.FORWARD_TO;
    console.log('FORWARD_TO:', forwardTo ? 'set' : 'NOT SET');
    
    if (!forwardTo) {
      console.error('FORWARD_TO not set');
      message.setReject('FORWARD_TO not set');
      return;
    }

    console.log('Attempting forward to:', forwardTo);
    await message.forward(forwardTo);
    console.log('Forward complete');
  }
};
