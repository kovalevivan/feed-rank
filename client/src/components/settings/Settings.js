import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
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
  Snackbar,
  CircularProgress
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { useTranslation } from '../../translations/TranslationContext';
import { fetchSettings, updateSettingValue, setSuccess, setError } from '../../redux/slices/settingsSlice';
import ApiErrorAlert from '../common/ApiErrorAlert';

const Settings = () => {
  const [tabValue, setTabValue] = useState(0);
  const dispatch = useDispatch();
  const { settings, loading, error, success } = useSelector((state) => state.settings);
  const translate = useTranslation();
  
  // Raw stop words input state (before parsing)
  const [stopWordsInput, setStopWordsInput] = useState('');
  
  // Local state for form
  const [formData, setFormData] = useState({
    vk: {
      stopWords: []
    },
    system: {
      autoForward: false
    },
    telegram: {
      notificationChatId: ''
    }
  });
  
  // Fetch settings on mount
  useEffect(() => {
    dispatch(fetchSettings());
  }, [dispatch]);
  
  // Update local state when settings are loaded
  useEffect(() => {
    if (settings && Object.keys(settings).length > 0) {
      const newFormData = { ...formData };
      
      // Process VK settings
      if (settings.vk) {
        settings.vk.forEach(setting => {
          if (setting.key === 'vk.stop_words') {
            // Handle various formats of stop words
            if (Array.isArray(setting.value)) {
              // If it's already an array, use it directly
              newFormData.vk.stopWords = setting.value
                .filter(word => word && typeof word === 'string' && word.trim().length > 0);
              
              // Also update the raw input
              setStopWordsInput(newFormData.vk.stopWords.join('\n'));
            } else if (typeof setting.value === 'string') {
              // If it's a string, split by commas, spaces, or newlines
              newFormData.vk.stopWords = setting.value
                .split(/[,\n\s]+/)
                .map(word => word.trim())
                .filter(word => word.length > 0);
              
              // Also update the raw input
              setStopWordsInput(setting.value);
            } else {
              // Default to empty array for any other case
              newFormData.vk.stopWords = [];
              setStopWordsInput('');
            }
          }
        });
      }
      
      // Process system settings
      if (settings.system) {
        settings.system.forEach(setting => {
          if (setting.key === 'system.auto_forward') {
            newFormData.system.autoForward = setting.value;
          }
        });
      }
      
      // Process telegram settings
      if (settings.telegram) {
        settings.telegram.forEach(setting => {
          if (setting.key === 'telegram.notification_chat_id') {
            newFormData.telegram.notificationChatId = setting.value;
          }
        });
      }
      
      setFormData(newFormData);
    }
  }, [settings]);
  
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  const handleSettingChange = (category, setting, value) => {
    setFormData((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [setting]: value
      }
    }));
  };

  // Process stop words input into array before submitting
  const processStopWords = () => {
    // Split by commas or newlines
    const stopWords = stopWordsInput
      .split(/[\n,]/)
      .map(word => word.trim())
      .filter(word => word.length > 0);
    
    return stopWords;
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Process stop words before submitting
    const processedStopWords = processStopWords();
    
    // Update all settings
    const promises = [];
    
    // VK settings
    promises.push(
      dispatch(updateSettingValue({
        key: 'vk.stop_words',
        value: processedStopWords,
        category: 'vk'
      }))
    );
    
    // System settings
    promises.push(
      dispatch(updateSettingValue({
        key: 'system.auto_forward',
        value: formData.system.autoForward,
        category: 'system'
      }))
    );
    
    // Telegram settings
    promises.push(
      dispatch(updateSettingValue({
        key: 'telegram.notification_chat_id',
        value: formData.telegram.notificationChatId,
        category: 'telegram'
      }))
    );
    
    // Wait for all updates to complete
    Promise.all(promises)
      .then(() => {
        console.log('All settings updated successfully');
      })
      .catch(error => {
        console.error('Error updating settings:', error);
      });
  };
  
  const handleCloseSnackbar = () => {
    dispatch(setSuccess(false));
  };
  
  const handleErrorClose = () => {
    dispatch(setError(null));
  };
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{translate('Settings')}</Typography>
      </Box>
      
      {error && <ApiErrorAlert error={error} onClose={handleErrorClose} />}
      
      <Paper sx={{ mb: 4 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label={translate('System')} />
          <Tab label={translate('VK API')} />
          <Tab label={translate('Telegram')} />
        </Tabs>
      </Paper>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <form onSubmit={handleSubmit}>
          {/* System Settings */}
          {tabValue === 0 && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                {translate('System Settings')}
              </Typography>
              <Divider sx={{ mb: 3 }} />
              
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.system.autoForward}
                        onChange={(e) => handleSettingChange('system', 'autoForward', e.target.checked)}
                        color="primary"
                      />
                    }
                    label={translate('Automatically forward viral posts without approval')}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {translate('When enabled, viral posts will be automatically forwarded to mapped Telegram channels without manual approval.')}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          )}
          
          {/* VK API Settings */}
          {tabValue === 1 && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                {translate('VK API Settings')}
              </Typography>
              <Divider sx={{ mb: 3 }} />
              
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label={translate('Stop Words')}
                    multiline
                    rows={4}
                    placeholder={translate('Example: реклама, промокод, акция, скидка')}
                    value={stopWordsInput}
                    onChange={(e) => setStopWordsInput(e.target.value)}
                    helperText={translate('Enter words separated by commas, spaces, or new lines. Posts containing these words will be filtered out. Changes apply to all sources.')}
                  />
                </Grid>
              </Grid>
            </Paper>
          )}
          
          {/* Telegram Settings */}
          {tabValue === 2 && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                {translate('Telegram Settings')}
              </Typography>
              <Divider sx={{ mb: 3 }} />
              
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label={translate('Notification Chat ID')}
                    value={formData.telegram.notificationChatId}
                    onChange={(e) => handleSettingChange('telegram', 'notificationChatId', e.target.value)}
                    helperText={translate('Chat ID for system notifications (optional)')}
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
              disabled={loading}
            >
              {loading ? (
                <CircularProgress size={24} />
              ) : (
                translate('Save Settings')
              )}
            </Button>
          </Box>
        </form>
      )}
      
      <Snackbar
        open={success}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity="success" sx={{ width: '100%' }}>
          {translate('Settings saved successfully')}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Settings; 