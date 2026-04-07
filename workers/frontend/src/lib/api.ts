import { isAuthenticated } from './auth';
import { json } from './json';

export async function isAuthorized(request: Request, env: { API_TOKEN: string }): Promise<boolean> {
  return isAuthenticated(request, env);
}

export function unauthorized(): Response {
  return json({ error: 'Unauthorized' }, 401);
}

export { json };
