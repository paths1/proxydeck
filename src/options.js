import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import OptionsApp from './pages/options/OptionsApp';

const root = ReactDOM.createRoot(document.getElementById('options-root'));
root.render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>
);