// API configuration for Windows desktop app
const isDev = window.location.hostname === 'localhost' && window.location.port === '5173';

export const API_BASE = isDev 
  ? "http://localhost:8000"  // Development: direct backend connection
  : "/api";                  // Production: proxied through Electron app

// Additional configuration for desktop app
export const APP_CONFIG = {
  isDesktopApp: true,
  backendPort: 8000,
  frontendPort: 3000
};
