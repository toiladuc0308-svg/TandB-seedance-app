import React from 'react';
import ReactDOM from 'react-dom/client';
import './mockBridge.js';

window.React = React;
window.ReactDOM = ReactDOM;

// Dynamic import ensures window.React & window.ReactDOM are set before app.jsx and its components evaluate
import('./app.jsx').catch((err) => {
  console.error('[App load error]', err);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `<div style="padding: 20px; color: #ef4444; font-family: monospace;">
      <h2>Lỗi khởi chạy:</h2>
      <pre>${err?.stack || err?.message || err}</pre>
    </div>`;
  }
});
