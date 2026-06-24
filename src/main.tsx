import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import keycloak from './auth/keycloak';

// Initialise Keycloak without redirecting — auth is only required when the
// user opens the AI panel. The panel shows a Sign in button if not logged in.
keycloak
  .init({ checkLoginIframe: false })
  .catch(() => {})
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  });
