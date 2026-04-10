import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import {
  Close as CloseIcon,
  Launch as LaunchIcon,
  PhotoLibrary as SnapshotIcon,
  Refresh as RefreshIcon,
  Source as SourceIcon,
  Storage as StorageIcon,
  Sync as SyncIcon
} from '@mui/icons-material';
import {
  applyAnalyticsRecommendedStrategy,
  clearError,
  clearRecommendedStrategy,
  clearSelectedPostSnapshots,
  clearSelectedSourceConfig,
  clearSelectedSourcePosts,
  fetchAnalyticsOverview,
  fetchAnalyticsPostSnapshots,
  fetchAnalyticsRecommendedStrategy,
  fetchAnalyticsSourceConfig,
  fetchAnalyticsSourcePosts,
  fetchAnalyticsSources
} from '../../redux/slices/analyticsSlice';
import ApiErrorAlert from '../common/ApiErrorAlert';

const formatNumber = (value) => {
  if (value === null || value === undefined) {
    return '0';
  }

  return new Intl.NumberFormat('ru-RU').format(Number(value) || 0);
};

const formatDateTime = (value) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const normalizeUsername = (username) => {
  if (!username) {
    return '';
  }

  return username.replace(/^@+/, '');
};

const metricLabelMap = {
  views: 'просмотры',
  reactions: 'лайки',
  comments: 'комментарии',
  forwards: 'пересылки',
  engagement_score: 'engagement score'
};

const formatRate = (value) => `${(Number(value || 0) * 100).toFixed(1)}%`;

