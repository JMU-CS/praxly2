/**
 * Where k12-llm-backend lives.
 *
 * Its own module so that config.ts (which imports auth.ts for getToken) and
 * auth.ts can both read it without importing each other in a cycle.
 *
 * Optional — the fallback is the shared dev server, and production builds pin
 * the value in .env.production. Inlined at build time, so changing it means
 * rebuilding, not restarting.
 */

const env = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ??
  {}) as Record<string, string | undefined>;

export const BACKEND_URL = env.VITE_BACKEND_URL ?? 'https://k12api.torta-server.duckdns.org';
