import React from "react";
import PanelPage from "./pages/PanelPage";
import ControlsPage from "./pages/ControlsPage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import ChangeCredentialsPage from "./pages/ChangeCredentialsPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import AuthProvider, { useAuth } from "./auth/AuthProvider";
import PanelServers from "./pages/PanelServers";
import ServerStats from "./pages/ServerStats";
import ServerSettingsPage from "./pages/ServerSettingsPage";
import PluginsPage from "./pages/PluginsPage";
import ServerControlsPage from "./pages/ServerControlsPage";
import ChooseServerPage from "./pages/ChooseServerPage";
import ServerConsolePage from "./pages/ServerConsolePage";
import SettingsPage from "./pages/SettingsPage";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import WorldSettingsPage from "./pages/WorldSettingsPage";
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { getTheme } from './theme';

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [isValidating, setIsValidating] = React.useState(true);
  const [isValid, setIsValid] = React.useState(false);
  
  React.useEffect(() => {
    if (!token) {
      setIsValidating(false);
      return;
    }
    
    // Validate token by calling /me endpoint
    fetch('/api/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
      setIsValid(res.ok);
      setIsValidating(false);
    })
    .catch(() => {
      setIsValid(false);
      setIsValidating(false);
    });
  }, [token]);
  
  if (isValidating) {
    return <div>Loading...</div>;
  }
  
  return (token && isValid) ? <>{children}</> : <Navigate to="/login" replace />;
};

function App() {
  return (
    <ThemeProvider theme={getTheme('dark')}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/change-credentials" element={<RequireAuth><ChangeCredentialsPage /></RequireAuth>} />
            <Route path="/panel" element={<RequireAuth><PanelPage /></RequireAuth>} />
            <Route path="/servers" element={<RequireAuth><PanelServers /></RequireAuth>} />
            <Route path="/plugins" element={<RequireAuth><PluginsPage /></RequireAuth>} />
            <Route path="/plugins/choose-server" element={<RequireAuth><ChooseServerPage /></RequireAuth>} />
            <Route path="/servers/stats/:serverName" element={<RequireAuth><ServerStats /></RequireAuth>} />
            <Route path="/servers/:servername/settings" element={<RequireAuth><ServerSettingsPage /></RequireAuth>} />
            <Route path="/servers/:servername/controls" element={<RequireAuth><ServerControlsPage /></RequireAuth>} />
            <Route path="/servers/:servername/console" element={<RequireAuth><ServerConsolePage /></RequireAuth>} />
            <Route path="/servers/:servername/world-settings" element={<RequireAuth><WorldSettingsPage /></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
            <Route path="/controls" element={<RequireAuth><ControlsPage /></RequireAuth>} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            {/* Catch-all: Weiterleitung zu /login falls nicht gefunden */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;