const Analytics = () => {
  const dispatch = useDispatch();
  const {
    overview,
    sources,
    selectedSourcePosts,
    selectedSourceConfig,
    selectedPostSnapshots,
    selectedPostId,
    recommendedStrategy,
    strategyProfiles,
    strategyCandidates,
    overviewLoading,
    sourcesLoading,
    postsLoading,
    sourceConfigLoading,
    snapshotsLoading,
    strategyLoading,
    strategyApplying,
    error
  } = useSelector((state) => state.analytics);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [detailsPost, setDetailsPost] = useState(null);
  const [previewMetric, setPreviewMetric] = useState('reactions');
  const [previewThreshold, setPreviewThreshold] = useState('0');
  const [previewReactionWeight, setPreviewReactionWeight] = useState('1');
  const [previewCommentWeight, setPreviewCommentWeight] = useState('2');
  const [previewForwardWeight, setPreviewForwardWeight] = useState('3');
  const [previewMinAgeMinutes, setPreviewMinAgeMinutes] = useState('0');
  const [previewMaxAgeMinutes, setPreviewMaxAgeMinutes] = useState('60');
  const [selectedStrategyProfile, setSelectedStrategyProfile] = useState('balanced');
  const [previewMode, setPreviewMode] = useState('source');
  const [strategyWindowMinutes, setStrategyWindowMinutes] = useState('auto');

  useEffect(() => {
    dispatch(fetchAnalyticsOverview());
    dispatch(fetchAnalyticsSources());
  }, [dispatch]);

  useEffect(() => {
    if (!selectedSourceId && sources.length > 0) {
      setSelectedSourceId(sources[0].mongo_source_id);
    }
  }, [sources, selectedSourceId]);

  useEffect(() => {
    dispatch(clearRecommendedStrategy());
    setPreviewMode('source');
    setSelectedStrategyProfile('balanced');
    setStrategyWindowMinutes('auto');
  }, [dispatch, selectedSourceId]);

  useEffect(() => {
    if (selectedSourceId) {
      dispatch(fetchAnalyticsSourcePosts({
        sourceId: selectedSourceId,
        limit: 50,
        minAgeMinutes: previewMinAgeMinutes,
        maxAgeMinutes: previewMaxAgeMinutes
      }));
      dispatch(fetchAnalyticsSourceConfig({ sourceId: selectedSourceId }));
      return;
    }

    dispatch(clearSelectedSourcePosts());
    dispatch(clearSelectedSourceConfig());
    dispatch(clearRecommendedStrategy());
  }, [dispatch, selectedSourceId, previewMinAgeMinutes, previewMaxAgeMinutes]);

  const selectedSource = useMemo(
    () => sources.find((source) => source.mongo_source_id === selectedSourceId) || null,
    [sources, selectedSourceId]
  );

  const visiblePosts = useMemo(() => {
    const postsByPublishedAt = new Map();

    selectedSourcePosts.forEach((post) => {
      const key = post.published_at || String(post.message_id);
      const existing = postsByPublishedAt.get(key);

      if (!existing) {
        postsByPublishedAt.set(key, post);
        return;
      }

      const existingScore =
        (Number(existing.reaction_count_last) || 0) * 1000000 +
        (Number(existing.comment_count_last) || 0) * 10000 +
        (Number(existing.view_count_last) || 0);
      const nextScore =
        (Number(post.reaction_count_last) || 0) * 1000000 +
        (Number(post.comment_count_last) || 0) * 10000 +
        (Number(post.view_count_last) || 0);

      if (nextScore > existingScore) {
        postsByPublishedAt.set(key, post);
      }
    });

    return Array.from(postsByPublishedAt.values());
  }, [selectedSourcePosts]);

  const getDefaultPreviewThreshold = (sourceConfig, metric) => {
    if (!sourceConfig) {
      return 0;
    }

    if (sourceConfig.thresholdType === 'manual' && sourceConfig.manualThreshold !== undefined && sourceConfig.manualThreshold !== null) {
      return Number(sourceConfig.manualThreshold) || 0;
    }

    switch (metric) {
      case 'views':
        return Number(sourceConfig.calculatedThreshold || sourceConfig.minViewsForViral || 0);
      case 'forwards':
        return Number(sourceConfig.calculatedThreshold || sourceConfig.minForwardsForViral || 0);
      case 'comments':
        return Number(sourceConfig.calculatedThreshold || sourceConfig.minCommentsForViral || 0);
      case 'engagement_score':
        return Number(sourceConfig.calculatedThreshold || 30);
      case 'reactions':
      default:
        return Number(sourceConfig.calculatedThreshold || sourceConfig.minReactionsForViral || 0);
    }
  };

  useEffect(() => {
    if (!selectedSourceConfig) {
      return;
    }

    if (previewMode !== 'source') {
      return;
    }

    const metric = selectedSourceConfig.viralDetectionMetric || 'reactions';
    setPreviewMetric(metric);
    setPreviewThreshold(String(getDefaultPreviewThreshold(selectedSourceConfig, metric)));
    setPreviewReactionWeight(String(selectedSourceConfig.reactionWeight ?? 1));
    setPreviewCommentWeight(String(selectedSourceConfig.commentWeight ?? 2));
    setPreviewForwardWeight(String(selectedSourceConfig.forwardWeight ?? 3));
    setPreviewMinAgeMinutes('0');
    setPreviewMaxAgeMinutes(String(selectedSourceConfig.maxNewsAgeMinutes ?? 60));
  }, [selectedSourceConfig, previewMode]);

  const runStats = useMemo(() => {
    const initial = { running: 0, completed: 0, failed: 0 };
    return (overview?.recentRuns || []).reduce((acc, run) => {
      if (acc[run.status] !== undefined) {
        acc[run.status] += 1;
      }
      return acc;
    }, initial);
  }, [overview]);

  const latestSnapshotAt = useMemo(() => {
    const timestamps = sources
      .map((source) => source.last_snapshot_at)
      .filter(Boolean)
      .map((value) => new Date(value).getTime())
      .filter((value) => Number.isFinite(value));

    if (timestamps.length === 0) {
      return null;
    }

    return new Date(Math.max(...timestamps));
  }, [sources]);

  const summaryCards = [
    {
      label: 'Каналы',
      value: formatNumber(overview?.channels),
      icon: <SourceIcon color="primary" />
    },
    {
      label: 'Посты',
      value: formatNumber(overview?.posts),
      icon: <StorageIcon color="primary" />
    },
    {
      label: 'Снимки',
      value: formatNumber(overview?.snapshots),
      icon: <SnapshotIcon color="primary" />
    },
    {
      label: 'Активные sync-runs',
      value: formatNumber(runStats.running),
      icon: <SyncIcon color="primary" />
    }
  ];

  const handleRefresh = () => {
    dispatch(fetchAnalyticsOverview());
    dispatch(fetchAnalyticsSources());
    if (selectedSourceId) {
      dispatch(fetchAnalyticsSourcePosts({
        sourceId: selectedSourceId,
        limit: 50,
        minAgeMinutes: previewMinAgeMinutes,
        maxAgeMinutes: previewMaxAgeMinutes
      }));
    }
  };

  const handleRecommendStrategy = () => {
    if (!selectedSourceId) {
      return;
    }

    dispatch(fetchAnalyticsRecommendedStrategy({
      sourceId: selectedSourceId,
      windowMinutes: strategyWindowMinutes
    }));
  };

  const handleApplyRecommendedStrategy = async () => {
    if (!selectedSourceId || !recommendedStrategy) {
      return;
    }

    const strategyToApply = strategyProfiles[selectedStrategyProfile] || recommendedStrategy;
    await dispatch(applyAnalyticsRecommendedStrategy({
      sourceId: selectedSourceId,
      profileKey: selectedStrategyProfile,
      windowMinutes: strategyWindowMinutes
    }));
    setPreviewMetric(strategyToApply.metric);
    setPreviewThreshold(String(strategyToApply.threshold));
    setPreviewMinAgeMinutes('0');
    setPreviewMaxAgeMinutes(String(strategyToApply.maxNewsAgeMinutes));
    setPreviewReactionWeight(String(strategyToApply.reactionWeight ?? 1));
    setPreviewCommentWeight(String(strategyToApply.commentWeight ?? 2));
    setPreviewForwardWeight(String(strategyToApply.forwardWeight ?? 3));
    setPreviewMode('strategy');
    dispatch(fetchAnalyticsSourceConfig({ sourceId: selectedSourceId }));
  };

  const buildPostUrl = (source, post) => {
    if (post?.original_post_url) {
      return post.original_post_url;
    }

    if (!source?.username) {
      return null;
    }

    return `https://t.me/${normalizeUsername(source.username)}/${post.message_id}`;
  };

  const previewPosts = useMemo(() => {
    const threshold = Number(previewThreshold) || 0;
    return visiblePosts.map((post) => {
      const reactions = Number(post.range_reaction_count_max ?? post.reaction_count_last ?? 0);
      const comments = Number(post.range_comment_count_max ?? post.comment_count_last ?? 0);
      const forwards = Number(post.range_forward_count_max ?? post.forward_count_last ?? 0);
      const views = Number(post.range_view_count_max ?? post.view_count_last ?? 0);

      let previewValue = reactions;
      if (previewMetric === 'views') {
        previewValue = views;
      } else if (previewMetric === 'forwards') {
        previewValue = forwards;
      } else if (previewMetric === 'comments') {
        previewValue = comments;
      } else if (previewMetric === 'engagement_score') {
        previewValue =
          reactions * (Number(previewReactionWeight) || 0) +
          comments * (Number(previewCommentWeight) || 0) +
          forwards * (Number(previewForwardWeight) || 0);
      }

      return {
        ...post,
        previewValue,
        previewIsViral: Number(post.range_snapshots_count || 0) > 0 && previewValue >= threshold
      };
    });
  }, [visiblePosts, previewMetric, previewThreshold, previewReactionWeight, previewCommentWeight, previewForwardWeight]);

  const previewViralCount = useMemo(
    () => previewPosts.filter((post) => post.previewIsViral).length,
    [previewPosts]
  );

  const resetPreviewToSource = () => {
    if (!selectedSourceConfig) {
      return;
    }

    const metric = selectedSourceConfig.viralDetectionMetric || 'reactions';
    setPreviewMetric(metric);
    setPreviewThreshold(String(getDefaultPreviewThreshold(selectedSourceConfig, metric)));
    setPreviewReactionWeight(String(selectedSourceConfig.reactionWeight ?? 1));
    setPreviewCommentWeight(String(selectedSourceConfig.commentWeight ?? 2));
    setPreviewForwardWeight(String(selectedSourceConfig.forwardWeight ?? 3));
    setPreviewMinAgeMinutes('0');
    setPreviewMaxAgeMinutes(String(selectedSourceConfig.maxNewsAgeMinutes ?? 60));
    setPreviewMode('source');
  };

  const openPostDetails = (post) => {
    setDetailsPost(post);
    dispatch(fetchAnalyticsPostSnapshots({ postId: post.id, limit: 200 }));
  };

  const closePostDetails = () => {
    setDetailsPost(null);
    dispatch(clearSelectedPostSnapshots());
  };

  const snapshotRows = useMemo(() => {
    return selectedPostSnapshots.map((snapshot, index) => {
      const previous = index > 0 ? selectedPostSnapshots[index - 1] : null;
      return {
        ...snapshot,
        view_delta: previous ? Number(snapshot.view_count || 0) - Number(previous.view_count || 0) : null,
        reaction_delta: previous ? Number(snapshot.reaction_count || 0) - Number(previous.reaction_count || 0) : null,
        forward_delta: previous ? Number(snapshot.forward_count || 0) - Number(previous.forward_count || 0) : null,
        comment_delta: previous ? Number(snapshot.comment_count || 0) - Number(previous.comment_count || 0) : null
      };
    });
  }, [selectedPostSnapshots]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4">Аналитика Telegram</Typography>
          <Typography variant="body2" color="text.secondary">
            Текущая сводка по каналам, sync-run и постам из аналитической PostgreSQL.
          </Typography>
        </Box>
        <IconButton onClick={handleRefresh} disabled={overviewLoading || sourcesLoading || postsLoading}>
          <RefreshIcon />
        </IconButton>
      </Box>

      {error && <ApiErrorAlert error={error} onClose={() => dispatch(clearError())} />}

      {!overviewLoading && overview && !overview.enabled && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Analytics PostgreSQL не включен. Проверьте `ANALYTICS_DATABASE_URL`.
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mb: 3 }}>
        {summaryCards.map((card) => (
          <Grid item xs={12} sm={6} lg={3} key={card.label}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {card.label}
                  </Typography>
                  {card.icon}
                </Box>
                <Typography variant="h4">{card.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} xl={5}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Общая сводка
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography color="text.secondary">Активных каналов</Typography>
                <Typography>{formatNumber(sources.filter((source) => source.active).length)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography color="text.secondary">Последний snapshot</Typography>
                <Typography>{formatDateTime(latestSnapshotAt)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography color="text.secondary">Completed в последних 10 run</Typography>
                <Typography>{formatNumber(runStats.completed)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography color="text.secondary">Failed в последних 10 run</Typography>
                <Typography>{formatNumber(runStats.failed)}</Typography>
              </Box>
            </Box>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Последние sync-runs
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Канал</TableCell>
                    <TableCell>Запуск</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell align="right">Scanned</TableCell>
                    <TableCell align="right">Created</TableCell>
                    <TableCell align="right">Updated</TableCell>
                    <TableCell align="right">Snapshots</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(overview?.recentRuns || []).map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>{run.channel_name || '—'}</TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDateTime(run.started_at)}
                        </Typography>
                        {run.finished_at && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            до {formatDateTime(run.finished_at)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={
                            run.status === 'completed'
                              ? 'success'
                              : run.status === 'failed'
                                ? 'error'
                                : 'warning'
                          }
                          label={run.status}
                        />
                      </TableCell>
                      <TableCell align="right">{formatNumber(run.messages_scanned)}</TableCell>
                      <TableCell align="right">{formatNumber(run.posts_created)}</TableCell>
                      <TableCell align="right">{formatNumber(run.posts_updated)}</TableCell>
                      <TableCell align="right">{formatNumber(run.snapshots_written)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} xl={7}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2 }}>
              <Typography variant="h6">Источники</Typography>
              <FormControl sx={{ minWidth: 300 }} size="small">
                <InputLabel>Выбранный канал</InputLabel>
                <Select
                  value={selectedSourceId}
                  label="Выбранный канал"
                  onChange={(event) => setSelectedSourceId(event.target.value)}
                  disabled={sourcesLoading}
                >
                  {sources.map((source) => (
                    <MenuItem key={source.mongo_source_id} value={source.mongo_source_id}>
                      {source.title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <TableContainer sx={{ maxHeight: 360 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Канал</TableCell>
                    <TableCell>Username</TableCell>
                    <TableCell align="right">Посты</TableCell>
                    <TableCell align="right">Снимки</TableCell>
                    <TableCell>Последний snapshot</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sources.map((source) => (
                    <TableRow
                      key={source.mongo_source_id}
                      hover
                      selected={source.mongo_source_id === selectedSourceId}
                      onClick={() => setSelectedSourceId(source.mongo_source_id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2">{source.title}</Typography>
                          <Chip
                            size="small"
                            label={source.active ? 'active' : 'paused'}
                            color={source.active ? 'success' : 'default'}
                          />
                        </Box>
                      </TableCell>
                      <TableCell>{source.username ? `@${normalizeUsername(source.username)}` : '—'}</TableCell>
                      <TableCell align="right">{formatNumber(source.posts_count)}</TableCell>
                      <TableCell align="right">{formatNumber(source.snapshots_count)}</TableCell>
                      <TableCell>{formatDateTime(source.last_snapshot_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Умная стратегия
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Система может сама подобрать ранний сигнал виральности по уже собранным snapshots, а затем сразу применить его к источнику.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Окно стратегии</InputLabel>
                  <Select
                    value={strategyWindowMinutes}
                    label="Окно стратегии"
                    onChange={(event) => setStrategyWindowMinutes(event.target.value)}
                  >
                    <MenuItem value="auto">Авто</MenuItem>
                    <MenuItem value="15">15 мин</MenuItem>
                    <MenuItem value="30">30 мин</MenuItem>
                    <MenuItem value="45">45 мин</MenuItem>
                    <MenuItem value="60">60 мин</MenuItem>
                    <MenuItem value="90">90 мин</MenuItem>
                    <MenuItem value="120">120 мин</MenuItem>
                    <MenuItem value="180">180 мин</MenuItem>
                    <MenuItem value="1440">24 часа</MenuItem>
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  onClick={handleRecommendStrategy}
                  disabled={!selectedSourceId || strategyLoading}
                >
                  Рассчитать стратегию
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleApplyRecommendedStrategy}
                  disabled={!recommendedStrategy || strategyApplying}
                >
                  Применить к источнику
                </Button>
              </Box>
              {recommendedStrategy && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <strong>Рекомендация:</strong> {recommendedStrategy.strategyTitle || metricLabelMap[recommendedStrategy.metric] || recommendedStrategy.metric}, порог{' '}
                  {formatNumber(recommendedStrategy.threshold)}, окно {formatNumber(recommendedStrategy.maxNewsAgeMinutes)} мин.
                  {recommendedStrategy.strategyWindowMinutes && (
                    <> {' '}Горизонт расчёта: {formatNumber(recommendedStrategy.strategyWindowMinutes)} мин.</>
                  )}
                  {' '}Точность {formatRate(recommendedStrategy.precision)},
                  {' '}Полнота {formatRate(recommendedStrategy.recall)},
                  {' '}F1 {formatRate(recommendedStrategy.f1Score)}.
                  <br />
                  Правильно поймано вирусных: {formatNumber(recommendedStrategy.truePositive)} / Ложных срабатываний: {formatNumber(recommendedStrategy.falsePositive)} / Пропущено вирусных: {formatNumber(recommendedStrategy.falseNegative)}
                  <br />
                  Это значит: система нашла {formatNumber(recommendedStrategy.truePositive)} действительно сильных постов, ошибочно отметила {formatNumber(recommendedStrategy.falsePositive)} обычных постов и пропустила {formatNumber(recommendedStrategy.falseNegative)} сильных постов.
                  <br />
                  {recommendedStrategy.explanation}
                </Alert>
              )}
              {Object.values(strategyProfiles).filter(Boolean).length > 0 && (
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  {Object.values(strategyProfiles).filter(Boolean).map((strategy) => (
                    <Grid item xs={12} md={4} key={strategy.profileKey}>
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 2,
                          borderColor: selectedStrategyProfile === strategy.profileKey ? 'primary.main' : 'divider',
                          cursor: 'pointer'
                        }}
                        onClick={() => {
                          setSelectedStrategyProfile(strategy.profileKey);
                          setPreviewMode('strategy');
                          setPreviewMetric(strategy.metric);
                          setPreviewThreshold(String(strategy.threshold));
                          setPreviewMinAgeMinutes('0');
                          setPreviewMaxAgeMinutes(String(strategy.maxNewsAgeMinutes));
                          setPreviewReactionWeight(String(strategy.reactionWeight ?? 1));
                          setPreviewCommentWeight(String(strategy.commentWeight ?? 2));
                          setPreviewForwardWeight(String(strategy.forwardWeight ?? 3));
                        }}
                      >
                        <Typography variant="subtitle2" gutterBottom>
                          {strategy.profileTitle}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {strategy.profileDescription}
                        </Typography>
                        <Typography variant="body2">
                          {strategy.strategyTitle || metricLabelMap[strategy.metric] || strategy.metric}: {formatNumber(strategy.threshold)}
                        </Typography>
                        <Typography variant="body2">
                          Окно: {formatNumber(strategy.maxNewsAgeMinutes)} мин
                        </Typography>
                        <Typography variant="body2">
                          Точность {formatRate(strategy.precision)} / Полнота {formatRate(strategy.recall)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Найдено вирусных: {formatNumber(strategy.truePositive)} / Ложных: {formatNumber(strategy.falsePositive)} / Пропущено: {formatNumber(strategy.falseNegative)}
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              )}
              {strategyCandidates.length > 1 && (
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                  {strategyCandidates.slice(0, 4).map((candidate) => (
                    <Chip
                      key={`${candidate.strategyId}-${candidate.maxNewsAgeMinutes}-${candidate.threshold}`}
                      label={`${candidate.strategyTitle || metricLabelMap[candidate.metric] || candidate.metric}: ${formatNumber(candidate.threshold)} / ${formatNumber(candidate.maxNewsAgeMinutes)}м`}
                      variant="outlined"
                    />
                  ))}
                </Box>
              )}
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Ниже можно локально проверить стратегию на таблице постов. Параметры источника больше не должны перетирать выбранную карточку стратегии, пока вы не нажмёте сброс.
              </Typography>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth size="small" disabled={sourceConfigLoading}>
                    <InputLabel>Метрика</InputLabel>
                    <Select
                      value={previewMetric}
                      label="Метрика"
                      onChange={(event) => setPreviewMetric(event.target.value)}
                    >
                      <MenuItem value="views">Просмотры</MenuItem>
                      <MenuItem value="reactions">Лайки</MenuItem>
                      <MenuItem value="comments">Комментарии</MenuItem>
                      <MenuItem value="forwards">Пересылки</MenuItem>
                      <MenuItem value="engagement_score">Engagement score</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Порог"
                    type="number"
                    value={previewThreshold}
                    onChange={(event) => setPreviewThreshold(event.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    size="small"
                    label="От, мин"
                    type="number"
                    value={previewMinAgeMinutes}
                    onChange={(event) => setPreviewMinAgeMinutes(event.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    size="small"
                    label="До, мин"
                    type="number"
                    value={previewMaxAgeMinutes}
                    onChange={(event) => setPreviewMaxAgeMinutes(event.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={5}>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip label={`Будут viral: ${formatNumber(previewViralCount)} из ${formatNumber(previewPosts.length)}`} color="primary" />
                    <Chip label={`Окно: ${previewMinAgeMinutes || 0}-${previewMaxAgeMinutes || '∞'} мин`} variant="outlined" />
                    {selectedSourceConfig && (
                      <Chip
                        label={`Источник: ${selectedSourceConfig.viralDetectionMetric}, ${selectedSourceConfig.thresholdType}`}
                        variant="outlined"
                      />
                    )}
                    <Button size="small" variant="outlined" onClick={resetPreviewToSource} disabled={!selectedSourceConfig}>
                      Сбросить к настройкам источника
                    </Button>
                  </Box>
                </Grid>
                {previewMetric === 'engagement_score' && (
                  <>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Вес лайков"
                        type="number"
                        value={previewReactionWeight}
                        onChange={(event) => setPreviewReactionWeight(event.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Вес комментариев"
                        type="number"
                        value={previewCommentWeight}
                        onChange={(event) => setPreviewCommentWeight(event.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Вес пересылок"
                        type="number"
                        value={previewForwardWeight}
                        onChange={(event) => setPreviewForwardWeight(event.target.value)}
                      />
                    </Grid>
                  </>
                )}
              </Grid>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2 }}>
              <Box>
                <Typography variant="h6">
                  {selectedSource ? `Посты канала: ${selectedSource.title}` : 'Посты канала'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Последние посты без дублей альбомов. Метрики в таблице показаны по выбранному окну времени.
                </Typography>
              </Box>
              {selectedSource?.username && (
                <Button
                  size="small"
                  variant="outlined"
                  href={`https://t.me/${normalizeUsername(selectedSource.username)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  endIcon={<LaunchIcon />}
                >
                  Открыть канал
                </Button>
              )}
            </Box>

            <TableContainer sx={{ maxHeight: 520 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Пост</TableCell>
                    <TableCell>Опубликован</TableCell>
                    <TableCell align="right">Views в окне</TableCell>
                    <TableCell align="right">Лайки в окне</TableCell>
                    <TableCell align="right">Forwards в окне</TableCell>
                    <TableCell align="right">Comments в окне</TableCell>
                    <TableCell>Текущий статус</TableCell>
                    <TableCell align="right">Preview value</TableCell>
                    <TableCell align="right">Точек в окне</TableCell>
                    <TableCell align="right">Snapshots</TableCell>
                    <TableCell>Preview</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewPosts.map((post) => {
                    const postUrl = buildPostUrl(selectedSource, post);

                    return (
                      <TableRow key={post.id} hover>
                        <TableCell>
                          {postUrl ? (
                            <Button
                              size="small"
                              href={postUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              endIcon={<LaunchIcon />}
                            >
                              #{post.message_id}
                            </Button>
                          ) : (
                            `#${post.message_id}`
                          )}
                          <Button size="small" onClick={() => openPostDetails(post)}>
                            Замеры
                          </Button>
                        </TableCell>
                        <TableCell>{formatDateTime(post.published_at)}</TableCell>
                        <TableCell align="right">
                          {Number(post.range_snapshots_count) > 0 ? formatNumber(post.range_view_count_max) : '—'}
                        </TableCell>
                        <TableCell align="right">
                          {Number(post.range_snapshots_count) > 0 ? formatNumber(post.range_reaction_count_max) : '—'}
                        </TableCell>
                        <TableCell align="right">
                          {Number(post.range_snapshots_count) > 0 ? formatNumber(post.range_forward_count_max) : '—'}
                        </TableCell>
                        <TableCell align="right">
                          {Number(post.range_snapshots_count) > 0 ? formatNumber(post.range_comment_count_max) : '—'}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={post.current_is_viral ? 'viral' : 'normal'}
                            color={post.current_is_viral ? 'error' : 'default'}
                          />
                        </TableCell>
                        <TableCell align="right">{formatNumber(post.previewValue)}</TableCell>
                        <TableCell align="right">{formatNumber(post.range_snapshots_count)}</TableCell>
                        <TableCell align="right">{formatNumber(post.snapshots_count)}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={post.previewIsViral ? 'viral' : 'normal'}
                            color={post.previewIsViral ? 'secondary' : 'default'}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={Boolean(detailsPost)} onClose={closePostDetails} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pr: 1 }}>
          <Box>
            <Typography variant="h6">
              {detailsPost ? `Замеры поста #${detailsPost.message_id}` : 'Замеры поста'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {detailsPost ? formatDateTime(detailsPost.published_at) : '—'}
            </Typography>
          </Box>
          <IconButton onClick={closePostDetails}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {detailsPost && (
            <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip label={`Views: ${formatNumber(detailsPost.view_count_last)}`} />
              <Chip label={`Лайки: ${formatNumber(detailsPost.reaction_count_last)}`} />
              <Chip label={`Forwards: ${formatNumber(detailsPost.forward_count_last)}`} />
              <Chip label={`Comments: ${formatNumber(detailsPost.comment_count_last)}`} />
              <Chip label={`Snapshots: ${formatNumber(detailsPost.snapshots_count)}`} />
              {buildPostUrl(selectedSource, detailsPost) && (
                <Button
                  size="small"
                  variant="outlined"
                  href={buildPostUrl(selectedSource, detailsPost)}
                  target="_blank"
                  rel="noopener noreferrer"
                  endIcon={<LaunchIcon />}
                >
                  Открыть пост
                </Button>
              )}
            </Box>
          )}

          {snapshotsLoading && selectedPostId === detailsPost?.id ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Время замера</TableCell>
                    <TableCell align="right">Возраст, мин</TableCell>
                    <TableCell align="right">Views</TableCell>
                    <TableCell align="right">Δ views</TableCell>
                    <TableCell align="right">Лайки</TableCell>
                    <TableCell align="right">Δ лайки</TableCell>
                    <TableCell align="right">Forwards</TableCell>
                    <TableCell align="right">Comments</TableCell>
                    <TableCell>Статус</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {snapshotRows.map((snapshot) => (
                    <TableRow key={snapshot.id}>
                      <TableCell>{formatDateTime(snapshot.snapshot_at)}</TableCell>
                      <TableCell align="right">{formatNumber(snapshot.age_minutes)}</TableCell>
                      <TableCell align="right">{formatNumber(snapshot.view_count)}</TableCell>
                      <TableCell align="right">{snapshot.view_delta === null ? '—' : formatNumber(snapshot.view_delta)}</TableCell>
                      <TableCell align="right">{formatNumber(snapshot.reaction_count)}</TableCell>
                      <TableCell align="right">{snapshot.reaction_delta === null ? '—' : formatNumber(snapshot.reaction_delta)}</TableCell>
                      <TableCell align="right">{formatNumber(snapshot.forward_count)}</TableCell>
                      <TableCell align="right">{formatNumber(snapshot.comment_count)}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={snapshot.is_viral ? 'viral' : 'normal'}
                          color={snapshot.is_viral ? 'error' : 'default'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!snapshotsLoading && snapshotRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
                        Нет замеров по этому посту.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default Analytics;
