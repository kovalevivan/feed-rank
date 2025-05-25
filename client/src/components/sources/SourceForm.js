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
import { useTranslation } from '../../translations/TranslationContext';

// Format number with thousands separators
const formatNumber = (num) => {
  return new Intl.NumberFormat().format(num);
};

// Component to display detailed threshold statistics
const ThresholdStats = ({ stats, loading }) => {
  const translate = useTranslation();
  
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
        {translate('No threshold statistics available. Calculate threshold to see detailed stats.')}
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
              {translate('Basic Statistics')}
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell><strong>{translate('Posts Analyzed')}</strong></TableCell>
                    <TableCell align="right">{stats.postsAnalyzed}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><strong>{translate('Mean (Average)')}</strong></TableCell>
                    <TableCell align="right">{formatNumber(detailedStats.mean)} {translate('views')}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><strong>{translate('Median')}</strong></TableCell>
                    <TableCell align="right">{formatNumber(detailedStats.median)} {translate('views')}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><strong>{translate('Standard Deviation')}</strong></TableCell>
                    <TableCell align="right">{formatNumber(detailedStats.standardDeviation)} {translate('views')}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><strong>{translate('Minimum')}</strong></TableCell>
                    <TableCell align="right">{formatNumber(detailedStats.min)} {translate('views')}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><strong>{translate('Maximum')}</strong></TableCell>
                    <TableCell align="right">{formatNumber(detailedStats.max)} {translate('views')}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              {translate('Percentiles')}
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell><strong>{translate('25th Percentile')}</strong></TableCell>
                    <TableCell align="right">{formatNumber(detailedStats.percentiles.p25)} {translate('views')}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><strong>{translate('50th Percentile (Median)')}</strong></TableCell>
                    <TableCell align="right">{formatNumber(detailedStats.percentiles.p50)} {translate('views')}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><strong>{translate('75th Percentile')}</strong></TableCell>
                    <TableCell align="right">{formatNumber(detailedStats.percentiles.p75)} {translate('views')}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><strong>{translate('90th Percentile')}</strong></TableCell>
                    <TableCell align="right">{formatNumber(detailedStats.percentiles.p90)} {translate('views')}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><strong>{translate('95th Percentile')}</strong></TableCell>
                    <TableCell align="right">{formatNumber(detailedStats.percentiles.p95)} {translate('views')}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><strong>{translate('99th Percentile')}</strong></TableCell>
                    <TableCell align="right">{formatNumber(detailedStats.percentiles.p99)} {translate('views')}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
          
          <Grid item xs={12}>
            <Alert severity="info" sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2">
                  <strong>{translate('Current calculated threshold')}:</strong> {formatNumber(stats.calculatedThreshold)} {translate('views')}
                </Typography>
                
                {stats.thresholdMethod === 'statistical' && stats.multiplier !== undefined && (
                  <Chip 
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ ml: 1 }}
                    label={`${translate('Using')} ${parseFloat(stats.multiplierUsed || stats.multiplier).toFixed(1)} × SD`}
                  />
                )}
              </Box>
            </Alert>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

