interface Env {
  DB: D1Database;
  RATE_LIMITER: RateLimit;
  FORWARD_TO?: string;
  REJECT_MESSAGE?: string;
}
