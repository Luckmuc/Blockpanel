import React, { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { Box, Typography, Slide, Paper } from "@mui/material";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';

export type NotificationType = 'success' | 'error' | 'waiting';

interface Notification {
  type: NotificationType;
  message: string;
  id: number;
}

interface NotificationContextType {
  notify: (n: { type: NotificationType; message: string }) => void;
}

const NotificationContext = createContext<NotificationContextType>({ notify: () => {} });

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const notify = useCallback(({ type, message }: { type: NotificationType; message: string }) => {
    const id = Date.now() + Math.random();
    setNotifications((prev) => [...prev, { type, message, id }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 10000);
  }, []);

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      <Box sx={{ position: 'fixed', top: 32, right: 32, zIndex: 2000 }}>
        {notifications.map((n) => (
          <Slide key={n.id} direction="left" in mountOnEnter unmountOnExit>
            <Paper
              elevation={8}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                mb: 2,
                px: 3,
                py: 2,
                minWidth: 320,
                borderRadius: 3,
              background:
                n.type === 'success'
                  ? 'linear-gradient(90deg, #232b3a 0%, #3a445a 100%)'
                  : n.type === 'error'
                  ? 'linear-gradient(90deg, #3a2323 0%, #5a3a3a 100%)'
                  : 'linear-gradient(90deg, #232b3a 0%, #3a445a 100%)',
              color: '#fff',
                boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.25)',
                fontWeight: 600,
                fontSize: 18,
                transition: 'all 0.5s',
              }}
            >
              {n.type === 'success' && <CheckCircleIcon sx={{ color: '#1b5e20', fontSize: 32 }} />}
              {n.type === 'error' && <ErrorIcon sx={{ color: '#b71c1c', fontSize: 32 }} />}
              {n.type === 'waiting' && <HourglassEmptyIcon sx={{ color: '#fff', fontSize: 32 }} />}
              <Typography sx={{ fontWeight: 600, fontSize: 18 }}>{n.message}</Typography>
            </Paper>
          </Slide>
        ))}
      </Box>
    </NotificationContext.Provider>
  );
};
