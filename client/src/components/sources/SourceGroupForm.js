import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  CircularProgress,
  Alert,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Grid,
  Divider
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import {
  fetchSourceGroupById,
  createSourceGroup,
  updateSourceGroup,
  clearSourceGroupsError,
  clearCurrentSourceGroup,
  resetSuccess
} from '../../redux/slices/sourceGroupsSlice';
import { fetchVkSources } from '../../redux/slices/vkSourcesSlice';
import ApiErrorAlert from '../common/ApiErrorAlert';
import { useTranslation } from '../../translations/TranslationContext';
import axios from 'axios';

const SourceGroupForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const translate = useTranslation();
  
  const { currentSourceGroup, loading, error, success } = useSelector((state) => state.sourceGroups);
  const { vkSources } = useSelector((state) => state.vkSources);
  
  // Local state
  const [formData, setFormData] = useState({
    name: '',
    vkSources: [],
    telegramSources: [],
    stopWords: [],
    active: true
  });
  const [stopWordsInput, setStopWordsInput] = useState('');
  const [telegramSources, setTelegramSources] = useState([]);
  const [selectedVkSources, setSelectedVkSources] = useState([]);
  const [selectedTelegramSources, setSelectedTelegramSources] = useState([]);
  
  // Define isEditMode early so it can be used in useEffect dependencies
  const isEditMode = id && id !== 'new';
  const isSubmitting = loading;
  
  // Load sources and current group if editing
  useEffect(() => {
    // Fetch VK sources
    dispatch(fetchVkSources());
    
    // Fetch Telegram sources
    const loadTelegramSources = async () => {
      try {
        const response = await axios.get('/api/telegram-sources');
        setTelegramSources(response.data);
      } catch (error) {
        console.error('Error fetching Telegram sources:', error);
      }
    };
    loadTelegramSources();
    
    if (isEditMode) {
      console.log(`🔍 Attempting to fetch group with ID: ${id}`);
      dispatch(fetchSourceGroupById(id));
    } else {
      dispatch(clearCurrentSourceGroup());
    }
    
    // Cleanup on unmount
    return () => {
      dispatch(clearCurrentSourceGroup());
      dispatch(clearSourceGroupsError());
      dispatch(resetSuccess());
    };
  }, [dispatch, id, isEditMode]);
  
  // Update form data when currentSourceGroup changes
  useEffect(() => {
    if (currentSourceGroup) {
      setFormData({
        name: currentSourceGroup.name || '',
        vkSources: currentSourceGroup.vkSources || [],
        telegramSources: currentSourceGroup.telegramSources || [],
        stopWords: currentSourceGroup.stopWords || [],
        active: currentSourceGroup.active !== undefined ? currentSourceGroup.active : true
      });
      
      // Set selected sources for the form
      setSelectedVkSources((currentSourceGroup.vkSources || []).map(s => s._id || s));
      setSelectedTelegramSources((currentSourceGroup.telegramSources || []).map(s => s._id || s));
      
      // Set stop words input
      if (currentSourceGroup.stopWords && Array.isArray(currentSourceGroup.stopWords)) {
        setStopWordsInput(currentSourceGroup.stopWords.join('\n'));
      } else {
        setStopWordsInput('');
      }
    }
  }, [currentSourceGroup]);

  // Redirect on successful creation/update
  useEffect(() => {
    if (success) {
      navigate('/source-groups');
    }
  }, [success, navigate]);

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Handle navigation back
  const handleNavigateBack = () => {
    dispatch(resetSuccess());
    navigate('/source-groups');
  };
  
  // Form submission handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Process stop words input into array
    const stopWords = stopWordsInput
      .split(/[\n,]/)
      .map(word => word.trim())
      .filter(word => word.length > 0);
    
    const groupData = {
      ...formData,
      vkSources: selectedVkSources,
      telegramSources: selectedTelegramSources,
      stopWords
    };
    
    try {
      if (isEditMode) {
        await dispatch(updateSourceGroup({ id, sourceGroupData: groupData })).unwrap();
      } else {
        await dispatch(createSourceGroup(groupData)).unwrap();
      }
    } catch (error) {
      // Error is handled by the slice
      console.error('Error saving source group:', error);
    }
  };

  // Handle error close
  const handleErrorClose = () => {
    dispatch(clearSourceGroupsError());
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleNavigateBack}
          sx={{ mr: 2 }}
        >
          {translate('Back')}
        </Button>
        <Typography variant="h4" component="h1">
          {isEditMode ? translate('Edit Source Group') : translate('Add Source Group')}
        </Typography>
      </Box>

      {/* Error Alert */}
      {error && <ApiErrorAlert error={error} onClose={handleErrorClose} />}

      {/* Success Alert */}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {isEditMode ? translate('Source group updated successfully!') : translate('Source group created successfully!')}
        </Alert>
      )}

      {/* Loading */}
      {loading && !currentSourceGroup && isEditMode && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Form */}
      <Paper sx={{ p: 3 }}>
        <Box component="form" onSubmit={handleSubmit}>
          {/* Basic Information */}
          <Typography variant="h6" gutterBottom>
            {translate('Basic Information')}
          </Typography>
          
          <TextField
            fullWidth
            label={translate('Group Name')}
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            margin="normal"
            disabled={isSubmitting}
          />

          {/* Sources Selection */}
          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            {translate('Sources')}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {translate('Select VK and Telegram sources to include in this group')}
          </Typography>

          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* VK Sources */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth disabled={isSubmitting}>
                <InputLabel>{translate('VK Sources')}</InputLabel>
                <Select
                  multiple
                  value={selectedVkSources}
                  onChange={(e) => setSelectedVkSources(e.target.value)}
                  input={<OutlinedInput label={translate('VK Sources')} />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => {
                        const source = vkSources.find(s => s._id === value);
                        return (
                          <Chip 
                            key={value} 
                            label={source ? source.name : value}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        );
                      })}
                    </Box>
                  )}
                >
                  {vkSources.map((source) => (
                    <MenuItem key={source._id} value={source._id}>
                      {source.name} ({source.groupId})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Telegram Sources */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth disabled={isSubmitting}>
                <InputLabel>{translate('Telegram Sources')}</InputLabel>
                <Select
                  multiple
                  value={selectedTelegramSources}
                  onChange={(e) => setSelectedTelegramSources(e.target.value)}
                  input={<OutlinedInput label={translate('Telegram Sources')} />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => {
                        const source = telegramSources.find(s => s._id === value);
                        return (
                          <Chip 
                            key={value} 
                            label={source ? source.name : value}
                            size="small"
                            color="secondary"
                            variant="outlined"
                          />
                        );
                      })}
                    </Box>
                  )}
                >
                  {telegramSources.map((source) => (
                    <MenuItem key={source._id} value={source._id}>
                      {source.name} {source.username ? `(@${source.username})` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Stop Words */}
          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            {translate('Stop Words')}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {translate('Enter stop words (one per line or comma-separated)')}
          </Typography>
          
          <TextField
            fullWidth
            label={translate('Stop Words')}
            value={stopWordsInput}
            onChange={(e) => setStopWordsInput(e.target.value)}
            multiline
            rows={4}
            margin="normal"
            disabled={isSubmitting}
            placeholder={translate('word1\nword2\nword3')}
          />

          {/* Active Status */}
          <FormControlLabel
            control={
              <Switch
                name="active"
                checked={formData.active}
                onChange={handleInputChange}
                disabled={isSubmitting}
              />
            }
            label={translate('Active')}
            sx={{ mt: 2 }}
          />

          {/* Submit Button */}
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="submit"
              variant="contained"
              startIcon={isSubmitting ? <CircularProgress size={20} /> : <SaveIcon />}
              disabled={isSubmitting || !formData.name.trim()}
            >
              {isSubmitting 
                ? translate('Saving...') 
                : isEditMode 
                  ? translate('Update Group') 
                  : translate('Create Group')
              }
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default SourceGroupForm;