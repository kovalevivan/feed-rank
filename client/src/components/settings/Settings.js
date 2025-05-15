import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Divider,
  FormControlLabel,
  Switch,
  Grid,
  Tab,
  Tabs,
  Alert,
  Snackbar
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';

const Settings = () => {
  const [tabValue, setTabValue] = useState(0);
  const [success, setSuccess] = useState(false);
  
  // Settings state (would normally be in Redux)
  const [settings, setSettings] = useState({
    vk: {
      postsPerCheck: 50,
      postsForAverage: 200
    },
    system: {
      autoForward: false
    },
    telegram: {
      notificationChatId: ''
    }
  });
  
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  const handleSettingChange = (category, setting, value) => {
    setSettings((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [setting]: value
      }
    }));
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    // Would normally save to the server
    setSuccess(true);
  };
  
  const handleCloseSnackbar = () => {
    setSuccess(false);
  };
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Settings</Typography>
      </Box>
      
      <Paper sx={{ mb: 4 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="System" />
          <Tab label="VK API" />
          <Tab label="Telegram" />
        </Tabs>
      </Paper>
      
      <form onSubmit={handleSubmit}>
        {/* System Settings */}
        {tabValue === 0 && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              System Settings
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.system.autoForward}
                      onChange={(e) => handleSettingChange('system', 'autoForward', e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Automatically forward viral posts without approval"
                />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  When enabled, viral posts will be automatically forwarded to mapped Telegram channels without manual approval.
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        )}
        
        {/* VK API Settings */}
        {tabValue === 1 && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              VK API Settings
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Posts per check"
                  type="number"
                  InputProps={{ inputProps: { min: 10, max: 100 } }}
                  value={settings.vk.postsPerCheck}
                  onChange={(e) => handleSettingChange('vk', 'postsPerCheck', e.target.value)}
                  helperText="Number of posts to fetch from each VK source during check (10-100)"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Posts for average calculation"
                  type="number"
                  InputProps={{ inputProps: { min: 50, max: 500 } }}
                  value={settings.vk.postsForAverage}
                  onChange={(e) => handleSettingChange('vk', 'postsForAverage', e.target.value)}
                  helperText="Number of posts used to calculate average views (50-500)"
                />
              </Grid>
            </Grid>
          </Paper>
        )}
        
        {/* Telegram Settings */}
        {tabValue === 2 && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Telegram Settings
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notification Chat ID"
                  value={settings.telegram.notificationChatId}
                  onChange={(e) => handleSettingChange('telegram', 'notificationChatId', e.target.value)}
                  helperText="Chat ID for system notifications (optional)"
                />
              </Grid>
            </Grid>
          </Paper>
        )}
        
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            type="submit"
            variant="contained"
            startIcon={<SaveIcon />}
            size="large"
          >
            Save Settings
          </Button>
        </Box>
      </form>
      
      <Snackbar
        open={success}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity="success" sx={{ width: '100%' }}>
          Settings saved successfully
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Settings; 