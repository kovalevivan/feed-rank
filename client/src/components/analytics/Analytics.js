import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  Tooltip,
  IconButton,
  Divider
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Speed as SpeedIcon,
  Timeline as TimelineIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import {
  fetchExperimentalSources,
  fetchSourceDynamics,
  fetchAggregatedDynamics,
  clearError
} from '../../redux/slices/analyticsSlice';
import { useTranslation } from '../../translations/TranslationContext';
import ApiErrorAlert from '../common/ApiErrorAlert';

const Analytics = () => {
  const dispatch = useDispatch();
  const translate = useTranslation();
  
  const {
    experimentalSources,
    selectedSourceDynamics,
    aggregatedDynamics,
    loading,
    sourceDynamicsLoading,
    aggregatedLoading,
    error
  } = useSelector((state) => state.analytics);
  
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [timeRange, setTimeRange] = useState(7);
  
  // Load experimental sources on mount
  useEffect(() => {
    dispatch(fetchExperimentalSources());
    dispatch(fetchAggregatedDynamics());
  }, [dispatch]);
  
  // Load source dynamics when source is selected
  useEffect(() => {
    if (selectedSourceId) {
      dispatch(fetchSourceDynamics({ sourceId: selectedSourceId, days: timeRange }));
    }
  }, [dispatch, selectedSourceId, timeRange]);
  
  const handleSourceChange = (event) => {
    setSelectedSourceId(event.target.value);
  };
  
  const handleTimeRangeChange = (event) => {
    setTimeRange(event.target.value);
  };
  
  const handleRefresh = () => {
    dispatch(fetchExperimentalSources());
    dispatch(fetchAggregatedDynamics());
    if (selectedSourceId) {
      dispatch(fetchSourceDynamics({ sourceId: selectedSourceId, days: timeRange }));
    }
  };
  
  const handleErrorClose = () => {
    dispatch(clearError());
  };
  
  const formatGrowthRate = (rate) => {
    return rate ? rate.toFixed(2) : '0.00';
  };
  
  const getGrowthRateColor = (rate) => {
    if (rate > 50) return 'error';
    if (rate > 20) return 'warning';
    if (rate > 10) return 'success';
    return 'default';
  };
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{translate('Post Dynamics Analytics')}</Typography>
        <IconButton onClick={handleRefresh} disabled={loading || aggregatedLoading}>
          <RefreshIcon />
        </IconButton>
      </Box>
      
      {error && <ApiErrorAlert error={error} onClose={handleErrorClose} />}
      
      {experimentalSources.length === 0 && !loading ? (
        <Alert severity="info">
          {translate('No sources with experimental view tracking enabled. Enable view tracking for at least one source to see analytics.')}
        </Alert>
      ) : (
        <>
          {/* Source Selection */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>{translate('Select Source')}</InputLabel>
                  <Select
                    value={selectedSourceId}
                    onChange={handleSourceChange}
                    label={translate('Select Source')}
                    disabled={loading}
                  >
                    <MenuItem value="">
                      <em>{translate('All Sources (Aggregated)')}</em>
                    </MenuItem>
                    {experimentalSources.map((source) => (
                      <MenuItem key={source._id} value={source._id}>
                        {source.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>{translate('Time Range')}</InputLabel>
                  <Select
                    value={timeRange}
                    onChange={handleTimeRangeChange}
                    label={translate('Time Range')}
                  >
                    <MenuItem value={1}>{translate('Last 24 hours')}</MenuItem>
                    <MenuItem value={3}>{translate('Last 3 days')}</MenuItem>
                    <MenuItem value={7}>{translate('Last 7 days')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <Alert severity="info" icon={<InfoIcon />}>
                  <Typography variant="body2">
                    {translate('Experimental Feature')}
                  </Typography>
                </Alert>
              </Grid>
            </Grid>
          </Paper>
          
          {/* Aggregated Statistics */}
          {!selectedSourceId && aggregatedDynamics && (
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  {translate('Aggregated Growth Statistics')}
                </Typography>
              </Grid>
              {aggregatedLoading ? (
                <Grid item xs={12}>
                  <LinearProgress />
                </Grid>
              ) : (
                aggregatedDynamics.data.map((source) => (
                  <Grid item xs={12} md={6} lg={4} key={source.sourceId}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          {source.sourceName}
                        </Typography>
                        <Box sx={{ mt: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              {translate('Avg Growth Rate')}
                            </Typography>
                            <Chip
                              label={`${formatGrowthRate(source.averageGrowthRate)} ${translate('views/min')}`}
                              color={getGrowthRateColor(source.averageGrowthRate)}
                              size="small"
                            />
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              {translate('Max Growth Rate')}
                            </Typography>
                            <Typography variant="body2">
                              {formatGrowthRate(source.maxGrowthRate)} {translate('views/min')}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              {translate('90th Percentile')}
                            </Typography>
                            <Typography variant="body2">
                              {formatGrowthRate(source.percentile90)} {translate('views/min')}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2" color="text.secondary">
                              {translate('Data Points')}
                            </Typography>
                            <Typography variant="body2">
                              {source.totalDataPoints}
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))
              )}
            </Grid>
          )}
          
          {/* Source-specific Dynamics */}
          {selectedSourceId && selectedSourceDynamics && (
            <>
              {/* Growth Pattern Summary */}
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    {selectedSourceDynamics.source.name} - {translate('Growth Patterns')}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <TrendingUpIcon color="primary" sx={{ mr: 1 }} />
                        <Typography variant="subtitle2">
                          {translate('Average Growth')}
                        </Typography>
                      </Box>
                      <Typography variant="h4">
                        {formatGrowthRate(selectedSourceDynamics.growthPatterns.overallAverage)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {translate('views/min')}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <SpeedIcon color="warning" sx={{ mr: 1 }} />
                        <Typography variant="subtitle2">
                          {translate('90th Percentile')}
                        </Typography>
                      </Box>
                      <Typography variant="h4">
                        {formatGrowthRate(selectedSourceDynamics.growthPatterns.percentile90)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {translate('views/min')}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <TimelineIcon color="success" sx={{ mr: 1 }} />
                        <Typography variant="subtitle2">
                          {translate('Viral Threshold')}
                        </Typography>
                      </Box>
                      <Typography variant="h4">
                        {selectedSourceDynamics.source.calculatedThreshold.toLocaleString()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {translate('views')}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <InfoIcon color="info" sx={{ mr: 1 }} />
                        <Typography variant="subtitle2">
                          {translate('Posts Analyzed')}
                        </Typography>
                      </Box>
                      <Typography variant="h4">
                        {selectedSourceDynamics.source.postsAnalyzed}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {translate('in last')} {timeRange} {translate('days')}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
              
              {/* Post Metrics Table */}
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  {translate('Individual Post Dynamics')}
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>{translate('Post')}</TableCell>
                        <TableCell align="right">{translate('Current Views')}</TableCell>
                        <TableCell align="right">{translate('Avg Growth Rate')}</TableCell>
                        <TableCell align="right">{translate('Max Growth Rate')}</TableCell>
                        <TableCell align="right">{translate('Total Growth')}</TableCell>
                        <TableCell align="center">{translate('Status')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sourceDynamicsLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} align="center">
                            <CircularProgress />
                          </TableCell>
                        </TableRow>
                      ) : (
                        selectedSourceDynamics.postMetrics.map((post) => (
                          <TableRow key={post.postId}>
                            <TableCell>
                              <Tooltip title={post.text}>
                                <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                                  {post.text}
                                </Typography>
                              </Tooltip>
                            </TableCell>
                            <TableCell align="right">
                              {post.currentViews.toLocaleString()}
                            </TableCell>
                            <TableCell align="right">
                              <Chip
                                label={`${formatGrowthRate(post.averageGrowthRate)} ${translate('views/min')}`}
                                color={getGrowthRateColor(post.averageGrowthRate)}
                                size="small"
                              />
                            </TableCell>
                            <TableCell align="right">
                              {formatGrowthRate(post.maxGrowthRate)} {translate('views/min')}
                            </TableCell>
                            <TableCell align="right">
                              +{post.totalGrowth.toLocaleString()}
                            </TableCell>
                            <TableCell align="center">
                              {post.isViral ? (
                                <Chip label={translate('Viral')} color="error" size="small" />
                              ) : (
                                <Chip label={translate('Normal')} color="default" size="small" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </>
          )}
        </>
      )}
    </Box>
  );
};

export default Analytics; 