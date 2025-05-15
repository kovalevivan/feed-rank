import React from 'react';
import { Alert, AlertTitle, Box, Link, Typography } from '@mui/material';

/**
 * Component to display friendly error messages for API errors,
 * with special handling for VK API authentication errors
 */
const ApiErrorAlert = ({ error, onClose }) => {
  if (!error) return null;
  
  // Check if this is a VK API authentication error
  const isVkAuthError = 
    error.message?.includes('VK API authentication failed') ||
    error.message?.includes('VK_ACCESS_TOKEN') ||
    error.error?.includes('VK_ACCESS_TOKEN') ||
    error.details?.includes('VK_ACCESS_TOKEN');
  
  if (isVkAuthError) {
    return (
      <Alert 
        severity="error"
        onClose={onClose}
        sx={{ mb: 3 }}
      >
        <AlertTitle>VK API Authentication Failed</AlertTitle>
        <Typography variant="body2" gutterBottom>
          Your VK access token is missing or invalid. Please set up your VK API credentials.
        </Typography>
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" fontWeight="bold">
            Steps to fix this issue:
          </Typography>
          <ol style={{ paddingLeft: '1.5rem', margin: '0.5rem 0' }}>
            <li>Create a VK application at <Link href="https://vk.com/apps?act=manage" target="_blank" rel="noopener">vk.com/apps</Link></li>
            <li>Set up a VK access token with the required permissions</li>
            <li>Add the token to your .env file as VK_ACCESS_TOKEN</li>
            <li>Restart the application</li>
          </ol>
        </Box>
      </Alert>
    );
  }
  
  // Generic error handling
  return (
    <Alert 
      severity="error"
      onClose={onClose}
      sx={{ mb: 3 }}
    >
      <AlertTitle>Error</AlertTitle>
      {error.message || 'An unexpected error occurred'}
    </Alert>
  );
};

export default ApiErrorAlert; 