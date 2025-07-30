import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { NotificationProvider } from './components/NotificationProvider';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NotificationProvider>
      <App />
    </NotificationProvider>
  </React.StrictMode>,
)
