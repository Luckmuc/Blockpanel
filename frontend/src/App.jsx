import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE = 'http://localhost:8000';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [servers, setServers] = useState([]);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetUsername, setResetUsername] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  // Set up axios defaults
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Load servers on login
  useEffect(() => {
    if (token) {
      loadServers();
    }
  }, [token]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    
    try {
      const response = await axios.post(`${API_BASE}/login`, 
        new URLSearchParams({
          username,
          password
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
      
      const { access_token } = response.data;
      setToken(access_token);
      localStorage.setItem('token', access_token);
      setUsername('');
      setPassword('');
    } catch (error) {
      setLoginError(error.response?.data?.detail || 'Login failed');
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('token');
    setServers([]);
  };

  const loadServers = async () => {
    try {
      const response = await axios.get(`${API_BASE}/server/list`);
      setServers(response.data.servers || []);
    } catch (error) {
      console.error('Failed to load servers:', error);
    }
  };

  const acceptEula = async (serverName) => {
    try {
      const response = await axios.post(`${API_BASE}/server/accept_eula`,
        new URLSearchParams({
          servername: serverName
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
      alert(response.data.message);
      loadServers(); // Refresh server list
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to accept EULA');
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setResetMessage('');

    if (!securityQuestion) {
      // First step: get security question
      try {
        const response = await axios.post(`${API_BASE}/get_security_question`, {
          username: resetUsername
        });
        setSecurityQuestion(response.data.security_question);
      } catch (error) {
        setResetMessage(error.response?.data?.detail || 'Failed to get security question');
      }
    } else {
      // Second step: reset password
      try {
        const response = await axios.post(`${API_BASE}/reset_password`,
          new URLSearchParams({
            username: resetUsername,
            security_answer: securityAnswer,
            new_password: newPassword
          }),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        );
        setResetMessage(response.data.message);
        setShowPasswordReset(false);
        setResetUsername('');
        setSecurityQuestion('');
        setSecurityAnswer('');
        setNewPassword('');
      } catch (error) {
        setResetMessage(error.response?.data?.detail || 'Password reset failed');
      }
    }
  };

  if (!token) {
    return (
      <div className="app">
        <div className="container">
          <h1>Blockpanel Login</h1>
          
          {!showPasswordReset ? (
            <form onSubmit={handleLogin} className="form">
              <div className="form-group">
                <label>Username:</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Password:</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {loginError && <div className="error">{loginError}</div>}
              <button type="submit" className="btn">Login</button>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => setShowPasswordReset(true)}
              >
                Forgot Password?
              </button>
            </form>
          ) : (
            <form onSubmit={handlePasswordReset} className="form">
              <h2>Password Reset</h2>
              <div className="form-group">
                <label>Username:</label>
                <input
                  type="text"
                  value={resetUsername}
                  onChange={(e) => setResetUsername(e.target.value)}
                  required
                />
              </div>
              
              {securityQuestion && (
                <>
                  <div className="form-group">
                    <label>Security Question:</label>
                    <p>{securityQuestion}</p>
                  </div>
                  <div className="form-group">
                    <label>Answer:</label>
                    <input
                      type="text"
                      value={securityAnswer}
                      onChange={(e) => setSecurityAnswer(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>New Password:</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}
              
              {resetMessage && <div className="message">{resetMessage}</div>}
              
              <button type="submit" className="btn">
                {securityQuestion ? 'Reset Password' : 'Get Security Question'}
              </button>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => {
                  setShowPasswordReset(false);
                  setResetUsername('');
                  setSecurityQuestion('');
                  setSecurityAnswer('');
                  setNewPassword('');
                  setResetMessage('');
                }}
              >
                Back to Login
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="container">
        <div className="header">
          <h1>Blockpanel</h1>
          <button onClick={handleLogout} className="btn btn-secondary">Logout</button>
        </div>
        
        <div className="server-section">
          <h2>Servers</h2>
          <button onClick={loadServers} className="btn">Refresh</button>
          
          {servers.length === 0 ? (
            <p>No servers found.</p>
          ) : (
            <div className="server-list">
              {servers.map((server) => (
                <div key={server.name} className="server-item">
                  <h3>{server.name}</h3>
                  <p>Status: <span className={`status ${server.status}`}>{server.status}</span></p>
                  <p>Address: {server.address}</p>
                  <div className="server-actions">
                    <button 
                      onClick={() => acceptEula(server.name)} 
                      className="btn"
                    >
                      Accept EULA & Start
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;