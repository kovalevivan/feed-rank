import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Divider,
  Switch,
  FormControlLabel,
  Tabs,
  Tab
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { setError, clearError, setTelegramChannel } from '../../redux/slices/telegramChannelsSlice';
import { useTranslation } from '../../translations/TranslationContext';

const ChannelForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const translate = useTranslation();
  const { telegramChannel, loading, error } = useSelector(state => state.telegramChannels);
  
  // Determine if it's a new channel form
  const isNewChannel = !id || id === 'new' || id === 'undefined';
  
  console.log("ChannelForm: Route ID parameter =", id);
  console.log("ChannelForm: isNewChannel =", isNewChannel);
  console.log("ChannelForm: Current URL =", window.location.pathname);
  
  // For tab switching between ID and username methods (for new channels only)
  const [inputMethod, setInputMethod] = useState(0); // 0 = ID, 1 = Username

  // Local state for form
  const [formData, setFormData] = useState({
    name: '',
    chatId: '',
    username: '',
    active: true
  });

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  
  // Fetch channel data if editing existing channel
  useEffect(() => {
    const fetchChannel = async () => {
      // Don't fetch if it's a new channel
      if (isNewChannel) {
        console.log("New channel form - skipping API fetch");
        return;
      }
      
      try {
        console.log(`Fetching channel data for ID: ${id}`);
        const response = await axios.get(`/api/telegram-channels/${id}`);
        dispatch(setTelegramChannel(response.data));
        
        // Populate form
        setFormData({
          name: response.data.name || '',
          chatId: response.data.chatId || '',
          username: response.data.username ? response.data.username.replace('@', '') : '',
          active: response.data.active !== undefined ? response.data.active : true
        });
      } catch (err) {
        console.error('Error fetching Telegram channel:', err);
        setFormError(err.response?.data?.message || translate('Failed to fetch channel details'));
      }
    };
    
    fetchChannel();
    
    // Clear error state when component unmounts
    return () => dispatch(clearError());
  }, [id, dispatch, isNewChannel, translate]);
  
  // Handle form input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
    
    // Clear errors when user types
    if (formError) setFormError('');
    if (error) dispatch(clearError());
  };
  
  // Handle tab change between ID and Username methods (for new channels)
  const handleTabChange = (event, newValue) => {
    setInputMethod(newValue);
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');
    setFormSuccess('');
    
    console.log("Form submission - isNewChannel:", isNewChannel);
    
    try {
      if (isNewChannel) {
        // Validate required fields for new channel based on input method
        if (inputMethod === 0 && !formData.chatId) {
          setFormError(translate('Chat ID is required'));
          setSubmitting(false);
          return;
        }
        
        if (inputMethod === 1 && !formData.username) {
          setFormError(translate('Username is required'));
          setSubmitting(false);
          return;
        }
      } else {
        // Validation for editing - name is always required
        if (!formData.name) {
          setFormError(translate('Channel name is required'));
          setSubmitting(false);
          return;
        }
      }
      
      // Prepare data for submission
      const channelData = {
        name: formData.name,
        active: formData.active
      };
      
      if (isNewChannel) {
        // Add chat ID or username based on input method for new channels
        if (inputMethod === 0) {
          channelData.chatId = formData.chatId;
        } else {
          channelData.username = formData.username.startsWith('@')
            ? formData.username
            : `@${formData.username}`;
        }
        
        // Create new channel
        console.log("Creating new channel with data:", channelData);
        await axios.post('/api/telegram-channels', channelData);
        setFormSuccess(translate('Channel added successfully!'));
      } else {
        // For existing channels, include the username if edited
        if (formData.username) {
          channelData.username = formData.username.startsWith('@')
            ? formData.username
            : `@${formData.username}`;
        }
        
        // Update existing channel
        console.log("Updating existing channel with ID:", id);
        await axios.put(`/api/telegram-channels/${id}`, channelData);
        setFormSuccess(translate('Channel updated successfully!'));
      }
      
      // Success - redirect after short delay to allow user to see success message
      setTimeout(() => {
        navigate('/channels');
      }, 1500);
      
    } catch (err) {
      console.error('Error saving Telegram channel:', err);
      if (err.response && err.response.data) {
        setFormError(err.response.data.message || translate('Failed to save channel'));
        console.error('Server response:', err.response.data);
      } else {
        setFormError(translate('Failed to connect to server'));
      }
    } finally {
      setSubmitting(false);
    }
  };
  
  // Common page header component
  const PageHeader = () => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
      <Typography variant="h4">
        {isNewChannel ? translate('Add Channel') : translate('Edit Channel')}
      </Typography>
      <Button
        variant="outlined"
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/channels')}
      >
        {translate('Back to Channels')}
      </Button>
    </Box>
  );
  
  // Common alerts component
  const Alerts = () => (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
      {formSuccess && <Alert severity="success" sx={{ mb: 2 }}>{formSuccess}</Alert>}
    </>
  );
  
  // Common form actions component
  const FormActions = () => (
    <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
      <Button
        type="button"
        variant="outlined"
        onClick={() => navigate('/channels')}
        sx={{ mr: 2 }}
        disabled={submitting || loading}
      >
        {translate('Cancel')}
      </Button>
      <Button
        type="submit"
        variant="contained"
        startIcon={submitting || loading ? <CircularProgress size={20} /> : <SaveIcon />}
        disabled={submitting || loading}
      >
        {submitting || loading ? translate('Saving...') : translate('Save Channel')}
      </Button>
    </Box>
  );
  
  // Active switch component
  const ActiveSwitch = () => (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <FormControlLabel
        control={
          <Switch
            checked={formData.active}
            onChange={handleChange}
            name="active"
            color="primary"
            disabled={submitting || loading}
          />
        }
        label={translate('Active')}
      />
      <Typography variant="body2" color="textSecondary">
        {translate('When active, posts will be forwarded to this channel. Inactive channels will not receive posts.')}
      </Typography>
    </Box>
  );
  
  // New Channel Form
  const NewChannelForm = () => (
    <Box component="form" onSubmit={handleSubmit}>
      <Typography variant="h6" gutterBottom>
        {translate('Channel Details')}
      </Typography>
      
      <TextField
        fullWidth
        label={translate('Channel Name')}
        name="name"
        value={formData.name}
        onChange={handleChange}
        margin="normal"
        required
        helperText={translate('A name to identify this channel in FeedRank')}
        disabled={submitting || loading}
      />
      
      <Box sx={{ mt: 2, mb: 2 }}>
        <Tabs value={inputMethod} onChange={handleTabChange} sx={{ mb: 2 }}>
          <Tab label={translate('Add by Channel ID')} />
          <Tab label={translate('Add by Username')} />
        </Tabs>
        
        {inputMethod === 0 ? (
          <TextField
            fullWidth
            label={translate('Channel ID')}
            name="chatId"
            value={formData.chatId}
            onChange={handleChange}
            margin="normal"
            required
            helperText={translate('The Telegram chat ID for this channel (e.g., -1001234567890)')}
            disabled={submitting || loading}
          />
        ) : (
          <TextField
            fullWidth
            label={translate('Username')}
            name="username"
            value={formData.username}
            onChange={handleChange}
            margin="normal"
            required
            helperText={translate('Channel username (e.g., \'telegram\' or \'@telegram\')')}
            disabled={submitting || loading}
            InputProps={{
              startAdornment: formData.username && !formData.username.startsWith('@') ? '@' : null
            }}
          />
        )}
      </Box>
      
      <Divider sx={{ my: 3 }} />
      
      <ActiveSwitch />
      
      <FormActions />
      
      <Box sx={{ mt: 3 }}>
        <Alert severity="info">
          <Typography variant="body2">
            <strong>{translate('Important')}:</strong> {translate('The bot must be an administrator of the channel with permission to post messages.')}
          </Typography>
        </Alert>
      </Box>
    </Box>
  );
  
  // Edit Channel Form
  const EditChannelForm = () => (
    <Box component="form" onSubmit={handleSubmit}>
      <Typography variant="h6" gutterBottom>
        {translate('Channel Details')}
      </Typography>
      
      <TextField
        fullWidth
        label={translate('Channel Name')}
        name="name"
        value={formData.name}
        onChange={handleChange}
        margin="normal"
        required
        helperText={translate('A name to identify this channel in FeedRank')}
        disabled={submitting || loading}
      />
      
      <TextField
        fullWidth
        label={translate('Channel ID')}
        name="chatId"
        value={formData.chatId}
        margin="normal"
        disabled={true}
        helperText={translate('Chat ID cannot be changed once the channel is added')}
      />
      
      <TextField
        fullWidth
        label={translate('Username')}
        name="username"
        value={formData.username}
        onChange={handleChange}
        margin="normal"
        helperText={translate('Channel username without @ (e.g., \'telegram\')')}
        disabled={submitting || loading}
        InputProps={{
          startAdornment: formData.username && !formData.username.startsWith('@') ? '@' : null
        }}
      />
      
      <Divider sx={{ my: 3 }} />
      
      <ActiveSwitch />
      
      <FormActions />
    </Box>
  );
  
  return (
    <Box>
      <PageHeader />
      <Alerts />
      
      <Paper sx={{ p: 3 }}>
        {isNewChannel ? <NewChannelForm /> : <EditChannelForm />}
      </Paper>
    </Box>
  );
};

export default ChannelForm; 