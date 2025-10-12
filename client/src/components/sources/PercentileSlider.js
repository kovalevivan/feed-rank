import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Slider,
  CircularProgress,
  Alert,
  Paper,
  Chip,
  Stack
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon
} from '@mui/icons-material';
import axios from '../../api/axios';

const PercentileSlider = ({ sourceId, value, onChange, disabled = false }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedValue, setSelectedValue] = useState(value || 90);

  // Load percentile statistics
  useEffect(() => {
    if (!sourceId || sourceId === 'new') {
      setLoading(false);
      return;
    }

    const loadStats = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/vk-sources/${sourceId}/percentile-stats`);
        setStats(response.data);
        setError(null);
      } catch (err) {
        console.error('Error loading percentile stats:', err);
        setError(err.response?.data?.message || 'Failed to load statistics');
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [sourceId]);

  // Update selected value when prop changes
  useEffect(() => {
    if (value !== undefined) {
      setSelectedValue(value);
    }
  }, [value]);

  const handleSliderChange = (event, newValue) => {
    setSelectedValue(newValue);
  };

  const handleSliderChangeCommitted = (event, newValue) => {
    if (onChange) {
      onChange(newValue);
    }
  };

  // Find closest percentile data for selected value
  const getDataForPercentile = (percentile) => {
    if (!stats || !stats.percentiles) return null;
    
    // Find exact match or closest
    const exact = stats.percentiles.find(p => p.percentile === percentile);
    if (exact) return exact;
    
    // Find closest by linear interpolation
    const sorted = [...stats.percentiles].sort((a, b) => a.percentile - b.percentile);
    
    // Handle values below minimum
    if (percentile < sorted[0].percentile) {
      // Extrapolate using first two points
      if (sorted.length >= 2) {
        const p1 = sorted[0];
        const p2 = sorted[1];
        const ratio = (percentile - p1.percentile) / (p2.percentile - p1.percentile);
        
        return {
          percentile,
          threshold: Math.max(0, Math.round(p1.threshold + (p2.threshold - p1.threshold) * ratio)),
          viralCount: Math.max(0, Math.round(p1.viralCount + (p2.viralCount - p1.viralCount) * ratio)),
          viralPercent: Math.max(0, parseFloat((p1.viralPercent + (p2.viralPercent - p1.viralPercent) * ratio).toFixed(1))),
          postsPerWeek: Math.max(0, Math.round(p1.postsPerWeek + (p2.postsPerWeek - p1.postsPerWeek) * ratio))
        };
      }
      return sorted[0];
    }
    
    // Handle values above maximum
    if (percentile > sorted[sorted.length - 1].percentile) {
      // Extrapolate using last two points
      if (sorted.length >= 2) {
        const p1 = sorted[sorted.length - 2];
        const p2 = sorted[sorted.length - 1];
        const ratio = (percentile - p1.percentile) / (p2.percentile - p1.percentile);
        
        return {
          percentile,
          threshold: Math.max(0, Math.round(p1.threshold + (p2.threshold - p1.threshold) * ratio)),
          viralCount: Math.max(0, Math.round(p1.viralCount + (p2.viralCount - p1.viralCount) * ratio)),
          viralPercent: Math.max(0, parseFloat((p1.viralPercent + (p2.viralPercent - p1.viralPercent) * ratio).toFixed(1))),
          postsPerWeek: Math.max(0, Math.round(p1.postsPerWeek + (p2.postsPerWeek - p1.postsPerWeek) * ratio))
        };
      }
      return sorted[sorted.length - 1];
    }
    
    // Interpolate between two points
    for (let i = 0; i < sorted.length - 1; i++) {
      if (percentile >= sorted[i].percentile && percentile <= sorted[i + 1].percentile) {
        const lower = sorted[i];
        const upper = sorted[i + 1];
        const ratio = (percentile - lower.percentile) / (upper.percentile - lower.percentile);
        
        return {
          percentile,
          threshold: Math.round(lower.threshold + (upper.threshold - lower.threshold) * ratio),
          viralCount: Math.round(lower.viralCount + (upper.viralCount - lower.viralCount) * ratio),
          viralPercent: parseFloat((lower.viralPercent + (upper.viralPercent - lower.viralPercent) * ratio).toFixed(1)),
          postsPerWeek: Math.round(lower.postsPerWeek + (upper.postsPerWeek - lower.postsPerWeek) * ratio)
        };
      }
    }
    
    // Fallback (should never reach here)
    return sorted[sorted.length - 1];
  };

  const selectedData = getDataForPercentile(selectedValue);
  const currentData = stats ? getDataForPercentile(stats.currentPercentile) : null;

  // Get label for percentile
  const getPercentileLabel = (percentile) => {
    if (percentile <= 60) return 'Максимум постов';
    if (percentile <= 75) return 'Много постов';
    if (percentile <= 85) return 'Средне';
    if (percentile <= 92) return 'Выборочно';
    return 'Только лучшее';
  };

  // Get color for percentile
  const getPercentileColor = (percentile) => {
    if (percentile <= 60) return 'error';
    if (percentile <= 75) return 'warning';
    if (percentile <= 85) return 'info';
    if (percentile <= 92) return 'success';
    return 'primary';
  };

  if (sourceId === 'new') {
    return (
      <Alert severity="info">
        Настройка количества постов будет доступна после создания источника
      </Alert>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">{error}</Alert>
    );
  }

  if (!stats || !stats.available) {
    return (
      <Alert severity="warning">
        {stats?.message || 'Недостаточно данных для расчёта статистики. Попробуйте позже.'}
      </Alert>
    );
  }

  return (
    <Paper elevation={0} sx={{ p: 3, bgcolor: 'grey.50', border: '1px solid', borderColor: 'grey.200' }}>
      <Typography variant="h6" gutterBottom>
        Настройка количества постов
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Выберите, сколько постов в неделю вы хотите получать из этого источника
      </Typography>

      <Box sx={{ px: 2, mb: 4 }}>
        <Slider
          value={selectedValue}
          onChange={handleSliderChange}
          onChangeCommitted={handleSliderChangeCommitted}
          min={50}
          max={97}
          step={1}
          marks={[
            { value: 50, label: 'Больше' },
            { value: 75, label: '' },
            { value: 90, label: '' },
            { value: 97, label: 'Меньше' }
          ]}
          disabled={disabled}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => `p${value}`}
          sx={{
            '& .MuiSlider-thumb': {
              width: 24,
              height: 24,
            },
            '& .MuiSlider-track': {
              height: 6,
            },
            '& .MuiSlider-rail': {
              height: 6,
            }
          }}
        />
      </Box>

      {selectedData && (
        <Box sx={{ mt: 3 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <Chip 
              label={getPercentileLabel(selectedValue)}
              color={getPercentileColor(selectedValue)}
              size="small"
            />
            <Typography variant="body2" color="text.secondary">
              (p{selectedValue})
            </Typography>
          </Stack>

          <Box sx={{ 
            p: 2, 
            bgcolor: 'background.paper', 
            borderRadius: 1,
            border: '2px solid',
            borderColor: selectedValue !== stats.currentPercentile ? 'primary.main' : 'grey.300'
          }}>
            <Stack spacing={1.5}>
              <Box>
                <Typography variant="h4" color="primary.main" sx={{ fontWeight: 'bold' }}>
                  ~{selectedData.postsPerWeek} {selectedData.postsPerWeek === 1 ? 'пост' : selectedData.postsPerWeek < 5 ? 'поста' : 'постов'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  в неделю из этого источника
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Порог виральности:
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                    {selectedData.threshold.toLocaleString()} просмотров
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Топ постов:
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                    {selectedData.viralPercent}%
                  </Typography>
                </Box>
              </Box>

              {currentData && selectedValue !== stats.currentPercentile && (
                <Alert 
                  severity="info" 
                  icon={selectedData.postsPerWeek > currentData.postsPerWeek ? <TrendingUpIcon /> : <TrendingDownIcon />}
                  sx={{ mt: 1 }}
                >
                  {selectedData.postsPerWeek > currentData.postsPerWeek ? (
                    <>Вы будете получать <strong>больше</strong> постов (сейчас ~{currentData.postsPerWeek}/неделю)</>
                  ) : selectedData.postsPerWeek < currentData.postsPerWeek ? (
                    <>Вы будете получать <strong>меньше</strong> постов (сейчас ~{currentData.postsPerWeek}/неделю)</>
                  ) : (
                    <>Количество постов примерно такое же (~{currentData.postsPerWeek}/неделю)</>
                  )}
                </Alert>
              )}
            </Stack>
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            На основе данных за последние {stats.daysAnalyzed} дней ({stats.postsAnalyzed} постов)
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default PercentileSlider;

