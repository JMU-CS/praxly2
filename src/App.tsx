/**
 * Main application component that sets up routing for the Praxly interface.
 * Handles navigation between landing page, editor page, and embedded editor page.
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import EditorPage from './pages/EditorPage';
import EmbedPage from './pages/EmbedPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/v2/" element={<LandingPage />} />
        <Route path="/v2/editor" element={<EditorPage />} />
        <Route path="/v2/embed" element={<EmbedPage />} />
      </Routes>
    </Router>
  );
}
