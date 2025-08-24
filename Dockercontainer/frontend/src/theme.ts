import { createTheme } from '@mui/material/styles';

export const getTheme = (mode: 'light' | 'dark') => createTheme({
  palette: {
    mode,
    primary: {
      main: '#1976d2', // Blau
    },
    background: {
      default: mode === 'light' ? '#fff' : '#181c24',
      paper: mode === 'light' ? '#fff' : '#232936',
    },
    secondary: {
      main: '#1565c0', // dunkleres Blau
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
  },
});
