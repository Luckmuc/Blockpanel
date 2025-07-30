import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Alert, Paper, CircularProgress } from '@mui/material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const ForgotPasswordPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleGetQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post('/get_security_question', { username });
      setSecurityQuestion(res.data.security_question);
      setStep(2);
    } catch (err: any) {
      setError('Username not found or no security question set.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await axios.post(
        '/reset_password',
        new URLSearchParams({ username, security_answer: securityAnswer, new_password: newPassword }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      setSuccess('Password reset successfully!');
      setTimeout(() => navigate('/'), 2000);
    } catch (err: any) {
      setError('Incorrect answer or invalid password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f2027 0%, #2c5364 100%)' }}>
      <Paper elevation={10} sx={{ p: 6, borderRadius: 4, background: 'rgba(30,40,60,0.92)', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)', textAlign: 'center', maxWidth: 480, width: '100%' }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: '#fff' }}>
          Forgot Password
        </Typography>
        {step === 1 && (
          <form onSubmit={handleGetQuestion}>
            <TextField label="Username" fullWidth margin="normal" value={username} onChange={e => setUsername(e.target.value)} InputProps={{ sx: { color: '#fff' } }} InputLabelProps={{ sx: { color: '#b0c4de' } }} />
            <Button type="submit" variant="contained" fullWidth sx={{ mt: 2, py: 1.5, fontSize: 18, borderRadius: 2 }} disabled={loading}>
              {loading ? <CircularProgress size={24} /> : 'Show security question'}
            </Button>
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </form>
        )}
        {step === 2 && (
          <form onSubmit={handleResetPassword}>
            <Typography sx={{ color: '#b0c4de', mb: 2 }}>{securityQuestion}</Typography>
            <TextField label="Answer" fullWidth margin="normal" value={securityAnswer} onChange={e => setSecurityAnswer(e.target.value)} InputProps={{ sx: { color: '#fff' } }} InputLabelProps={{ sx: { color: '#b0c4de' } }} />
            <TextField label="New password" type="password" fullWidth margin="normal" value={newPassword} onChange={e => setNewPassword(e.target.value)} InputProps={{ sx: { color: '#fff' } }} InputLabelProps={{ sx: { color: '#b0c4de' } }} />
            <Button type="submit" variant="contained" fullWidth sx={{ mt: 2, py: 1.5, fontSize: 18, borderRadius: 2 }} disabled={loading}>
              {loading ? <CircularProgress size={24} /> : 'Reset password'}
            </Button>
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}
          </form>
        )}
      </Paper>
    </Box>
  );
};

export default ForgotPasswordPage;
