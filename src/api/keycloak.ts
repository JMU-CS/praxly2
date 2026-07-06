import Keycloak from 'keycloak-js';

const env = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ??
  {}) as Record<string, string | undefined>;

const keycloak = new Keycloak({
  url: env.VITE_KEYCLOAK_URL ?? 'https://auth.torta-server.duckdns.org',
  realm: 'education',
  clientId: 'praxly-client',
});

export default keycloak;
