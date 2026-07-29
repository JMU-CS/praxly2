/**
 * Main application component that sets up routing for the Praxly interface.
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router';
import EditorPage from './pages/EditorPage';
import EmbedPage from './pages/EmbedPage';
import AccountPage from './pages/AccountPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/v2/editor" element={<EditorPage />} />
        <Route path="/v2/embed" element={<EmbedPage />} />
        <Route path="/v2/account" element={<AccountPage />} />
        <Route path="*" element={<Navigate to="/v2/editor" replace />} />
      </Routes>
    </Router>
  );
}
