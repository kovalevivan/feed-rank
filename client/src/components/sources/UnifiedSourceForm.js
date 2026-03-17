import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert
} from '@mui/material';
import { useTranslation } from '../../translations/TranslationContext';
import SourceForm from './SourceForm'; // VK Source Form
import TelegramSourceForm from '../telegramSources/TelegramSourceForm';

const UnifiedSourceForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const translate = useTranslation();
  const isEditing = Boolean(id && id !== 'new');
  
  const [sourceType, setSourceType] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If editing, determine source type and redirect to appropriate form
  useEffect(() => {
    if (isEditing) {
      const determineSourceType = async () => {
        try {
          setLoading(true);
          
          // Try to fetch as VK source first
          try {
            await fetch(`/api/vk-sources/${id}`);
            // If successful, it's a VK source
            navigate(`/app/vk-sources/${id}`, { replace: true });
            return;
          } catch (vkError) {
            // If VK fails, try Telegram
            try {
              await fetch(`/api/telegram-sources/${id}`);
              // If successful, it's a Telegram source
              navigate(`/app/telegram-sources/${id}`, { replace: true });
              return;
            } catch (telegramError) {
              // If both fail, show error
              setError('Source not found');
            }
          }
        } catch (error) {
          console.error('Error determining source type:', error);
          setError('Error loading source');
        } finally {
          setLoading(false);
        }
      };
      
      determineSourceType();
    }
  }, [isEditing, id, navigate]);

  const handleSourceTypeChange = (event) => {
    setSourceType(event.target.value);
  };

  const handleCancel = () => {
    navigate('/app/sources');
  };

  // If editing and loading, show loading state
  if (isEditing && loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 2, mb: 2 }}>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              {translate('Loading source...')}
            </Typography>
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </Paper>
        </Box>
      </Container>
    );
  }

  // If editing but not loading, the redirect should have happened
  if (isEditing && !loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 2, mb: 2 }}>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              {translate('Redirecting...')}
            </Typography>
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </Paper>
        </Box>
      </Container>
    );
  }

  // For new sources, show type selection first
  if (!sourceType) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 2, mb: 2 }}>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              {translate('Add New Source')}
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Box sx={{ mt: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                {translate('Choose Source Type')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {translate('Select the type of source you want to add')}
              </Typography>

              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>{translate('Source Type')}</InputLabel>
                <Select
                  value={sourceType}
                  onChange={handleSourceTypeChange}
                  label={translate('Source Type')}
                >
                  <MenuItem value="vk">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1">VK</Typography>
                      <Typography variant="body2" color="text.secondary">
                        - {translate('VK groups and communities')}
                      </Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="telegram">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1">Telegram</Typography>
                      <Typography variant="body2" color="text.secondary">
                        - {translate('Telegram channels and groups')}
                      </Typography>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>

              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button variant="outlined" onClick={handleCancel}>
                  {translate('Cancel')}
                </Button>
                <Button 
                  variant="contained" 
                  onClick={() => {
                    if (sourceType) {
                      // Continue with the selected type
                    }
                  }}
                  disabled={!sourceType}
                >
                  {translate('Continue')}
                </Button>
              </Box>
            </Box>
          </Paper>
        </Box>
      </Container>
    );
  }

  // Show the appropriate form based on selected type
  if (sourceType === 'vk') {
    return <SourceForm />;
  } else if (sourceType === 'telegram') {
    return <TelegramSourceForm />;
  }

  return null;
};

export default UnifiedSourceForm;
