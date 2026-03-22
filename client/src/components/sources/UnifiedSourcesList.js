import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
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
  Refresh as RefreshIcon,
  PlayArrow as ProcessIcon
} from '@mui/icons-material';
import { useTranslation } from '../../translations/TranslationContext';
import { fetchVkSources, clearVkSourcesError } from '../../redux/slices/vkSourcesSlice';

const UnifiedSourcesList = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const translate = useTranslation();
  
  const { vkSources, loading: vkLoading, error: vkError } = useSelector((state) => state.vkSources);
  
  const [telegramSources, setTelegramSources] = useState([]);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramError, setTelegramError] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState(null);
  const [processStatus, setProcessStatus] = useState({});

  // Load VK sources
  useEffect(() => {
    dispatch(fetchVkSources());
  }, [dispatch]);

  // Load Telegram sources
  useEffect(() => {
    const loadTelegramSources = async () => {
      try {
        setTelegramLoading(true);
        const response = await axios.get('/api/telegram-sources');
        setTelegramSources(response.data);
      } catch (err) {
        console.error('Error loading Telegram sources:', err);
        setTelegramError(err.response?.data?.message || translate('Failed to fetch Telegram sources'));
      } finally {
        setTelegramLoading(false);
      }
    };
    
    loadTelegramSources();
  }, [translate]);

  // Combine and format sources
  const allSources = [
    ...vkSources.map(source => ({
      ...source,
      type: 'vk',
      displayName: source.name, // Show VK public name
      chatId: null,
      username: null
    })),
    ...telegramSources.map(source => ({
      ...source,
      type: 'telegram',
      displayName: source.name,
      groupName: null
    }))
  ];

  // Filter sources based on search term
  const filteredSources = allSources.filter(source => {
    const searchLower = searchTerm.toLowerCase();
    return (
      source.displayName?.toLowerCase().includes(searchLower) ||
      source.groupName?.toLowerCase().includes(searchLower) ||
      source.name?.toLowerCase().includes(searchLower) ||
      source.chatId?.includes(searchTerm) ||
      source.username?.toLowerCase().includes(searchLower)
    );
  });

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  const handleRefresh = () => {
    dispatch(fetchVkSources());
    // Reload Telegram sources
    const loadTelegramSources = async () => {
      try {
        setTelegramLoading(true);
        const response = await axios.get('/api/telegram-sources');
        setTelegramSources(response.data);
      } catch (err) {
        console.error('Error loading Telegram sources:', err);
        setTelegramError(err.response?.data?.message || translate('Failed to fetch Telegram sources'));
      } finally {
        setTelegramLoading(false);
      }
    };
    loadTelegramSources();
  };

  const handleDeleteClick = (source) => {
    setSourceToDelete(source);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!sourceToDelete) return;

    try {
      const endpoint = sourceToDelete.type === 'vk' 
        ? `/api/vk-sources/${sourceToDelete._id}`
        : `/api/telegram-sources/${sourceToDelete._id}`;
      
      await axios.delete(endpoint);
      
      if (sourceToDelete.type === 'vk') {
        dispatch(fetchVkSources()); // Refresh VK sources
      } else {
        // Remove from Telegram sources
        setTelegramSources(telegramSources.filter(source => source._id !== sourceToDelete._id));
      }
      
      setDeleteDialogOpen(false);
      setSourceToDelete(null);
    } catch (err) {
      console.error('Error deleting source:', err);
      const errorMessage = err.response?.data?.message || translate('Failed to delete source');
      if (sourceToDelete.type === 'vk') {
        // VK error handling would go here
        setTelegramError(errorMessage);
      } else {
        setTelegramError(errorMessage);
      }
    }
  };

  const handleProcessSource = async (source) => {
    const sourceKey = `${source.type}-${source._id}`;
    
    try {
      setProcessStatus({
        ...processStatus,
        [sourceKey]: { loading: true }
      });
      
      const endpoint = source.type === 'vk'
        ? `/api/vk-sources/${source._id}/process-now`
        : `/api/telegram-sources/${source._id}/process`;
      
      const response = await axios.post(endpoint);
      
      setProcessStatus({
        ...processStatus,
        [sourceKey]: { 
          success: true, 
          result: response.data 
        }
      });
      
      // Clear success status after 5 seconds
      setTimeout(() => {
        setProcessStatus(prev => ({
          ...prev,
          [sourceKey]: null
        }));
      }, 5000);
    } catch (err) {
      console.error('Error processing source:', err);
      setProcessStatus({
        ...processStatus,
        [sourceKey]: { error: err.response?.data?.message || translate('Failed to process source') }
      });
    }
  };

  const getEditPath = (source) => {
    return source.type === 'vk' ? `/app/sources/${source._id}` : `/app/telegram-sources/${source._id}`;
  };

  const loading = vkLoading || telegramLoading;
  const error = vkError || telegramError;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">{translate('Sources')}</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            component={RouterLink}
            to="/app/sources/new"
            variant="contained"
            startIcon={<AddIcon />}
          >
            {translate('Add Source')}
          </Button>
          <Button
            onClick={handleRefresh}
            variant="outlined"
            startIcon={<RefreshIcon />}
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : translate('Refresh')}
          </Button>
        </Box>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}
      
      <Paper sx={{ p: 1.5, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <TextField
            label={translate('Search Sources')}
            variant="outlined"
            size="small"
            sx={{ width: 300 }}
            value={searchTerm}
            onChange={handleSearchChange}
          />
          <Typography variant="body2" color="text.secondary">
            {translate('Total Sources')}: {filteredSources.length}
          </Typography>
        </Box>
        
        {filteredSources.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {searchTerm ? translate('No sources found') : translate('No sources configured yet')}
            </Typography>
            {!searchTerm && (
              <Typography variant="body2" color="text.secondary">
                {translate('Add your first source to get started')}
              </Typography>
            )}
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{translate('Type')}</TableCell>
                  <TableCell>{translate('Name')}</TableCell>
                  <TableCell>{translate('Details')}</TableCell>
                  <TableCell>{translate('Threshold')}</TableCell>
                  <TableCell>{translate('Frequency')}</TableCell>
                  <TableCell>{translate('Posts to Check')}</TableCell>
                  <TableCell>{translate('Last Check')}</TableCell>
                  <TableCell align="right">{translate('Actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredSources.map((source) => {
                  const sourceKey = `${source.type}-${source._id}`;
                  return (
                    <TableRow key={sourceKey}>
                      <TableCell>
                        <Chip 
                          label={source.type === 'vk' ? 'VK' : 'Telegram'}
                          color={source.type === 'vk' ? 'primary' : 'secondary'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {source.displayName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {source.type === 'vk' ? (
                          <Typography variant="body2" color="text.secondary">
                            {source.groupId}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            {source.username && source.username !== '@null' 
                              ? (source.username.startsWith('@') ? source.username : `@${source.username}`)
                              : 'No username'
                            }
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {(() => {
                            if (source.type === 'telegram') {
                              // For Telegram sources - show the effective threshold
                              if (source.thresholdType === 'manual') {
                                return source.manualThreshold || '0';
                              } else {
                                // For auto mode, show calculated threshold or indicate it needs calculation
                                return source.calculatedThreshold 
                                  ? source.calculatedThreshold.toString()
                                  : translate('Not calculated');
                              }
                            } else {
                              // For VK sources
                              if (source.thresholdType === 'manual') {
                                return source.manualThreshold || '0';
                              } else {
                                return source.calculatedThreshold 
                                  ? source.calculatedThreshold.toString() 
                                  : translate('Auto');
                              }
                            }
                          })()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {source.checkFrequency ? `${source.checkFrequency} ${translate('min')}` : translate('N/A')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {source.postsToCheck || (source.type === 'vk' ? '50' : '30')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {source.lastChecked 
                            ? new Date(source.lastChecked).toLocaleString('ru-RU', {
                                day: '2-digit',
                                month: '2-digit', 
                                year: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : translate('Never')
                          }
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title={translate('Process messages')}>
                          <IconButton 
                            onClick={() => handleProcessSource(source)}
                            disabled={processStatus[sourceKey]?.loading}
                          >
                            {processStatus[sourceKey]?.loading ? (
                              <CircularProgress size={20} />
                            ) : (
                              <ProcessIcon color={processStatus[sourceKey]?.success ? "success" : "inherit"} />
                            )}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={translate('Edit')}>
                          <IconButton component={RouterLink} to={getEditPath(source)}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={translate('Delete')}>
                          <IconButton onClick={() => handleDeleteClick(source)} color="error">
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{translate('Confirm Delete')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {translate('Are you sure you want to delete this source?')} {sourceToDelete?.displayName}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{translate('Cancel')}</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            {translate('Delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UnifiedSourcesList;
