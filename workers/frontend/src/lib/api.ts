import { isAuthenticated } from './auth';
import { json } from './json';

export function isAuthorized(request: Request, env: { API_TOKEN: string }): boolean {
  return isAuthenticated(request, env);
}

export function unauthorized(): Response {
  return json({ error: 'Unauthorized' }, 401);
}

export { json };
