import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initAuth } from './api/auth';

// Restores a saved session (Keycloak tokens, or a Google session token) and
// picks up the redirect back from Google before the first render.
initAuth().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
