import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import PopupApp from './pages/popup/PopupApp';

const root = ReactDOM.createRoot(document.getElementById('popup-root'));
root.render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>
);