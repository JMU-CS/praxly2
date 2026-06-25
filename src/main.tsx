import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import keycloak from './auth/keycloak';

// Restore saved tokens so users stay logged in across page refreshes.
const savedToken = localStorage.getItem('kc_token') ?? undefined;
const savedRefreshToken = localStorage.getItem('kc_refresh_token') ?? undefined;

// Keep tokens fresh in localStorage whenever Keycloak refreshes them.
keycloak.onTokenExpired = () => {
  keycloak
    .updateToken(30)
    .then(() => {
      localStorage.setItem('kc_token', keycloak.token!);
      localStorage.setItem('kc_refresh_token', keycloak.refreshToken!);
    })
    .catch(() => {
      localStorage.removeItem('kc_token');
      localStorage.removeItem('kc_refresh_token');
    });
};

keycloak
  .init({ checkLoginIframe: false, token: savedToken, refreshToken: savedRefreshToken })
  .then((authenticated) => {
    if (authenticated) {
      localStorage.setItem('kc_token', keycloak.token!);
      localStorage.setItem('kc_refresh_token', keycloak.refreshToken!);
    }
  })
  .catch(() => {})
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  });
