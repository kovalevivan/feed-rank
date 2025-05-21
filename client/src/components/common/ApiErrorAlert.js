import React from 'react';
import { Alert, IconButton, Box, Typography, Paper, Link } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

/**
 * Component to display friendly error messages for API errors,
 * with special handling for VK API authentication errors
 */
const ApiErrorAlert = ({ error, onClose }) => {
  // Format and display error
  const displayError = () => {
    if (!error) return 'An unknown error occurred';
    
    if (typeof error === 'string') {
      return error;
    }
    
    if (error.message) {
      return error.message;
    }
    
    if (error.errors && Array.isArray(error.errors)) {
      return error.errors.map(err => err.msg || JSON.stringify(err)).join(', ');
    }
    
    return JSON.stringify(error);
  };
  
  // Show detailed error information if available
  const showDetailedError = () => {
    if (typeof error === 'object' && error !== null) {
      return (
        <Paper sx={{ p: 2, mt: 1, bgcolor: '#f8f8f8', maxHeight: '200px', overflow: 'auto' }}>
          <Typography variant="caption" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(error, null, 2)}
          </Typography>
        </Paper>
      );
    }
    return null;
  };
  
  // Check if this is a VK API authentication error
  const isVkAuthError = 
    error.message?.includes('VK API authentication failed') ||
    error.message?.includes('VK_ACCESS_TOKEN') ||
    error.error?.includes('VK_ACCESS_TOKEN') ||
    error.details?.includes('VK_ACCESS_TOKEN');
  
  if (isVkAuthError) {
    return (
      <Box sx={{ mb: 2 }}>
        <Alert 
          severity="error"
          action={
            onClose && (
              <IconButton
                aria-label="close"
                color="inherit"
                size="small"
                onClick={onClose}
              >
                <CloseIcon fontSize="inherit" />
              </IconButton>
            )
          }
        >
          <Typography variant="body2" gutterBottom>
            Your VK access token is missing or invalid. Please set up your VK API credentials.
          </Typography>
          <Typography variant="body2" fontWeight="bold">
            Steps to fix this issue:
          </Typography>
          <ol style={{ paddingLeft: '1.5rem', margin: '0.5rem 0' }}>
            <li>Create a VK application at <Link href="https://vk.com/apps?act=manage" target="_blank" rel="noopener">vk.com/apps</Link></li>
            <li>Set up a VK access token with the required permissions</li>
            <li>Add the token to your .env file as VK_ACCESS_TOKEN</li>
            <li>Restart the application</li>
          </ol>
        </Alert>
        {showDetailedError()}
      </Box>
    );
  }
  
  // Generic error handling
  return (
    <Box sx={{ mb: 2 }}>
      <Alert 
        severity="error"
        action={
          onClose && (
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={onClose}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          )
        }
      >
        {displayError()}
      </Alert>
      {showDetailedError()}
    </Box>
  );
};

export default ApiErrorAlert; 