import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link as RouterLink } from 'react-router-dom';
import axios from 'axios';
import {
  Box,
  Button,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  CircularProgress,
  Alert,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as ProcessIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { setTelegramSources, setLoading, setError } from '../../redux/slices/telegramSourcesSlice';
import { useTranslation } from '../../translations/TranslationContext';

const TelegramSourcesTab = () => {
  const dispatch = useDispatch();
  const { telegramSources, loading, error } = useSelector(state => state.telegramSources);
  const translate = useTranslation();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState(null);
  const [processingSource, setProcessingSource] = useState(null);

  const fetchTelegramSources = async () => {
    dispatch(setLoading(true));
    try {
      const response = await axios.get('/api/telegram-sources');
      dispatch(setTelegramSources(response.data));
    } catch (err) {
      dispatch(setError(err.response?.data?.message || 'Failed to fetch Telegram sources'));
    } finally {
      dispatch(setLoading(false));
    }
  };

  useEffect(() => {
    fetchTelegramSources();
  }, []);

  const handleDeleteClick = (source) => {
    setSourceToDelete(source);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (sourceToDelete) {
      try {
        await axios.delete(`/api/telegram-sources/${sourceToDelete._id}`);
        fetchTelegramSources();
        setDeleteDialogOpen(false);
        setSourceToDelete(null);
      } catch (err) {
        dispatch(setError(err.response?.data?.message || 'Failed to delete source'));
      }
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setSourceToDelete(null);
  };

  const handleProcessNow = async (source) => {
    setProcessingSource(source._id);
    try {
      await axios.post(`/api/telegram-sources/${source._id}/process`);
      fetchTelegramSources();
    } catch (err) {
      dispatch(setError(err.response?.data?.message || 'Failed to process source'));
    } finally {
      setProcessingSource(null);
    }
  };

  const getStatusColor = (active) => {
    return active ? 'success' : 'default';
  };

  const getThresholdTypeColor = (thresholdType) => {
    return thresholdType === 'auto' ? 'primary' : 'secondary';
  };

  const formatLastChecked = (lastChecked) => {
    if (!lastChecked) return translate('Never');
    const date = new Date(lastChecked);
    return date.toLocaleString('ru-RU');
  };

  const formatThreshold = (source) => {
    if (source.thresholdType === 'manual') {
      return source.manualThreshold || 0;
    } else {
      return source.calculatedThreshold || translate('Not calculated');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Button
          component={RouterLink}
          to="/app/telegram-sources/new"
          variant="contained"
          startIcon={<AddIcon />}
        >
          {translate('Add Telegram Source')}
        </Button>
      </Box>
      
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">{translate('Telegram Client Status')}</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {translate('Client connection status and basic information will be displayed here')}
        </Typography>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{translate('Name')}</TableCell>
              <TableCell>{translate('Channel')}</TableCell>
              <TableCell>{translate('Type')}</TableCell>
              <TableCell>{translate('Status')}</TableCell>
              <TableCell>{translate('Threshold Type')}</TableCell>
              <TableCell>{translate('Threshold')}</TableCell>
              <TableCell>{translate('Total Posts')}</TableCell>
              <TableCell>{translate('Viral Posts')}</TableCell>
              <TableCell>{translate('Last Checked')}</TableCell>
              <TableCell>{translate('Actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {telegramSources.map((source) => (
              <TableRow key={source._id}>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {source.name}
                  </Typography>
                  {source.description && (
                    <Typography variant="caption" color="text.secondary">
                      {source.description}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {source.username || source.chatId}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {source.chatId}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip 
                    label={translate(source.type || 'channel')}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={translate(source.active ? 'Active' : 'Inactive')}
                    color={getStatusColor(source.active)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={translate(source.thresholdType === 'auto' ? 'Auto' : 'Manual')}
                    color={getThresholdTypeColor(source.thresholdType)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {formatThreshold(source)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {source.totalPosts || 0}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {source.viralPosts || 0}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {formatLastChecked(source.lastChecked)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title={translate('Edit')}>
                      <IconButton
                        component={RouterLink}
                        to={`/app/telegram-sources/${source._id}`}
                        size="small"
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    
                    <Tooltip title={translate('Process Now')}>
                      <IconButton
                        onClick={() => handleProcessNow(source)}
                        size="small"
                        color="info"
                        disabled={processingSource === source._id}
                      >
                        {processingSource === source._id ? (
                          <CircularProgress size={16} />
                        ) : (
                          <ProcessIcon />
                        )}
                      </IconButton>
                    </Tooltip>
                    
                    <Tooltip title={translate('Delete')}>
                      <IconButton
                        onClick={() => handleDeleteClick(source)}
                        size="small"
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {telegramSources.length === 0 && (
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Typography variant="h6" color="text.secondary">
            {translate('No Telegram sources found')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {translate('Create your first Telegram source to get started')}
          </Typography>
          <Button
            component={RouterLink}
            to="/app/telegram-sources/new"
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ mt: 2 }}
          >
            {translate('Add Source')}
          </Button>
        </Box>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          {translate('Confirm Delete')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            {translate('Are you sure you want to delete this Telegram source?')} 
            {sourceToDelete && (
              <>
                <br />
                <strong>{sourceToDelete.name}</strong>
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>
            {translate('Cancel')}
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" autoFocus>
            {translate('Delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TelegramSourcesTab;
