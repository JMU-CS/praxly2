import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import keycloak from './auth/keycloak';

// Silently check if already logged in but don't redirect — auth is only
// required when the user opens the AI panel.
keycloak
  .init({
    onLoad: 'check-sso',
    silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
  })
  .catch(() => {
    // If SSO check fails, continue without auth — panel will prompt to log in.
  })
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  });
