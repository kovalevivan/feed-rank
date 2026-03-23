import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import {
  Launch as LaunchIcon,
  PhotoLibrary as SnapshotIcon,
  Refresh as RefreshIcon,
  Source as SourceIcon,
  Storage as StorageIcon,
  Sync as SyncIcon
} from '@mui/icons-material';
import {
  clearError,
  clearSelectedSourcePosts,
  fetchAnalyticsOverview,
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

const Analytics = () => {
  const dispatch = useDispatch();
  const {
    overview,
    sources,
    selectedSourcePosts,
    overviewLoading,
    sourcesLoading,
    postsLoading,
    error
  } = useSelector((state) => state.analytics);
  const [selectedSourceId, setSelectedSourceId] = useState('');

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
    if (selectedSourceId) {
      dispatch(fetchAnalyticsSourcePosts({ sourceId: selectedSourceId, limit: 50 }));
      return;
    }

    dispatch(clearSelectedSourcePosts());
  }, [dispatch, selectedSourceId]);

  const selectedSource = useMemo(
    () => sources.find((source) => source.mongo_source_id === selectedSourceId) || null,
    [sources, selectedSourceId]
  );

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
      dispatch(fetchAnalyticsSourcePosts({ sourceId: selectedSourceId, limit: 50 }));
    }
  };

  const buildPostUrl = (source, post) => {
    if (!source?.username) {
      return null;
    }

    return `https://t.me/${source.username}/${post.message_id}`;
  };

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
                      <TableCell>{source.username ? `@${source.username}` : '—'}</TableCell>
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2 }}>
              <Box>
                <Typography variant="h6">
                  {selectedSource ? `Посты канала: ${selectedSource.title}` : 'Посты канала'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Последние 50 постов с текущими метриками и числом snapshots.
                </Typography>
              </Box>
              {selectedSource?.username && (
                <Button
                  size="small"
                  variant="outlined"
                  href={`https://t.me/${selectedSource.username}`}
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
                    <TableCell align="right">Views</TableCell>
                    <TableCell align="right">Reactions</TableCell>
                    <TableCell align="right">Forwards</TableCell>
                    <TableCell align="right">Comments</TableCell>
                    <TableCell align="right">Snapshots</TableCell>
                    <TableCell>Виральность</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedSourcePosts.map((post) => {
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
                        </TableCell>
                        <TableCell>{formatDateTime(post.published_at)}</TableCell>
                        <TableCell align="right">{formatNumber(post.view_count_last)}</TableCell>
                        <TableCell align="right">{formatNumber(post.reaction_count_last)}</TableCell>
                        <TableCell align="right">{formatNumber(post.forward_count_last)}</TableCell>
                        <TableCell align="right">{formatNumber(post.comment_count_last)}</TableCell>
                        <TableCell align="right">{formatNumber(post.snapshots_count)}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={post.current_is_viral ? 'viral' : 'normal'}
                            color={post.current_is_viral ? 'error' : 'default'}
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
    </Box>
  );
};

export default Analytics;