// Advanced threshold calculator component
const AdvancedThresholdCalculator = ({ sourceId, loading, currentMethod, onCalculate, onMethodChange, initialMultiplier }) => {
  const translate = useTranslation();
  // Track if we've been initialized with source value
  const initializedRef = React.useRef(false);
  // Track if the user has made manual changes
  const userChangedValueRef = React.useRef(false);
  
  const [calculationParams, setCalculationParams] = useState({
    thresholdMethod: currentMethod || 'statistical',
    postsCount: 100,
    // Only use default 1.5 if initialMultiplier is explicitly null or undefined
    multiplier: initialMultiplier !== undefined && initialMultiplier !== null 
      ? parseFloat(initialMultiplier) 
      : 1.5
  });
  
  // Initialize multiplier from source ONLY on first load
  useEffect(() => {
    // Skip if user has manually changed the value or we already initialized
    if (userChangedValueRef.current || initializedRef.current) {
      return;
    }
    
    // Only update if initialMultiplier is a valid number
    const hasValidMultiplier = initialMultiplier !== undefined && 
                              initialMultiplier !== null && 
                              !isNaN(parseFloat(initialMultiplier));
    
    if (hasValidMultiplier) {
      const newMultiplier = parseFloat(initialMultiplier);
      console.log(`Initial load: setting multiplier to ${newMultiplier} from source`);
      
      initializedRef.current = true;
      
      setCalculationParams(prev => ({
        ...prev,
        multiplier: newMultiplier
      }));
    }
  }, [initialMultiplier]);
  
  // Update method when currentMethod changes
  useEffect(() => {
    if (currentMethod && currentMethod !== calculationParams.thresholdMethod) {
      setCalculationParams(prev => ({
        ...prev,
        thresholdMethod: currentMethod
      }));
    }
  }, [currentMethod, calculationParams.thresholdMethod]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Mark that user has made manual changes if changing multiplier
    if (name === 'multiplier') {
      userChangedValueRef.current = true;
    }
    
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
    console.log(`Slider changed: setting ${name} to ${value}`);
    
    // Mark that user has made manual changes when using slider
    if (name === 'multiplier') {
      userChangedValueRef.current = true;
    }
    
    setCalculationParams({
      ...calculationParams,
      [name]: value
    });
  };
  
  const handleSubmit = () => {
    // Get multiplier as numeric value, preserving zero
    const rawMultiplier = calculationParams.multiplier;
    console.log('Raw multiplier input:', rawMultiplier, typeof rawMultiplier);
    
    // Ensure multiplier is a valid number (default to 1.5 only as last resort)
    const multiplier = (rawMultiplier !== undefined && 
                       rawMultiplier !== null && 
                       rawMultiplier !== '' &&
                       !isNaN(parseFloat(rawMultiplier)))
      ? parseFloat(rawMultiplier)
      : 1.5;
    
    console.log('Parsed multiplier value:', multiplier);
    
    const params = {
      id: sourceId,
      params: {
        thresholdMethod: calculationParams.thresholdMethod,
        postsCount: parseInt(calculationParams.postsCount),
        multiplier: multiplier
      }
    };
    
    console.log('Submitting threshold calculation with params:', params);
    onCalculate(params);
  };
  
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {translate('Advanced Threshold Calculation')}
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControl component="fieldset" sx={{ mb: 2 }}>
              <FormLabel component="legend">{translate('Threshold Method')}</FormLabel>
              <RadioGroup
                row
                name="thresholdMethod"
                value={calculationParams.thresholdMethod}
                onChange={handleChange}
              >
                <Tooltip title={translate('Uses the simple average of views as threshold')}>
                  <FormControlLabel 
                    value="average" 
                    control={<Radio />} 
                    label={translate('Average (Mean)')}
                  />
                </Tooltip>
                <Tooltip title={translate('Uses Mean + 1.5 × Standard Deviation as threshold, better for identifying outlier posts')}>
                  <FormControlLabel 
                    value="statistical" 
                    control={<Radio />} 
                    label={translate('Statistical (Mean + SD)')}
                  />
                </Tooltip>
              </RadioGroup>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label={translate('Number of Posts to Analyze')}
              name="postsCount"
              type="number"
              value={calculationParams.postsCount}
              onChange={handleChange}
              InputProps={{
                inputProps: { min: 50, max: 1000 }
              }}
              helperText={translate('Min: 50, Max: 1000')}
            />
          </Grid>
          
          {calculationParams.thresholdMethod === 'statistical' && (
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" gutterBottom>
                {translate('Standard Deviation Multiplier')}
              </Typography>
              
              <Slider
                value={parseFloat(calculationParams.multiplier) || 1.5}
                onChange={handleSliderChange('multiplier')}
                onChangeCommitted={(e, value) => {
                  console.log(`Slider change committed: ${value}`);
                  userChangedValueRef.current = true;
                }}
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
              <TextField
                fullWidth
                label={translate('Exact Multiplier Value')}
                name="multiplier"
                type="number"
                value={calculationParams.multiplier}
                onChange={handleChange}
                margin="normal"
                InputProps={{
                  inputProps: { 
                    min: 0.5, 
                    max: 3.0,
                    step: 0.1
                  }
                }}
                helperText={translate('Enter a value between 0.5 and 3.0')}
                sx={{ mt: 2 }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {translate('Higher values make the threshold more strict (fewer posts will be considered viral)')}
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
                {translate('Calculate Threshold')}
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
  const translate = useTranslation();
  
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
    postsToCheck: 50,
    active: true,
    experimentalViewTracking: false,
    highDynamicsDetection: {
      enabled: true,
      growthRateThreshold: 30,
      minDataPoints: 2
    }
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
        postsToCheck: vkSource.postsToCheck || 50,
        active: vkSource.active !== undefined ? vkSource.active : true,
        experimentalViewTracking: vkSource.experimentalViewTracking || false,
        highDynamicsDetection: vkSource.highDynamicsDetection || {
          enabled: true,
          growthRateThreshold: 30,
          minDataPoints: 2
        }
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
      checkFrequency: parseInt(formData.checkFrequency),
      postsToCheck: parseInt(formData.postsToCheck)
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
    console.log('Source form received calculate threshold request with params:', params);
    
    // Ensure the multiplier is a number if present
    if (params.params && params.params.multiplier !== undefined) {
      const multiplier = parseFloat(params.params.multiplier);
      if (!isNaN(multiplier)) {
        params.params.multiplier = multiplier;
        console.log(`Ensuring multiplier is numeric: ${multiplier}`);
      }
    }
    
    dispatch(calculateThresholdAdvanced(params));
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
          onClick={() => navigate('/sources')}
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
          
          <Typography variant="h6" gutterBottom>
            {translate('Viral Threshold Settings')}
          </Typography>
          
          <FormControl component="fieldset" sx={{ mb: 2 }}>
            <FormLabel component="legend">{translate('Threshold Type')}</FormLabel>
            <RadioGroup
              name="thresholdType"
              value={formData.thresholdType}
              onChange={handleRadioChange}
              row
            >
              <FormControlLabel 
                value="auto" 
                control={<Radio />} 
                label={translate('Auto (calculated from data)')}
              />
              <FormControlLabel 
                value="manual" 
                control={<Radio />} 
                label={translate('Manual (set specific threshold)')}
              />
            </RadioGroup>
          </FormControl>
          
          {formData.thresholdType === 'manual' && (
            <TextField
              fullWidth
              label={translate('Viral Threshold')}
              name="manualThreshold"
              type="number"
              value={formData.manualThreshold}
              onChange={handleChange}
              margin="normal"
              required
              InputProps={{
                endAdornment: <InputAdornment position="end">{translate('views')}</InputAdornment>,
                inputProps: { min: 1 }
              }}
              helperText={translate('Posts with more views than this threshold will be considered viral')}
            />
          )}
          
          {isEditMode && formData.thresholdType === 'auto' && (
            <Box mt={2}>
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Chip 
                  label={`${translate('Current Threshold')}: ${formatNumber(vkSource?.calculatedThreshold || 0)} ${translate('views')}`}
                  color="primary"
                  variant="outlined"
                  size="medium"
                />
              </Box>
              
              {vkSource?.lastPostsData?.lastAnalysisDate && (
                <Typography variant="caption" display="block" mt={1} color="text.secondary">
                  {translate('Last calculated')}: {new Date(vkSource.lastPostsData.lastAnalysisDate).toLocaleString()}
                </Typography>
              )}
            </Box>
          )}
          
          <Divider sx={{ my: 3 }} />
          
          <Typography variant="h6" gutterBottom>
            {translate('Check Frequency')}
          </Typography>
          
          <TextField
            fullWidth
            label={translate('Check Frequency')}
            name="checkFrequency"
            type="number"
            value={formData.checkFrequency}
            onChange={handleChange}
            margin="normal"
            required
            InputProps={{
              endAdornment: <InputAdornment position="end">{translate('minutes')}</InputAdornment>,
              inputProps: { min: 5 }
            }}
            helperText={translate('How often to check for new posts (minimum 5 minutes, default 60 minutes)')}
          />
          
          <TextField
            fullWidth
            label={translate('Posts to Check')}
            name="postsToCheck"
            type="number"
            value={formData.postsToCheck}
            onChange={handleChange}
            margin="normal"
            required
            InputProps={{
              endAdornment: <InputAdornment position="end">{translate('posts')}</InputAdornment>,
              inputProps: { min: 10, max: 100 }
            }}
            helperText={translate('How many posts to check each time (minimum 10, maximum 100, default 50)')}
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
          
          <Divider sx={{ my: 3 }} />
          
          <Typography variant="h6" gutterBottom>
            {translate('Experimental Features')}
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.experimentalViewTracking}
                  onChange={handleChange}
                  name="experimentalViewTracking"
                  color="secondary"
                />
              }
              label={translate('Enable View Dynamics Tracking')}
            />
          </Box>
          
          {formData.experimentalViewTracking && (
            <Box sx={{ ml: 4, mb: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.highDynamicsDetection?.enabled ?? true}
                    onChange={(e) => setFormData({
                      ...formData,
                      highDynamicsDetection: {
                        ...formData.highDynamicsDetection,
                        enabled: e.target.checked
                      }
                    })}
                    name="highDynamicsDetectionEnabled"
                    color="secondary"
                  />
                }
                label={translate('Enable High Dynamics Detection')}
              />
              
              {formData.highDynamicsDetection?.enabled !== false && (
                <Box sx={{ mt: 2 }}>
                  <TextField
                    fullWidth
                    label={translate('Growth Rate Threshold')}
                    type="number"
                    value={formData.highDynamicsDetection?.growthRateThreshold ?? 30}
                    onChange={(e) => setFormData({
                      ...formData,
                      highDynamicsDetection: {
                        ...formData.highDynamicsDetection,
                        growthRateThreshold: parseInt(e.target.value)
                      }
                    })}
                    margin="normal"
                    InputProps={{
                      endAdornment: <InputAdornment position="end">{translate('views/min')}</InputAdornment>,
                      inputProps: { min: 10, max: 100 }
                    }}
                    helperText={translate('Posts growing faster than this rate will be sent early')}
                  />
                  
                  <TextField
                    fullWidth
                    label={translate('Minimum Data Points')}
                    type="number"
                    value={formData.highDynamicsDetection?.minDataPoints ?? 2}
                    onChange={(e) => setFormData({
                      ...formData,
                      highDynamicsDetection: {
                        ...formData.highDynamicsDetection,
                        minDataPoints: parseInt(e.target.value)
                      }
                    })}
                    margin="normal"
                    InputProps={{
                      inputProps: { min: 2, max: 10 }
                    }}
                    helperText={translate('Minimum view history entries needed before detecting high dynamics')}
                  />
                </Box>
              )}
            </Box>
          )}
          
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>{translate('Experimental')}</strong>: {translate('When enabled, the system will track view count changes over time for each post. This data will be included in Telegram messages to help analyze viral growth patterns. View history older than 4 days will be automatically cleaned up.')}
            </Typography>
          </Alert>
          
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="button"
              variant="outlined"
              onClick={() => navigate('/sources')}
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
                {translate('Threshold Statistics & Advanced Calculation')}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom>
                    {translate('Current Threshold Statistics')}
                  </Typography>
                  <ThresholdStats 
                    stats={thresholdStats} 
                    loading={thresholdStatsLoading} 
                  />
                </Grid>
                
                <Grid item xs={12} mt={2}>
                  <Typography variant="subtitle1" gutterBottom>
                    {translate('Advanced Calculation Options')}
                  </Typography>
                  {vkSource?.statisticalMultiplier !== undefined && (
                    <Box sx={{ 
                      display: 'flex', 
                      justifyContent: 'flex-end', 
                      mb: 1
                    }}>
                      <Chip
                        color="primary"
                        variant="outlined"
                        size="small"
                        label={`${translate('Current multiplier')}: ${parseFloat(vkSource.statisticalMultiplier).toFixed(1)}`}
                      />
                    </Box>
                  )}
                  <AdvancedThresholdCalculator 
                    sourceId={id} 
                    loading={calculatingThreshold} 
                    currentMethod={formData.thresholdMethod} 
                    onCalculate={handleCalculateThreshold} 
                    onMethodChange={handleThresholdMethodChange} 
                    initialMultiplier={vkSource?.statisticalMultiplier} 
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