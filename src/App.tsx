import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import EditorPage from './pages/EditorPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/v2/" element={<LandingPage />} />
        <Route path="/v2/editor" element={<EditorPage />} />
      </Routes>
    </Router>
  );
}
