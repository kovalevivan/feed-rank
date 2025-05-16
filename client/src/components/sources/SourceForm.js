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
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Card,
  CardContent,
  Grid,
  Slider,
  Alert,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  ShowChart as ShowChartIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import {
  fetchVkSourceById,
  createVkSource,
  updateVkSource,
  clearVkSourcesError,
  clearCurrentVkSource,
  calculateThresholdAdvanced,
  getThresholdStats
} from '../../redux/slices/vkSourcesSlice';
import ApiErrorAlert from '../common/ApiErrorAlert';

// Format number with thousands separators
const formatNumber = (num) => {
  return new Intl.NumberFormat().format(num);
};

// Component to display detailed threshold statistics
const ThresholdStats = ({ stats, loading }) => {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (!stats || !stats.detailedStats) {
    return (
      <Alert severity="info">
        No threshold statistics available. Calculate threshold to see detailed stats.
      </Alert>
    );
  }
  
  const { detailedStats } = stats;
  
  return (
    <Card variant="outlined">
      <CardContent>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Basic Statistics
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell><strong>Posts Analyzed</strong></TableCell>
                    <TableCell align="right">{stats.postsAnalyzed}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><strong>Mean (Average)</strong></TableCell>
                    <TableCell align="right">{formatNumber(detailedStats.mean)} views</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><strong>Median</strong></TableCell>
                    <TableCell align="right">{formatNumber(detailedStats.median)} views</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><strong>Standard Deviation</strong></TableCell>
                    <TableCell align="right">{formatNumber(detailedStats.standardDeviation)} views</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><strong>Minimum</strong></TableCell>
                    <TableCell align="right">{formatNumber(detailedStats.min)} views</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><strong>Maximum</strong></TableCell>
                    <TableCell align="right">{formatNumber(detailedStats.max)} views</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Percentiles
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell><strong>25th Percentile</strong></TableCell>
                    <TableCell align="right">{formatNumber(detailedStats.percentiles.p25)} views</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><strong>50th Percentile (Median)</strong></TableCell>
                    <TableCell align="right">{formatNumber(detailedStats.percentiles.p50)} views</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><strong>75th Percentile</strong></TableCell>
                    <TableCell align="right">{formatNumber(detailedStats.percentiles.p75)} views</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><strong>90th Percentile</strong></TableCell>
                    <TableCell align="right">{formatNumber(detailedStats.percentiles.p90)} views</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><strong>95th Percentile</strong></TableCell>
                    <TableCell align="right">{formatNumber(detailedStats.percentiles.p95)} views</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><strong>99th Percentile</strong></TableCell>
                    <TableCell align="right">{formatNumber(detailedStats.percentiles.p99)} views</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
          
          <Grid item xs={12}>
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Current calculated threshold:</strong> {formatNumber(stats.calculatedThreshold)} views
                {stats.thresholdMethod === 'statistical' && stats.multiplier && (
                  <span> (using {stats.multiplier} × standard deviation)</span>
                )}
              </Typography>
            </Alert>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

// Advanced threshold calculator component
const AdvancedThresholdCalculator = ({ sourceId, loading, currentMethod, onCalculate, onMethodChange }) => {
  const [calculationParams, setCalculationParams] = useState({
    thresholdMethod: currentMethod || 'statistical',
    postsCount: 100,
    multiplier: 1.5
  });
  
  // Update params when currentMethod changes
  useEffect(() => {
    if (currentMethod && currentMethod !== calculationParams.thresholdMethod) {
      setCalculationParams(prev => ({
        ...prev,
        thresholdMethod: currentMethod
      }));
    }
  }, [currentMethod]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setCalculationParams({
      ...calculationParams,
      [name]: value
    });
    
    // If threshold method changes, notify parent
    if (name === 'thresholdMethod' && onMethodChange) {
      onMethodChange(value);
    }
  };
  
  const handleSliderChange = (name) => (e, value) => {
    setCalculationParams({
      ...calculationParams,
      [name]: value
    });
  };
  
  const handleSubmit = () => {
    onCalculate({
      id: sourceId,
      params: {
        thresholdMethod: calculationParams.thresholdMethod,
        postsCount: parseInt(calculationParams.postsCount),
        multiplier: parseFloat(calculationParams.multiplier)
      }
    });
  };
  
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Advanced Threshold Calculation
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControl component="fieldset" sx={{ mb: 2 }}>
              <FormLabel component="legend">Threshold Method</FormLabel>
              <RadioGroup
                row
                name="thresholdMethod"
                value={calculationParams.thresholdMethod}
                onChange={handleChange}
              >
                <Tooltip title="Uses the simple average of views as threshold">
                  <FormControlLabel 
                    value="average" 
                    control={<Radio />} 
                    label="Average (Mean)" 
                  />
                </Tooltip>
                <Tooltip title="Uses Mean + 1.5 × Standard Deviation as threshold, better for identifying outlier posts">
                  <FormControlLabel 
                    value="statistical" 
                    control={<Radio />} 
                    label="Statistical (Mean + SD)" 
                  />
                </Tooltip>
              </RadioGroup>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Number of Posts to Analyze"
              name="postsCount"
              type="number"
              value={calculationParams.postsCount}
              onChange={handleChange}
              InputProps={{
                inputProps: { min: 50, max: 1000 }
              }}
              helperText="Min: 50, Max: 1000"
            />
          </Grid>
          
          {calculationParams.thresholdMethod === 'statistical' && (
            <Grid item xs={12} sm={6}>
              <Typography id="multiplier-slider" gutterBottom>
                Standard Deviation Multiplier: {calculationParams.multiplier}
              </Typography>
              <Slider
                value={calculationParams.multiplier}
                onChange={handleSliderChange('multiplier')}
                aria-labelledby="multiplier-slider"
                step={0.1}
                marks={[
                  { value: 0.5, label: '0.5' },
                  { value: 1.0, label: '1.0' },
                  { value: 1.5, label: '1.5' },
                  { value: 2.0, label: '2.0' },
                  { value: 2.5, label: '2.5' },
                  { value: 3.0, label: '3.0' }
                ]}
                min={0.5}
                max={3.0}
              />
              <Typography variant="body2" color="textSecondary">
                Higher values make the threshold more strict (fewer posts will be considered viral)
              </Typography>
            </Grid>
          )}
          
          <Grid item xs={12}>
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSubmit}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <ShowChartIcon />}
              >
                Calculate Threshold
              </Button>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

const SourceForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const { 
    vkSource, 
    loading, 
    error, 
    success, 
    thresholdStats, 
    calculatingThreshold, 
    thresholdStatsLoading 
  } = useSelector((state) => state.vkSources);
  
  // Local state for form
  const [formData, setFormData] = useState({
    name: '',
    thresholdType: 'auto',
    thresholdMethod: 'statistical',
    manualThreshold: 1000,
    checkFrequency: 60,
    active: true
  });
  
  // Load source data if editing
  useEffect(() => {
    if (id && id !== 'new') {
      dispatch(fetchVkSourceById(id));
      
      // Load threshold stats if editing existing source
      dispatch(getThresholdStats(id));
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
        thresholdMethod: vkSource.thresholdMethod || 'statistical',
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
  
  // Handle threshold method change
  const handleThresholdMethodChange = (value) => {
    setFormData(prev => ({
      ...prev,
      thresholdMethod: value
    }));
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
  
  // Handle threshold calculation
  const handleCalculateThreshold = (params) => {
    dispatch(calculateThresholdAdvanced(params));
  };
  
  const isEditMode = id && id !== 'new';
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {isEditMode ? 'Edit VK Source' : 'Add VK Source'}
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
                label="Auto (calculated from data)" 
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
          
          {isEditMode && formData.thresholdType === 'auto' && (
            <Box mt={2}>
              <Chip 
                label={`Current Threshold: ${formatNumber(vkSource?.calculatedThreshold || 0)} views`}
                color="primary"
                variant="outlined"
              />
              {vkSource?.lastPostsData?.lastAnalysisDate && (
                <Typography variant="caption" display="block" mt={1}>
                  Last calculated: {new Date(vkSource.lastPostsData.lastAnalysisDate).toLocaleString()}
                </Typography>
              )}
              <Typography variant="caption" display="block" color="textSecondary">
                Method: {formData.thresholdMethod === 'statistical' ? 'Statistical (Mean + SD)' : 'Average (Mean)'}
              </Typography>
            </Box>
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
      
      {/* Threshold Statistics section - only show for existing sources */}
      {isEditMode && (
        <Box mt={4}>
          <Accordion defaultExpanded>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="threshold-stats-content"
              id="threshold-stats-header"
            >
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                <ShowChartIcon sx={{ mr: 1 }} />
                Threshold Statistics & Advanced Calculation
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom>
                    Current Threshold Statistics
                  </Typography>
                  <ThresholdStats 
                    stats={thresholdStats} 
                    loading={thresholdStatsLoading} 
                  />
                </Grid>
                
                <Grid item xs={12} mt={2}>
                  <Typography variant="subtitle1" gutterBottom>
                    Advanced Calculation Options
                  </Typography>
                  <AdvancedThresholdCalculator 
                    sourceId={id} 
                    loading={calculatingThreshold} 
                    currentMethod={formData.thresholdMethod} 
                    onCalculate={handleCalculateThreshold} 
                    onMethodChange={handleThresholdMethodChange} 
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Box>
      )}
    </Box>
  );
};

export default SourceForm; 