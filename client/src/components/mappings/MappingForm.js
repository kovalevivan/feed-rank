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
  const [vkSources, setVkSources] = useState([]);
  const [vkSourceGroups, setVkSourceGroups] = useState([]);
  const [telegramChannels, setTelegramChannels] = useState([]);
  
  // State for mapping data
  const [formData, setFormData] = useState({
    vkSource: '',
    vkSourceGroup: '',
    telegramChannel: '',
    active: true,
    sourceType: 'individual' // 'individual' or 'group'
  });
  
  // State for UI
  const [loading, setLoading] = useState(false);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Fetch VK sources, VK source groups, and Telegram channels on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch VK sources
        setSourcesLoading(true);
        const sourcesResponse = await axios.get('/api/vk-sources');
        setVkSources(sourcesResponse.data);
        setSourcesLoading(false);
        
        // Fetch VK source groups
        setGroupsLoading(true);
        const groupsResponse = await axios.get('/api/vk-source-groups');
        setVkSourceGroups(groupsResponse.data);
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
          
          // Determine if this is an individual source or a group mapping
          const sourceType = mapping.vkSource ? 'individual' : 'group';
          
          setFormData({
            vkSource: mapping.vkSource?._id || '',
            vkSourceGroup: mapping.vkSourceGroup?._id || '',
            telegramChannel: mapping.telegramChannel._id,
            active: mapping.active,
            sourceType
          });
          setLoading(false);
        }
      } catch (err) {
        setError(err.response?.data?.message || translate('Failed to load data'));
        setSourcesLoading(false);
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
      // When switching source type, clear the other type's selection
      if (value === 'individual') {
        setFormData({
          ...formData,
          sourceType: value,
          vkSourceGroup: ''
        });
      } else {
        setFormData({
          ...formData,
          sourceType: value,
          vkSource: ''
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
      if (formData.sourceType === 'individual' && !formData.vkSource) {
        setError(translate('Please select a VK source'));
        setLoading(false);
        return;
      }
      
      if (formData.sourceType === 'group' && !formData.vkSourceGroup) {
        setError(translate('Please select a VK source group'));
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
        vkSource: formData.sourceType === 'individual' ? formData.vkSource : null,
        vkSourceGroup: formData.sourceType === 'group' ? formData.vkSourceGroup : null,
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
  const isFormDisabled = loading || sourcesLoading || channelsLoading || groupsLoading;
  
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
            
            {isNewMapping && (
              <Box sx={{ mb: 3 }}>
                <FormControl component="fieldset">
                  <FormLabel component="legend">{translate('Select Source Type')}</FormLabel>
                  <RadioGroup
                    row
                    name="sourceType"
                    value={formData.sourceType}
                    onChange={handleChange}
                  >
                    <FormControlLabel 
                      value="individual" 
                      control={<Radio />} 
                      label={translate('Individual VK Source')} 
                      disabled={isFormDisabled}
                    />
                    <FormControlLabel 
                      value="group" 
                      control={<Radio />} 
                      label={translate('VK Source Group')} 
                      disabled={isFormDisabled}
                    />
                  </RadioGroup>
                </FormControl>
              </Box>
            )}
            
            {/* Display current source type for edit mode */}
            {!isNewMapping && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  {translate('Source Type')}:
                </Typography>
                <Chip 
                  label={formData.sourceType === 'individual' ? 
                    translate('Individual VK Source') : 
                    translate('VK Source Group')}
                  color="primary"
                  variant="outlined"
                />
              </Box>
            )}
            
            {formData.sourceType === 'individual' && (
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
            )}
            
            {formData.sourceType === 'group' && (
              <FormControl fullWidth margin="normal" required disabled={isFormDisabled || !isNewMapping}>
                <InputLabel id="vk-source-group-label">{translate('VK Source Group')}</InputLabel>
                <Select
                  labelId="vk-source-group-label"
                  id="vkSourceGroup"
                  name="vkSourceGroup"
                  value={formData.vkSourceGroup}
                  onChange={handleChange}
                  label={translate('VK Source Group')}
                >
                  <MenuItem value="" disabled>
                    <em>{translate('Select a VK source group')}</em>
                  </MenuItem>
                  {groupsLoading ? (
                    <MenuItem disabled>
                      <CircularProgress size={20} sx={{ mr: 1 }} /> {translate('Loading groups...')}
                    </MenuItem>
                  ) : vkSourceGroups.length === 0 ? (
                    <MenuItem disabled>
                      {translate('No VK source groups available')}
                    </MenuItem>
                  ) : (
                    vkSourceGroups.map((group) => (
                      <MenuItem key={group._id} value={group._id}>
                        {group.name} ({group.sources?.length || 0} {translate('sources')})
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            )}
            
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
                          (isNewMapping && (!formData.telegramChannel || 
                            (formData.sourceType === 'individual' && !formData.vkSource) ||
                            (formData.sourceType === 'group' && !formData.vkSourceGroup)))}
              >
                {loading ? translate('Saving...') : translate('Save Mapping')}
              </Button>
            </Box>
            
            {/* Show appropriate warning messages */}
            {isNewMapping && (formData.sourceType === 'individual' ? vkSources.length === 0 : vkSourceGroups.length === 0 || telegramChannels.length === 0) && (
              <Alert severity="info" sx={{ mt: 3 }}>
                {formData.sourceType === 'individual' && vkSources.length === 0 && telegramChannels.length === 0 ? (
                  translate('You need to add at least one VK source and one Telegram channel before creating a mapping.')
                ) : formData.sourceType === 'individual' && vkSources.length === 0 ? (
                  translate('You need to add at least one VK source before creating a mapping.')
                ) : formData.sourceType === 'group' && vkSourceGroups.length === 0 && telegramChannels.length === 0 ? (
                  translate('You need to add at least one VK source group and one Telegram channel before creating a mapping.')
                ) : formData.sourceType === 'group' && vkSourceGroups.length === 0 ? (
                  translate('You need to add at least one VK source group before creating a mapping.')
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