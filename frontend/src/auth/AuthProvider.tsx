import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  token: string | null;
  setToken: (token: string | null) => void;
  clearToken: () => void;
}

const AuthContext = createContext<AuthContextType>({ 
  token: null, 
  setToken: () => {}, 
  clearToken: () => {} 
});

export const useAuth = () => useContext(AuthContext);

const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

  const setTokenAndStore = (t: string | null) => {
    setToken(t);
    if (t) localStorage.setItem('token', t);
    else localStorage.removeItem('token');
  };

  const clearToken = () => {
    setToken(null);
    localStorage.removeItem('token');
  };

  // Automatische Token-Validierung beim Start
  useEffect(() => {
    if (token) {
      fetch('/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => {
        if (!res.ok) {
          clearToken();
        }
      })
      .catch(() => {
        clearToken();
      });
    }
  }, [token]);

  // Inaktivitäts-Logout nach 5 Minuten
  useEffect(() => {
    if (!token) return;
    let timer: number;
    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        clearToken();
      }, 5 * 60 * 1000); // 5 Minuten
    };
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    resetTimer();
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
    };
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, setToken: setTokenAndStore, clearToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
