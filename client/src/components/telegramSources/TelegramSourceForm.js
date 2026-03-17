import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  FormControlLabel,
  Switch,
  Divider,
  Grid,
  Chip,
  InputAdornment,
  FormControl,
  FormLabel,
  RadioGroup,
  Radio,
  Select,
  MenuItem,
  Autocomplete,
  CircularProgress,
  Card,
  CardContent,
  Slider
} from '@mui/material';
import axios from 'axios';

const TelegramSourceForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [formData, setFormData] = useState({
    name: '',
    chatId: '',
    username: '',
    type: 'channel',
    thresholdType: 'manual',
    manualThreshold: 50,
    calculatedThreshold: null,
    thresholdMethod: 'statistical',
    statisticalMultiplier: 0.5,
    viralDetectionMetric: 'reactions',
    active: true,
    reactionWeight: 1,
    commentWeight: 2,
    forwardWeight: 3,
    checkFrequency: 60
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [subscriptions, setSubscriptions] = useState([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState(null);
  const [calculatingThreshold, setCalculatingThreshold] = useState(false);
  const [multiplierError, setMultiplierError] = useState('');
  const [thresholdCalculated, setThresholdCalculated] = useState(false);

  const hasSourceIdentifier = Boolean(formData.chatId || formData.username);

  // Load subscriptions on component mount
  useEffect(() => {
    const loadSubscriptions = async () => {
      try {
        setLoadingSubscriptions(true);
        const response = await axios.get('/api/telegram-sources/subscriptions/list');
        setSubscriptions(response.data.subscriptions || []);
      } catch (err) {
        console.error('Error loading subscriptions:', err);
        // Don't show error for subscriptions as it's optional
      } finally {
        setLoadingSubscriptions(false);
      }
    };
    
    loadSubscriptions();
  }, []);

  // Load source data if editing
  useEffect(() => {
    if (isEditing) {
      const loadSource = async () => {
        try {
          setLoading(true);
          const response = await axios.get(`/api/telegram-sources/${id}`);
          const sourceData = response.data;
          setFormData(sourceData);
          
          // Find matching subscription if exists
          if (sourceData.chatId && subscriptions.length > 0) {
            const matchingSubscription = subscriptions.find(
              sub => sub.chatId === sourceData.chatId || sub.username === sourceData.username
            );
            if (matchingSubscription) {
              setSelectedSubscription(matchingSubscription);
            }
          }
        } catch (err) {
          console.error('Error loading Telegram source:', err);
          setError('Не удалось загрузить Telegram источник');
        } finally {
          setLoading(false);
        }
      };
      loadSource();
    }
  }, [id, isEditing, subscriptions]);

  const handleInputChange = (field) => (event) => {
    let value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;

    if (field === 'username' && typeof value === 'string') {
      value = value
        .trim()
        .replace(/^https?:\/\/?/i, '')
        .replace(/^t\.me\//i, '')
        .replace(/^@/, '');
    }

    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear general error when user starts typing
    if (error) setError('');
    
    // Reset threshold calculation when relevant fields change
    if (['thresholdMethod', 'statisticalMultiplier'].includes(field)) {
      setThresholdCalculated(false);
    }
    
    // Validate statistical multiplier on change
    if (field === 'statisticalMultiplier') {
      setMultiplierError('');
      if (value) {
        const multiplier = parseFloat(value.toString().replace(',', '.'));
        if (isNaN(multiplier)) {
          setMultiplierError('Введите корректное число');
        } else if (multiplier < 0.1 || multiplier > 5.0) {
          setMultiplierError('Значение должно быть от 0.1 до 5.0');
        }
      }
    }
  };

  const handleSubscriptionSelect = (event, newValue) => {
    setSelectedSubscription(newValue);
    setThresholdCalculated(false); // Reset threshold calculation when channel changes
    if (newValue) {
      setFormData(prev => ({
        ...prev,
        name: newValue.title,
        chatId: newValue.chatId,
        username: newValue.username?.replace('@', '') || '',
        type: newValue.type
      }));
    }
  };

  const handleCalculateThreshold = async () => {
    if (!formData.chatId) {
      setError('Сначала выберите канал/группу');
      return;
    }
    
    // Check if there's already a multiplier error
    if (multiplierError) {
      return;
    }

    try {
      setCalculatingThreshold(true);
      setError('');
      
      // Parse multiplier, handling both comma and dot as decimal separators
      let multiplier = parseFloat(formData.statisticalMultiplier.toString().replace(',', '.'));
      
      // Validate multiplier on frontend
      if (isNaN(multiplier) || multiplier < 0.1 || multiplier > 5.0) {
        setMultiplierError('Значение должно быть от 0.1 до 5.0');
        return;
      }
      
      const response = await axios.post(`/api/telegram-sources/calculate-threshold`, {
        chatId: formData.chatId,
        username: formData.username,
        thresholdMethod: formData.thresholdMethod,
        statisticalMultiplier: multiplier,
        postsCount: 100,
        saveToSource: isEditing // Save to database if editing existing source
      });

      setFormData(prev => ({
        ...prev,
        calculatedThreshold: response.data.threshold
      }));
      
      setThresholdCalculated(true);
      
      const successMessage = response.data.percentile 
        ? `Порог рассчитан: ${response.data.threshold} (${response.data.percentile}й процентиль)`
        : `Порог рассчитан: ${response.data.threshold} (множитель: ${multiplier})`;
      setSuccess(successMessage);
    } catch (err) {
      console.error('Error calculating threshold:', err);
      setError(err.response?.data?.message || 'Не удалось рассчитать порог');
    } finally {
      setCalculatingThreshold(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Validate required fields
      if (!formData.name || !hasSourceIdentifier) {
        setError('Укажите название источника и username или chat ID канала');
        return;
      }

      const submitData = {
        ...formData,
        // Ensure numeric fields are properly converted
        manualThreshold: parseInt(formData.manualThreshold) || 50,
        statisticalMultiplier: parseFloat(formData.statisticalMultiplier.toString().replace(',', '.')) || 0.5,
        reactionWeight: parseFloat(formData.reactionWeight.toString().replace(',', '.')) || 1,
        commentWeight: parseFloat(formData.commentWeight.toString().replace(',', '.')) || 2,
        forwardWeight: parseFloat(formData.forwardWeight.toString().replace(',', '.')) || 3,
        checkFrequency: parseInt(formData.checkFrequency) || 60
      };

      if (isEditing) {
        await axios.put(`/api/telegram-sources/${id}`, submitData);
        setSuccess('Telegram источник успешно обновлен!');
        navigate('/app/sources');
      } else {
        await axios.post('/api/telegram-sources', submitData);
        setSuccess('Telegram источник успешно создан!');
        setTimeout(() => {
          navigate('/app/sources');
        }, 1500);
      }
    } catch (err) {
      console.error('Error saving Telegram source:', err);
      setError(err.response?.data?.message || 'Не удалось сохранить Telegram источник');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/app/sources');
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 2, mb: 2 }}>
        <Paper elevation={3} sx={{ p: 2 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            {isEditing ? 'Редактировать Telegram источник' : 'Добавить новый Telegram источник'}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Channel Selection */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Выбор канала/группы
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>

              <Grid item xs={12}>
                <Autocomplete
                  value={selectedSubscription}
                  onChange={handleSubscriptionSelect}
                  options={subscriptions}
                  getOptionLabel={(option) => `${option.title} ${option.username ? `(${option.username})` : ''}`}
                  loading={loadingSubscriptions}
                  disabled={isEditing}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={isEditing ? "Канал/группа (только для чтения)" : "Выберите канал/группу из подписок"}
                      helperText={isEditing ? "Канал нельзя изменить при редактировании" : "Выберите канал или группу из ваших подписок Telegram"}
                      required={!isEditing}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {loadingSubscriptions ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Box>
                        <Typography variant="body1">{option.title}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {option.username} • {option.type} • {option.participantsCount} участников
                        </Typography>
                      </Box>
                    </Box>
                  )}
                  noOptionsText={loadingSubscriptions ? "Загрузка..." : "Подписки не найдены"}
                />
              </Grid>

              {!isEditing && (
                <>
                  <Grid item xs={12}>
                    <Alert severity="info">
                      Можно либо выбрать канал из подписок Telegram Client API, либо ввести публичный username / chat ID вручную.
                    </Alert>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Username канала"
                      value={formData.username}
                      onChange={handleInputChange('username')}
                      fullWidth
                      placeholder="moynizhny, @moynizhny или https://t.me/moynizhny"
                      helperText="Для публичных каналов можно указывать username или ссылку t.me"
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Chat ID"
                      value={formData.chatId}
                      onChange={handleInputChange('chatId')}
                      fullWidth
                      placeholder="-1001234567890"
                      helperText="Необязательно, если указан публичный username"
                    />
                  </Grid>
                </>
              )}

              {/* Selected Channel Information - Read Only */}
              {selectedSubscription && (
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                    Информация о выбранном канале
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Card variant="outlined" sx={{ bgcolor: 'grey.50' }}>
                    <CardContent>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="text.secondary">
                            Название
                          </Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {selectedSubscription.title}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="text.secondary">
                            Имя пользователя
                          </Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {selectedSubscription.username || 'Не указано'}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={12} md={4}>
                          <Typography variant="body2" color="text.secondary">
                            Тип
                          </Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {selectedSubscription.type === 'channel' ? 'Канал' : 
                             selectedSubscription.type === 'supergroup' ? 'Супергруппа' : 'Группа'}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={12} md={4}>
                          <Typography variant="body2" color="text.secondary">
                            Участников
                          </Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {selectedSubscription.participantsCount?.toLocaleString() || 'Не указано'}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={12} md={4}>
                          <Typography variant="body2" color="text.secondary">
                            Chat ID
                          </Typography>
                          <Typography variant="body1" fontWeight="medium" sx={{ fontFamily: 'monospace' }}>
                            {selectedSubscription.chatId}
                          </Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {/* Requirement Message */}
              {!selectedSubscription && !isEditing && (
                <Grid item xs={12}>
                  <Alert severity="info" sx={{ mt: 2 }}>
                    Если список подписок пуст, добавьте публичный канал по username или ссылке `t.me/...` вручную
                  </Alert>
                </Grid>
              )}

              {/* Custom Name Field */}
              {(selectedSubscription || isEditing || hasSourceIdentifier) && (
                <>
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                      Настройки источника
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Название источника"
                      value={formData.name}
                      onChange={handleInputChange('name')}
                      fullWidth
                      required
                      helperText="Отображаемое имя для этого источника (можно изменить)"
                    />
                  </Grid>
                </>
              )}

              {/* Configuration sections - only show when subscription selected or editing */}
              {(selectedSubscription || isEditing || hasSourceIdentifier) && (
                <>
                  {/* Viral Detection Strategy */}
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                      Стратегия обнаружения виральности
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                  </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Метрика для определения виральности
                  </Typography>
                  <Select
                    value={formData.viralDetectionMetric}
                    onChange={handleInputChange('viralDetectionMetric')}
                  >
                    <MenuItem value="reactions">Реакции</MenuItem>
                    <MenuItem value="comments">Комментарии</MenuItem>
                    <MenuItem value="forwards">Пересылки</MenuItem>
                    <MenuItem value="engagement_score">Комплексная оценка вовлеченности</MenuItem>
                  </Select>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                    {formData.viralDetectionMetric === 'reactions' && 'Посты считаются вирусными на основе количества реакций'}
                    {formData.viralDetectionMetric === 'comments' && 'Посты считаются вирусными на основе количества комментариев'}
                    {formData.viralDetectionMetric === 'forwards' && 'Посты считаются вирусными на основе количества пересылок'}
                    {formData.viralDetectionMetric === 'engagement_score' && 'Посты оцениваются по взвешенной сумме всех метрик'}
                  </Typography>
                </FormControl>
              </Grid>

              {/* Threshold Type Selection */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Настройки порога виральности
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>

              <Grid item xs={12}>
                <FormControl component="fieldset">
                  <FormLabel component="legend">Тип порога</FormLabel>
                  <RadioGroup
                    name="thresholdType"
                    value={formData.thresholdType}
                    onChange={handleInputChange('thresholdType')}
                    row
                  >
                    <FormControlLabel 
                      value="manual" 
                      control={<Radio />} 
                      label="Ручной (установить конкретный порог)"
                    />
                    <FormControlLabel 
                      value="auto" 
                      control={<Radio />} 
                      label="Автоматический (рассчитать на основе данных)"
                    />
                  </RadioGroup>
                </FormControl>
              </Grid>

              {/* Manual Threshold */}
              {formData.thresholdType === 'manual' && (
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Порог виральности"
                    type="number"
                    value={formData.manualThreshold}
                    onChange={handleInputChange('manualThreshold')}
                    fullWidth
                    required
                    inputProps={{ min: 1 }}
                    helperText={
                      formData.viralDetectionMetric === 'engagement_score' 
                        ? "Минимальная взвешенная оценка вовлеченности"
                        : `Минимальное количество ${
                            formData.viralDetectionMetric === 'reactions' ? 'реакций' :
                            formData.viralDetectionMetric === 'comments' ? 'комментариев' :
                            formData.viralDetectionMetric === 'forwards' ? 'пересылок' : 'единиц'
                          }`
                    }
                  />
                </Grid>
              )}

              {/* Auto Threshold Settings */}
              {formData.thresholdType === 'auto' && (
                <>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Метод расчета
                      </Typography>
                      <Select
                        value={formData.thresholdMethod}
                        onChange={handleInputChange('thresholdMethod')}
                      >
                        <MenuItem value="statistical">Статистический (среднее + отклонение)</MenuItem>
                        <MenuItem value="percentile">Процентильный (топ % постов)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Статистический множитель"
                      type="text"
                      value={formData.statisticalMultiplier}
                      onChange={handleInputChange('statisticalMultiplier')}
                      fullWidth
                      error={!!multiplierError}
                      helperText={multiplierError || (formData.thresholdMethod === 'percentile' 
                        ? "Значение для процентиля (1.0=80%, 1.5=85%, 2.0=90%, 2.5=95%, 3.0=97%)"
                        : "Множитель для расчета порога (0.1-5.0). Можно использовать запятую или точку")}
                      placeholder="1,5 или 1.5"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Card variant="outlined">
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="h6">
                            Расчет порога
                          </Typography>
                          <Button
                            variant="contained"
                            onClick={handleCalculateThreshold}
                            disabled={calculatingThreshold || !formData.chatId || !!multiplierError}
                            startIcon={calculatingThreshold ? <CircularProgress size={20} /> : null}
                          >
                            {calculatingThreshold ? 'Расчет...' : 'Рассчитать порог'}
                          </Button>
                        </Box>
                        
                        {formData.calculatedThreshold && thresholdCalculated && (
                          <Box sx={{ p: 2, bgcolor: 'success.light', borderRadius: 1, color: 'success.contrastText' }}>
                            <Typography variant="body1">
                              Рассчитанный порог: <strong>{formData.calculatedThreshold}</strong>
                            </Typography>
                          </Box>
                        )}
                        
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          Порог будет рассчитан на основе последних 100 постов из выбранного канала
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </>
              )}

              {/* Engagement Weights - only show for engagement_score metric */}
              {formData.viralDetectionMetric === 'engagement_score' && (
                <>
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                      Веса вовлеченности
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Настройте важность каждой метрики в общей оценке вовлеченности
                    </Typography>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <TextField
                      label="Вес реакций"
                      type="number"
                      value={formData.reactionWeight}
                      onChange={handleInputChange('reactionWeight')}
                      fullWidth
                      inputProps={{ min: 0, step: 0.1, max: 10 }}
                      helperText="Множитель для реакций (по умолчанию: 1.0)"
                    />
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <TextField
                      label="Вес комментариев"
                      type="number"
                      value={formData.commentWeight}
                      onChange={handleInputChange('commentWeight')}
                      fullWidth
                      inputProps={{ min: 0, step: 0.1, max: 10 }}
                      helperText="Множитель для комментариев (по умолчанию: 2.0)"
                    />
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <TextField
                      label="Вес пересылок"
                      type="number"
                      value={formData.forwardWeight}
                      onChange={handleInputChange('forwardWeight')}
                      fullWidth
                      inputProps={{ min: 0, step: 0.1, max: 10 }}
                      helperText="Множитель для пересылок (по умолчанию: 3.0)"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Card variant="outlined" sx={{ bgcolor: 'info.light', color: 'info.contrastText' }}>
                      <CardContent>
                        <Typography variant="body2">
                          <strong>Формула расчета:</strong> (Реакции × {formData.reactionWeight}) + (Комментарии × {formData.commentWeight}) + (Пересылки × {formData.forwardWeight})
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          Пример: Пост с 10 реакциями, 2 комментариями и 1 пересылкой получит оценку: {(10 * formData.reactionWeight + 2 * formData.commentWeight + 1 * formData.forwardWeight).toFixed(1)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </>
              )}

              {/* Advanced Settings */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Дополнительные настройки
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  label="Частота проверки (минуты)"
                  type="number"
                  value={formData.checkFrequency}
                  onChange={handleInputChange('checkFrequency')}
                  fullWidth
                  inputProps={{ min: 5, max: 1440 }}
                  helperText="Как часто проверять новые сообщения (5-1440 минут)"
                />
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.active}
                      onChange={handleInputChange('active')}
                    />
                  }
                  label="Источник активен"
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                  Неактивные источники не будут обрабатываться автоматически
                </Typography>
              </Grid>

                </>
              )}

              {/* Action Buttons */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 3 }}>
                  <Button
                    type="button"
                    variant="outlined"
                    onClick={handleCancel}
                    disabled={loading}
                  >
                    Отменить
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={loading || !formData.name || !hasSourceIdentifier}
                  >
                    {loading ? 'Сохранение...' : (isEditing ? 'Обновить источник' : 'Создать источник')}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        </Paper>
      </Box>
    </Container>
  );
};

export default TelegramSourceForm;
