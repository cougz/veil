const env = (import.meta as any).env;

export const APP_NAME: string        = env.APP_NAME        ?? 'Veil';
export const APP_DESCRIPTION: string = env.APP_DESCRIPTION ?? 'Wildcard email aliasing on Cloudflare Workers. Forward, filter, and burn addresses — without exposing your inbox.';
export const ACCENT_COLOR: string    = env.ACCENT_COLOR    ?? '#6d83f2';
export const DOMAIN: string          = env.DOMAIN          ?? 'yourdomain.com';
export const MODE: string            = env.MODE            ?? 'catchall';
export const API_TOKEN: string       = env.API_TOKEN       ?? '';
