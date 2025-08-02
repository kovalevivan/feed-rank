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
  Alert,
  RadioGroup,
  Radio,
  FormLabel,
  Chip
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
  const [sourceGroups, setSourceGroups] = useState([]);
  const [telegramChannels, setTelegramChannels] = useState([]);
  
  // State for mapping data
  const [formData, setFormData] = useState({
    sourceGroup: '',
    telegramChannel: '',
    active: true
  });
  
  // State for UI
  const [loading, setLoading] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Fetch source groups and Telegram channels on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch unified source groups
        setGroupsLoading(true);
        const sourceGroupsResponse = await axios.get('/api/source-groups');
        setSourceGroups(sourceGroupsResponse.data);
        setGroupsLoading(false);
        
        // Fetch Telegram channels
        setChannelsLoading(true);
        const channelsResponse = await axios.get('/api/telegram-channels');
        setTelegramChannels(channelsResponse.data);
        setChannelsLoading(false);
        
        // If editing existing mapping, fetch mapping data
        if (!isNewMapping) {
          setLoading(true);
          const mappingResponse = await axios.get(`/api/mappings/${id}`);
          const mapping = mappingResponse.data;
          
          // Only allow editing if it has a sourceGroup (new format)
          if (!mapping.sourceGroup) {
            setError('This mapping uses the legacy format and cannot be edited. Please create a new mapping with a source group.');
            setLoading(false);
            return;
          }
          
          setFormData({
            sourceGroup: mapping.sourceGroup._id,
            telegramChannel: mapping.telegramChannel._id,
            active: mapping.active
          });
          setLoading(false);
        }
      } catch (err) {
        setError(err.response?.data?.message || translate('Failed to load data'));
        setGroupsLoading(false);
        setChannelsLoading(false);
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id, isNewMapping, translate]);
  
  // Handle form input changes
  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    
    if (name === 'sourceType') {
      // When switching source type, clear the other type's selections
      if (value === 'individual') {
        setFormData({
          ...formData,
          sourceType: value,
          vkSourceGroup: '',
          telegramSource: ''
        });
      } else if (value === 'group') {
        setFormData({
          ...formData,
          sourceType: value,
          vkSource: '',
          telegramSource: ''
        });
      } else if (value === 'telegram') {
        setFormData({
          ...formData,
          sourceType: value,
          vkSource: '',
          vkSourceGroup: ''
        });
      }
    } else {
      setFormData({
        ...formData,
        [name]: type === 'checkbox' ? checked : value
      });
    }
    
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
      if (!formData.sourceGroup) {
        setError(translate('Please select a source group'));
        setLoading(false);
        return;
      }
      
      if (!formData.telegramChannel) {
        setError(translate('Please select a Telegram channel'));
        setLoading(false);
        return;
      }
      
      let response;
      const mappingData = {
        sourceGroup: formData.sourceGroup,
        telegramChannel: formData.telegramChannel,
        active: formData.active
      };
      
      if (isNewMapping) {
        // Create new mapping
        response = await axios.post('/api/mappings', mappingData);
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
  const isFormDisabled = loading || channelsLoading || groupsLoading;
  
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
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {translate('Create a mapping between a source group and a Telegram channel. All sources in the group will forward viral posts to the selected channel.')}
            </Typography>
            
            <FormControl fullWidth margin="normal" required disabled={isFormDisabled || !isNewMapping}>
              <InputLabel id="source-group-label">{translate('Source Group')}</InputLabel>
              <Select
                labelId="source-group-label"
                id="sourceGroup"
                name="sourceGroup"
                value={formData.sourceGroup}
                onChange={handleChange}
                label={translate('Source Group')}
              >
                <MenuItem value="" disabled>
                  <em>{translate('Select a source group')}</em>
                </MenuItem>
                {groupsLoading ? (
                  <MenuItem disabled>
                    <CircularProgress size={20} sx={{ mr: 1 }} /> {translate('Loading groups...')}
                  </MenuItem>
                ) : sourceGroups.length === 0 ? (
                  <MenuItem disabled>
                    {translate('No source groups available')}
                  </MenuItem>
                ) : (
                  sourceGroups.map((group) => (
                    <MenuItem key={group._id} value={group._id}>
                      {group.name} ({(group.vkSources?.length || 0) + (group.telegramSources?.length || 0)} {translate('sources')})
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
                disabled={isFormDisabled || 
                          (!isNewMapping && formData.active === undefined) || 
                          (isNewMapping && (!formData.sourceGroup || !formData.telegramChannel))}
              >
                {loading ? translate('Saving...') : translate('Save Mapping')}
              </Button>
            </Box>
            
            {/* Show warning message if no source groups or channels available */}
            {isNewMapping && (sourceGroups.length === 0 || telegramChannels.length === 0) && (
              <Alert severity="info" sx={{ mt: 3 }}>
                {sourceGroups.length === 0 && telegramChannels.length === 0 ? (
                  translate('You need to add at least one source group and one Telegram channel before creating a mapping.')
                ) : sourceGroups.length === 0 ? (
                  translate('You need to add at least one source group before creating a mapping.')
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