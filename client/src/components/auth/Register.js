import React, { useState, useEffect } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { registerUser, clearError } from '../../redux/slices/authSlice';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Link,
  Paper,
  Alert,
  CircularProgress
} from '@mui/material';
import { useTranslation } from '../../translations/TranslationContext';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    password2: ''
  });
  
  const { name, email, password, password2 } = formData;
  
  const [passwordError, setPasswordError] = useState('');
  
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const translate = useTranslation();
  
  const { isAuthenticated, loading, error } = useSelector((state) => state.auth);
  
  // Redirect if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
    
    return () => {
      // Clear any errors when component unmounts
      dispatch(clearError());
    };
  }, [isAuthenticated, navigate, dispatch]);
  
  // Update form data on input change
  const onChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    
    // Clear password error when typing
    if (e.target.name === 'password' || e.target.name === 'password2') {
      setPasswordError('');
    }
  };
  
  // Submit form
  const onSubmit = (e) => {
    e.preventDefault();
    
    // Check if passwords match
    if (password !== password2) {
      setPasswordError(translate('Passwords do not match'));
      return;
    }
    
    dispatch(registerUser({ name, email, password }));
  };
  
  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          py: 4
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            borderRadius: 2
          }}
        >
          <Typography component="h1" variant="h4" color="primary" fontWeight="bold" gutterBottom>
            FeedRank
          </Typography>
          <Typography component="h2" variant="h5" gutterBottom>
            {translate('Create Account')}
          </Typography>
          
          {error && <Alert severity="error" sx={{ mb: 2, width: '100%' }}>{error}</Alert>}
          
          <Box component="form" onSubmit={onSubmit} sx={{ mt: 1, width: '100%' }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="name"
              label={translate('Name')}
              name="name"
              autoComplete="name"
              autoFocus
              value={name}
              onChange={onChange}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label={translate('Email Address')}
              name="email"
              autoComplete="email"
              value={email}
              onChange={onChange}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label={translate('Password')}
              type="password"
              id="password"
              autoComplete="new-password"
              value={password}
              onChange={onChange}
              error={!!passwordError}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password2"
              label={translate('Confirm Password')}
              type="password"
              id="password2"
              autoComplete="new-password"
              value={password2}
              onChange={onChange}
              error={!!passwordError}
              helperText={passwordError}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2, py: 1.5 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : translate('Register')}
            </Button>
            <Box sx={{ textAlign: 'center' }}>
              <Link component={RouterLink} to="/login" variant="body2">
                {translate('Already have an account?')} {translate('Sign in')}
              </Link>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default Register; 