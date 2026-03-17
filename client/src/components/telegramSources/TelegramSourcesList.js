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

const TelegramSourcesList = () => {
  const dispatch = useDispatch();
  const { telegramSources, loading, error } = useSelector(state => state.telegramSources);
  const translate = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState(null);
  const [processStatus, setProcessStatus] = useState({});

  // Fetch Telegram sources when component mounts
  useEffect(() => {
    const fetchSources = async () => {
      try {
        dispatch(setLoading());
        const response = await axios.get('/api/telegram-sources');
        dispatch(setTelegramSources(response.data));
      } catch (err) {
        console.error('Error fetching Telegram sources:', err);
        dispatch(setError(err.response?.data?.message || translate('Failed to fetch Telegram sources')));
      }
    };

    fetchSources();
  }, [dispatch, translate]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleDeleteClick = (source) => {
    setSourceToDelete(source);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!sourceToDelete) return;

    try {
      await axios.delete(`/api/telegram-sources/${sourceToDelete._id}`);
      
      // Update the state by removing the deleted source
      dispatch(setTelegramSources(
        telegramSources.filter(source => source._id !== sourceToDelete._id)
      ));
      
      setDeleteDialogOpen(false);
      setSourceToDelete(null);
    } catch (err) {
      console.error('Error deleting source:', err);
      dispatch(setError(err.response?.data?.message || translate('Failed to delete source')));
    }
  };

  const handleProcessSource = async (sourceId) => {
    try {
      setProcessStatus({
        ...processStatus,
        [sourceId]: { loading: true }
      });
      
      const response = await axios.post(`/api/telegram-sources/${sourceId}/process`);
      
      setProcessStatus({
        ...processStatus,
        [sourceId]: { 
          success: true, 
          result: response.data 
        }
      });
      
      // Clear success status after 5 seconds
      setTimeout(() => {
        setProcessStatus({
          ...processStatus,
          [sourceId]: null
        });
      }, 5000);
    } catch (err) {
      console.error('Error processing source:', err);
      setProcessStatus({
        ...processStatus,
        [sourceId]: { error: err.response?.data?.message || translate('Failed to process source') }
      });
    }
  };

  // Filter sources based on search term
  const filteredSources = telegramSources.filter(source => 
    source.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    source.chatId.includes(searchTerm) ||
    (source.username && source.username.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">{translate('Telegram Sources')}</Typography>
        <Button
          component={RouterLink}
          to="/app/telegram-sources/new"
          variant="contained"
          startIcon={<AddIcon />}
        >
          {translate('Add Source')}
        </Button>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>
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
        </Box>
        
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{translate('Source Name')}</TableCell>
                <TableCell>{translate('Type')}</TableCell>
                <TableCell>{translate('Chat ID')}</TableCell>
                <TableCell>{translate('Username')}</TableCell>
                <TableCell>{translate('Posts Found')}</TableCell>
                <TableCell>{translate('Viral Posts')}</TableCell>
                <TableCell>{translate('Status')}</TableCell>
                <TableCell align="right">{translate('Actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <CircularProgress size={24} sx={{ my: 2 }} />
                  </TableCell>
                </TableRow>
              ) : filteredSources.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body1">
                      {telegramSources.length === 0 
                        ? translate("No Telegram sources configured yet. Add your first source to get started.")
                        : translate("No sources match your search.")}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredSources.map(source => (
                  <TableRow key={source._id}>
                    <TableCell>{source.name}</TableCell>
                    <TableCell>
                      <Chip 
                        label={source.type} 
                        size="small"
                        color={source.type === 'channel' ? 'primary' : 'secondary'}
                      />
                    </TableCell>
                    <TableCell>{source.chatId}</TableCell>
                    <TableCell>{source.username || '-'}</TableCell>
                    <TableCell>{source.totalPosts || 0}</TableCell>
                    <TableCell>{source.viralPosts || 0}</TableCell>
                    <TableCell>
                      <Chip 
                        color={source.active ? "success" : "default"}
                        label={source.active ? translate("Active") : translate("Inactive")}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={translate('Process messages')}>
                        <IconButton 
                          onClick={() => handleProcessSource(source._id)}
                          disabled={processStatus[source._id]?.loading}
                        >
                          {processStatus[source._id]?.loading ? (
                            <CircularProgress size={20} />
                          ) : (
                            <ProcessIcon color={processStatus[source._id]?.success ? "success" : "inherit"} />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={translate('Edit')}>
                        <IconButton component={RouterLink} to={`/app/telegram-sources/${source._id}`}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={translate('Delete')}>
                        <IconButton onClick={() => handleDeleteClick(source)}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>{translate('Delete Source')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {translate('Are you sure you want to delete the source')} "{sourceToDelete?.name}"? {translate('This action cannot be undone.')}
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

export default TelegramSourcesList;
