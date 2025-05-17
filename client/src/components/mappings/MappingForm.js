import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Divider,
  FormControlLabel,
  Switch,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useTranslation } from '../../translations/TranslationContext';

const MappingForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNewMapping = id === 'new' || !id;
  const translate = useTranslation();
  
  // State for data sources
  const [vkSources, setVkSources] = useState([]);
  const [telegramChannels, setTelegramChannels] = useState([]);
  
  // State for mapping data
  const [formData, setFormData] = useState({
    vkSource: '',
    telegramChannel: '',
    active: true
  });
  
  // State for UI
  const [loading, setLoading] = useState(false);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Fetch VK sources and Telegram channels on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch VK sources
        setSourcesLoading(true);
        const sourcesResponse = await axios.get('/api/vk-sources');
        setVkSources(sourcesResponse.data);
        setSourcesLoading(false);
        
        // Fetch Telegram channels
        setChannelsLoading(true);
        const channelsResponse = await axios.get('/api/telegram-channels');
        setTelegramChannels(channelsResponse.data);
        setChannelsLoading(false);
        
        // If editing existing mapping, fetch mapping data
        if (!isNewMapping) {
          setLoading(true);
          const mappingResponse = await axios.get(`/api/mappings/${id}`);
          setFormData({
            vkSource: mappingResponse.data.vkSource._id,
            telegramChannel: mappingResponse.data.telegramChannel._id,
            active: mappingResponse.data.active
          });
          setLoading(false);
        }
      } catch (err) {
        setError(err.response?.data?.message || translate('Failed to load data'));
        setSourcesLoading(false);
        setChannelsLoading(false);
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id, isNewMapping, translate]);
  
  // Handle form input changes
  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
    
    // Clear error/success when user changes form
    if (error) setError('');
    if (success) setSuccess('');
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // Validate form data
      if (!formData.vkSource || !formData.telegramChannel) {
        setError(translate('Please select both a VK source and a Telegram channel'));
        setLoading(false);
        return;
      }
      
      let response;
      
      if (isNewMapping) {
        // Create new mapping
        response = await axios.post('/api/mappings', formData);
        setSuccess(translate('Mapping created successfully!'));
      } else {
        // Update existing mapping
        response = await axios.put(`/api/mappings/${id}`, { active: formData.active });
        setSuccess(translate('Mapping updated successfully!'));
      }
      
      // Redirect after short delay
      setTimeout(() => {
        navigate('/mappings');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || translate('Failed to save mapping'));
      console.error('Error saving mapping:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Determine if form fields should be disabled
  const isFormDisabled = loading || sourcesLoading || channelsLoading;
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {isNewMapping ? translate('Add Mapping') : translate('Edit Mapping')}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/mappings')}
          disabled={loading}
        >
          {translate('Back to Mappings')}
        </Button>
      </Box>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      
      <Paper sx={{ p: 3 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box component="form" onSubmit={handleSubmit}>
            <Typography variant="h6" gutterBottom>
              {translate('Mapping Details')}
            </Typography>
            
            <FormControl fullWidth margin="normal" required disabled={isFormDisabled || !isNewMapping}>
              <InputLabel id="vk-source-label">{translate('VK Source')}</InputLabel>
              <Select
                labelId="vk-source-label"
                id="vkSource"
                name="vkSource"
                value={formData.vkSource}
                onChange={handleChange}
                label={translate('VK Source')}
              >
                <MenuItem value="" disabled>
                  <em>{translate('Select a VK source')}</em>
                </MenuItem>
                {sourcesLoading ? (
                  <MenuItem disabled>
                    <CircularProgress size={20} sx={{ mr: 1 }} /> {translate('Loading sources...')}
                  </MenuItem>
                ) : vkSources.length === 0 ? (
                  <MenuItem disabled>
                    {translate('No VK sources available')}
                  </MenuItem>
                ) : (
                  vkSources.map((source) => (
                    <MenuItem key={source._id} value={source._id}>
                      {source.name}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
            
            <FormControl fullWidth margin="normal" required disabled={isFormDisabled || !isNewMapping}>
              <InputLabel id="telegram-channel-label">{translate('Telegram Channel')}</InputLabel>
              <Select
                labelId="telegram-channel-label"
                id="telegramChannel"
                name="telegramChannel"
                value={formData.telegramChannel}
                onChange={handleChange}
                label={translate('Telegram Channel')}
              >
                <MenuItem value="" disabled>
                  <em>{translate('Select a Telegram channel')}</em>
                </MenuItem>
                {channelsLoading ? (
                  <MenuItem disabled>
                    <CircularProgress size={20} sx={{ mr: 1 }} /> {translate('Loading channels...')}
                  </MenuItem>
                ) : telegramChannels.length === 0 ? (
                  <MenuItem disabled>
                    {translate('No Telegram channels available')}
                  </MenuItem>
                ) : (
                  telegramChannels.map((channel) => (
                    <MenuItem key={channel._id} value={channel._id}>
                      {channel.name}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
            
            <Divider sx={{ my: 3 }} />
            
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.active}
                    onChange={handleChange}
                    name="active"
                    color="primary"
                    disabled={isFormDisabled}
                  />
                }
                label={translate('Active')}
              />
              <Typography variant="body2" color="textSecondary">
                {translate('When active, posts will be forwarded according to this mapping. Inactive mappings will be ignored.')}
              </Typography>
            </Box>
            
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                type="button"
                variant="outlined"
                onClick={() => navigate('/mappings')}
                sx={{ mr: 2 }}
                disabled={loading}
              >
                {translate('Cancel')}
              </Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                disabled={isFormDisabled || (!isNewMapping && formData.active === undefined) || 
                          (isNewMapping && (!formData.vkSource || !formData.telegramChannel))}
              >
                {loading ? translate('Saving...') : translate('Save Mapping')}
              </Button>
            </Box>
            
            {(vkSources.length === 0 || telegramChannels.length === 0) && (
              <Alert severity="info" sx={{ mt: 3 }}>
                {vkSources.length === 0 && telegramChannels.length === 0 ? (
                  translate('You need to add at least one VK source and one Telegram channel before creating a mapping.')
                ) : vkSources.length === 0 ? (
                  translate('You need to add at least one VK source before creating a mapping.')
                ) : (
                  translate('You need to add at least one Telegram channel before creating a mapping.')
                )}
              </Alert>
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default MappingForm; 