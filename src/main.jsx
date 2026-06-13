import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.jsx';
import GmbKeywordGalleryPage from './pages/GmbKeywordGalleryPage.jsx';
import './index.css';

// Public share links only: /gmb-keyword-gallery/:id (matches tracking JSON galleryUrl paths).
// All other routes go through App, which enforces login after session is established.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/gmb-keyword-gallery/:id" element={<GmbKeywordGalleryPage />} />
        <Route path="/*" element={<App />} />
      </Routes>
      <Toaster position="top-center" />
    </BrowserRouter>
  </React.StrictMode>
);
