import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Switch,
  Button,
  Alert,
  Card,
  CardContent,
  Chip
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  Settings as SettingsIcon,
  NetworkWifi as NetworkWifiIcon,
  Security as SecurityIcon,
  Computer as ComputerIcon,
  Public as PublicIcon,
  Home as HomeIcon
} from '@mui/icons-material';

interface NetworkConfig {
  mode: 'localhost' | 'internal' | 'public';
  bind_address: string;
  port: number;
  cors_origins: string[];
}

interface AutostartConfig {
  enabled: boolean;
  startup_type: 'user' | 'system';
}

interface ConfigResponse {
  network: NetworkConfig;
  autostart: AutostartConfig;
}

const SettingsPage: React.FC = () => {
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [networkMode, setNetworkMode] = useState<string>('localhost');
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [startupType, setStartupType] = useState<string>('user');

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        setNetworkMode(data.network.mode);
        setAutostartEnabled(data.autostart.enabled);
        setStartupType(data.autostart.startup_type);
      } else {
        throw new Error('Failed to fetch configuration');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load configuration' });
    } finally {
      setLoading(false);
    }
  };

  const saveNetworkConfig = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('mode', networkMode);
      formData.append('port', '8000');

      const response = await fetch('/api/config/network', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Network configuration updated successfully! Restart required for changes to take effect.' });
        fetchConfig();
      } else {
        throw new Error('Failed to update network configuration');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update network configuration' });
    } finally {
      setSaving(false);
    }
  };

  const saveAutostartConfig = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('enabled', autostartEnabled.toString());
      formData.append('startup_type', startupType);

      const response = await fetch('/api/config/autostart', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Autostart configuration updated successfully!' });
        fetchConfig();
      } else {
        throw new Error('Failed to update autostart configuration');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update autostart configuration' });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const getNetworkDescription = (mode: string) => {
    switch (mode) {
      case 'localhost':
        return 'Only accessible from this computer (127.0.0.1) - Most secure';
      case 'internal':
        return 'Accessible from local network (192.168.x.x) - Requires network access';
      case 'public':
        return 'Accessible from internet - Requires port forwarding setup';
      default:
        return '';
    }
  };

  const getNetworkIcon = (mode: string) => {
    switch (mode) {
      case 'localhost':
        return <HomeIcon />;
      case 'internal':
        return <NetworkWifiIcon />;
      case 'public':
        return <PublicIcon />;
      default:
        return <NetworkWifiIcon />;
    }
  };

  const getSecurityLevel = (mode: string) => {
    switch (mode) {
      case 'localhost':
        return { level: 'High', color: 'success' as const };
      case 'internal':
        return { level: 'Medium', color: 'warning' as const };
      case 'public':
        return { level: 'Low', color: 'error' as const };
      default:
        return { level: 'Unknown', color: 'default' as const };
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading configuration...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <SettingsIcon sx={{ mr: 2, fontSize: 32 }} />
        <Typography variant="h4" component="h1">
          Blockpanel Settings
        </Typography>
      </Box>

      {message && (
        <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Network Configuration */}
        <Box sx={{ gridColumn: { xs: 'span 12', md: 'span 6' } }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <NetworkWifiIcon sx={{ mr: 1 }} />
                <Typography variant="h6">Network Configuration</Typography>
              </Box>
              
              <FormControl component="fieldset" sx={{ width: '100%' }}>
                <FormLabel component="legend">Access Mode</FormLabel>
                <RadioGroup
                  value={networkMode}
                  onChange={(e) => setNetworkMode(e.target.value)}
                >
                  {['localhost', 'internal', 'public'].map((mode) => {
                    const security = getSecurityLevel(mode);
                    return (
                      <Paper
                        key={mode}
                        variant="outlined"
                        sx={{
                          p: 2,
                          mb: 1,
                          border: networkMode === mode ? 2 : 1,
                          borderColor: networkMode === mode ? 'primary.main' : 'divider'
                        }}
                      >
                        <FormControlLabel
                          value={mode}
                          control={<Radio />}
                          label={
                            <Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                {getNetworkIcon(mode)}
                                <Typography variant="subtitle1" sx={{ ml: 1, textTransform: 'capitalize' }}>
                                  {mode === 'localhost' ? 'Localhost Only' : 
                                   mode === 'internal' ? 'Internal Network' : 'Public Access'}
                                </Typography>
                                <Chip
                                  size="small"
                                  label={`${security.level} Security`}
                                  color={security.color}
                                  sx={{ ml: 'auto' }}
                                />
                              </Box>
                              <Typography variant="body2" color="text.secondary">
                                {getNetworkDescription(mode)}
                              </Typography>
                            </Box>
                          }
                          sx={{ alignItems: 'flex-start', m: 0 }}
                        />
                      </Paper>
                    );
                  })}
                </RadioGroup>
              </FormControl>

              <Box sx={{ mt: 3 }}>
                <Button
                  variant="contained"
                  onClick={saveNetworkConfig}
                  disabled={saving || networkMode === config?.network.mode}
                  startIcon={<SecurityIcon />}
                >
                  {saving ? 'Saving...' : 'Save Network Settings'}
                </Button>
              </Box>

              {config && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>Current Configuration:</Typography>
                  <Typography variant="body2">Mode: {config.network.mode}</Typography>
                  <Typography variant="body2">Bind Address: {config.network.bind_address}</Typography>
                  <Typography variant="body2">Port: {config.network.port}</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
  </Box>

        {/* Autostart Configuration */}
        <Box sx={{ gridColumn: { xs: 'span 12', md: 'span 6' } }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <ComputerIcon sx={{ mr: 1 }} />
                <Typography variant="h6">Startup Configuration</Typography>
              </Box>

              <FormControl component="fieldset" sx={{ width: '100%' }}>
                <Box sx={{ mb: 3 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={autostartEnabled}
                        onChange={(e) => setAutostartEnabled(e.target.checked)}
                      />
                    }
                    label="Start Blockpanel with Windows"
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Automatically start Blockpanel when Windows boots
                  </Typography>
                </Box>

                {autostartEnabled && (
                  <Box>
                    <FormLabel component="legend">Startup Type</FormLabel>
                    <RadioGroup
                      value={startupType}
                      onChange={(e) => setStartupType(e.target.value)}
                    >
                      <FormControlLabel
                        value="user"
                        control={<Radio />}
                        label={
                          <Box>
                            <Typography variant="subtitle2">Current User Only</Typography>
                            <Typography variant="body2" color="text.secondary">
                              Start only when the current user logs in
                            </Typography>
                          </Box>
                        }
                      />
                      <FormControlLabel
                        value="system"
                        control={<Radio />}
                        label={
                          <Box>
                            <Typography variant="subtitle2">All Users (Admin Required)</Typography>
                            <Typography variant="body2" color="text.secondary">
                              Start for all users - requires administrator privileges
                            </Typography>
                          </Box>
                        }
                      />
                    </RadioGroup>
                  </Box>
                )}
              </FormControl>

              <Box sx={{ mt: 3 }}>
                <Button
                  variant="contained"
                  onClick={saveAutostartConfig}
                  disabled={
                    saving ||
                    (autostartEnabled === config?.autostart.enabled &&
                     startupType === config?.autostart.startup_type)
                  }
                  startIcon={<ComputerIcon />}
                >
                  {saving ? 'Saving...' : 'Save Startup Settings'}
                </Button>
              </Box>

              {config && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>Current Configuration:</Typography>
                  <Typography variant="body2">
                    Autostart: {config.autostart.enabled ? 'Enabled' : 'Disabled'}
                  </Typography>
                  {config.autostart.enabled && (
                    <Typography variant="body2">
                      Type: {config.autostart.startup_type}
                    </Typography>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
  </Box>
      </Grid>

      {/* Information Box */}
      <Box sx={{ mt: 3 }}>
        <Alert severity="info">
          <Typography variant="h6" gutterBottom>Important Notes:</Typography>
          <Typography variant="body2" component="div">
            • Network changes require a restart to take effect<br />
            • Public access requires port forwarding configuration on your router<br />
            • For public access, forward port 8000 (web interface) and ports 25565-25575 (Minecraft servers)<br />
            • Autostart settings take effect immediately
          </Typography>
        </Alert>
      </Box>
    </Box>
  );
};

export default SettingsPage;
