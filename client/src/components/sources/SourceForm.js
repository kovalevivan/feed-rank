import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  InputAdornment,
  CircularProgress,
  Divider,
  Switch
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
  clearCurrentVkSource
} from '../../redux/slices/vkSourcesSlice';
import ApiErrorAlert from '../common/ApiErrorAlert';

const SourceForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const { vkSource, loading, error, success } = useSelector((state) => state.vkSources);
  
  // Local state for form
  const [formData, setFormData] = useState({
    name: '',
    thresholdType: 'auto',
    manualThreshold: 1000,
    checkFrequency: 60,
    active: true
  });
  
  // Load source data if editing
  useEffect(() => {
    if (id && id !== 'new') {
      dispatch(fetchVkSourceById(id));
    } else {
      dispatch(clearCurrentVkSource());
    }
    
    // Cleanup on unmount
    return () => {
      dispatch(clearCurrentVkSource());
      dispatch(clearVkSourcesError());
    };
  }, [id, dispatch]);
  
  // Update form data when source is loaded
  useEffect(() => {
    if (vkSource && id !== 'new') {
      setFormData({
        name: vkSource.name || '',
        thresholdType: vkSource.thresholdType || 'auto',
        manualThreshold: vkSource.manualThreshold || 1000,
        checkFrequency: vkSource.checkFrequency || 60,
        active: vkSource.active !== undefined ? vkSource.active : true
      });
    }
  }, [vkSource, id]);
  
  // Redirect after successful submission
  useEffect(() => {
    if (success) {
      navigate('/sources');
    }
  }, [success, navigate]);
  
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
      manualThreshold: parseInt(formData.manualThreshold),
      checkFrequency: parseInt(formData.checkFrequency)
    };
    
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
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {id === 'new' ? 'Add VK Source' : 'Edit VK Source'}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/sources')}
        >
          Back to Sources
        </Button>
      </Box>
      
      {error && <ApiErrorAlert error={error} onClose={handleErrorClose} />}
      
      <Paper sx={{ p: 3 }}>
        <Box component="form" onSubmit={handleSubmit}>
          <Typography variant="h6" gutterBottom>
            Source Details
          </Typography>
          
          <TextField
            fullWidth
            label="VK Public Group Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            margin="normal"
            required
            helperText="Enter the exact name of the VK public group (e.g., 'techcrunch')"
          />
          
          <Divider sx={{ my: 3 }} />
          
          <Typography variant="h6" gutterBottom>
            Viral Threshold Settings
          </Typography>
          
          <FormControl component="fieldset" sx={{ mb: 2 }}>
            <FormLabel component="legend">Threshold Type</FormLabel>
            <RadioGroup
              name="thresholdType"
              value={formData.thresholdType}
              onChange={handleRadioChange}
              row
            >
              <FormControlLabel 
                value="auto" 
                control={<Radio />} 
                label="Auto (calculated from average views)" 
              />
              <FormControlLabel 
                value="manual" 
                control={<Radio />} 
                label="Manual (set specific threshold)" 
              />
            </RadioGroup>
          </FormControl>
          
          {formData.thresholdType === 'manual' && (
            <TextField
              fullWidth
              label="Viral Threshold"
              name="manualThreshold"
              type="number"
              value={formData.manualThreshold}
              onChange={handleChange}
              margin="normal"
              required
              InputProps={{
                endAdornment: <InputAdornment position="end">views</InputAdornment>,
                inputProps: { min: 1 }
              }}
              helperText="Posts with more views than this threshold will be considered viral"
            />
          )}
          
          <Divider sx={{ my: 3 }} />
          
          <Typography variant="h6" gutterBottom>
            Check Frequency
          </Typography>
          
          <TextField
            fullWidth
            label="Check Frequency"
            name="checkFrequency"
            type="number"
            value={formData.checkFrequency}
            onChange={handleChange}
            margin="normal"
            required
            InputProps={{
              endAdornment: <InputAdornment position="end">minutes</InputAdornment>,
              inputProps: { min: 5 }
            }}
            helperText="How often to check for new posts (minimum 5 minutes, default 60 minutes)"
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
              label="Active"
            />
            <Typography variant="body2" color="textSecondary">
              When active, this source will be checked according to the frequency setting. 
              Inactive sources will not be checked automatically.
            </Typography>
          </Box>
          
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="button"
              variant="outlined"
              onClick={() => navigate('/sources')}
              sx={{ mr: 2 }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Save Source'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default SourceForm; 