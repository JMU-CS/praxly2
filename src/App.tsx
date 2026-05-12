/**
 * Main application component that sets up routing for the Praxly interface.
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import EditorPage from './pages/EditorPage';
import EmbedPage from './pages/EmbedPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/v2/editor" element={<EditorPage />} />
        <Route path="/v2/embed" element={<EmbedPage />} />
        <Route path="*" element={<Navigate to="/v2/editor" replace />} />
      </Routes>
    </Router>
  );
}
