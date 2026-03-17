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
  CircularProgress,
  Divider,
  Switch,
  Chip
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import {
  fetchVkSourceById,
  createVkSource,
  updateVkSource,
  clearVkSourcesError,
    clearVkSourceSuccess,
  clearCurrentVkSource
} from '../../redux/slices/vkSourcesSlice';
import ApiErrorAlert from '../common/ApiErrorAlert';
import { useTranslation } from '../../translations/TranslationContext';
import PercentileSlider from './PercentileSlider';

const SourceForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const translate = useTranslation();
  
  const { 
    vkSource, 
    loading, 
    error, 
    success
  } = useSelector((state) => state.vkSources);
  const [submitted, setSubmitted] = useState(false);
  
  // Local state for form
  const [formData, setFormData] = useState({
    name: '',
    thresholdType: 'auto',
    thresholdMethod: 'percentile',
    customPercentile: 90,
    manualThreshold: 1000,
    checkFrequency: 60,
    maxNewsAgeMinutes: 60,
    postsToCheck: 50,
    active: true,
    experimentalViewTracking: false,
    highDynamicsDetection: {
      enabled: true,
      growthRateThreshold: 30,
      minDataPoints: 4
    }
  });
  
  // Load source data if editing
  useEffect(() => {
    // Ensure stale success state from previous operations does not cause redirect
    dispatch(clearVkSourceSuccess());

    if (id && id !== 'new') {
      dispatch(fetchVkSourceById(id));
    } else {
      dispatch(clearCurrentVkSource());
    }
    
    // Cleanup on unmount
    return () => {
      dispatch(clearCurrentVkSource());
      dispatch(clearVkSourcesError());
      dispatch(clearVkSourceSuccess());
    };
  }, [id, dispatch]);
  
  // Update form data when source is loaded
  useEffect(() => {
    if (vkSource && id !== 'new') {
      setFormData({
        name: vkSource.name || '',
        thresholdType: vkSource.thresholdType || 'auto',
        thresholdMethod: vkSource.thresholdMethod || 'percentile',
        customPercentile: vkSource.customPercentile || 90,
        manualThreshold: vkSource.manualThreshold || 1000,
        checkFrequency: vkSource.checkFrequency || 60,
        maxNewsAgeMinutes: vkSource.maxNewsAgeMinutes || 60,
        postsToCheck: vkSource.postsToCheck || 50,
        active: vkSource.active !== undefined ? vkSource.active : true,
        experimentalViewTracking: vkSource.experimentalViewTracking || false,
        highDynamicsDetection: vkSource.highDynamicsDetection || {
          enabled: true,
          growthRateThreshold: 30,
          minDataPoints: 4
        }
      });
    }
  }, [vkSource, id]);
  
  // Redirect after successful submission (only if this form submitted)
  useEffect(() => {
    if (success && submitted) {
      navigate('/app/sources');
      // Clear success to avoid redirect loops next time
      dispatch(clearVkSourceSuccess());
      setSubmitted(false);
    }
  }, [success, submitted, navigate, dispatch]);
  
  // Handle form input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };
  
  // Handle radio button changes
  const handleRadioChange = (e) => {
    setFormData({
      ...formData,
      thresholdType: e.target.value
    });
  };
  
  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    const sourceData = {
      ...formData,
      customPercentile: parseInt(formData.customPercentile),
      manualThreshold: parseInt(formData.manualThreshold),
      checkFrequency: parseInt(formData.checkFrequency),
      maxNewsAgeMinutes: parseInt(formData.maxNewsAgeMinutes),
      postsToCheck: parseInt(formData.postsToCheck)
    };
    
    setSubmitted(true);
    if (id && id !== 'new') {
      dispatch(updateVkSource({ id, sourceData }));
    } else {
      dispatch(createVkSource(sourceData));
    }
  };
  
  // Handle clearing errors
  const handleErrorClose = () => {
    dispatch(clearVkSourcesError());
  };
  
  const isEditMode = id && id !== 'new';
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {isEditMode ? translate('Edit VK Source') : translate('Add VK Source')}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/app/sources')}
        >
          {translate('Back to Sources')}
        </Button>
      </Box>
      
      {error && <ApiErrorAlert error={error} onClose={handleErrorClose} />}
      
      <Paper sx={{ p: 3 }}>
        <Box component="form" onSubmit={handleSubmit}>
          <Typography variant="h6" gutterBottom>
            {translate('Source Details')}
          </Typography>
          
          <TextField
            fullWidth
            label={translate('VK Public Group Name')}
            name="name"
            value={formData.name}
            onChange={handleChange}
            margin="normal"
            required
            helperText={translate('Enter the exact name of the VK public group (e.g., \'techcrunch\')')}
          />
          
          <Divider sx={{ my: 3 }} />
          
          <PercentileSlider
            sourceId={id}
            value={formData.customPercentile}
            onChange={(newValue) => {
              setFormData({
                ...formData,
                customPercentile: newValue
              });
            }}
            disabled={loading}
          />
          
          <Divider sx={{ my: 3 }} />

          <TextField
            fullWidth
            label="Максимальный возраст новости (минуты)"
            name="maxNewsAgeMinutes"
            type="number"
            value={formData.maxNewsAgeMinutes}
            onChange={handleChange}
            margin="normal"
            inputProps={{ min: 1, max: 10080 }}
            helperText="Новости старше этого возраста будут игнорироваться. По умолчанию: 60 минут"
          />

          <Divider sx={{ my: 3 }} />
          
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.active}
                  onChange={handleChange}
                  name="active"
                  color="primary"
                />
              }
              label={translate('Active')}
            />
            <Typography variant="body2" color="textSecondary">
              {translate('When active, this source will be checked according to the frequency setting. Inactive sources will not be checked automatically.')}
            </Typography>
          </Box>
          
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="button"
              variant="outlined"
              onClick={() => navigate('/app/sources')}
              sx={{ mr: 2 }}
            >
              {translate('Cancel')}
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : translate('Save Source')}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default SourceForm; 
