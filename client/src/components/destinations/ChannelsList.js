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
  Send as SendIcon
} from '@mui/icons-material';
import { setTelegramChannels, setLoading, setError } from '../../redux/slices/telegramChannelsSlice';
import { useTranslation } from '../../translations/TranslationContext';

const ChannelsList = () => {
  const dispatch = useDispatch();
  const { telegramChannels, loading, error } = useSelector(state => state.telegramChannels);
  const translate = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [channelToDelete, setChannelToDelete] = useState(null);
  const [testMessageStatus, setTestMessageStatus] = useState({});

  // Fetch Telegram channels when component mounts
  useEffect(() => {
    const fetchChannels = async () => {
      try {
        dispatch(setLoading());
        const response = await axios.get('/api/telegram-channels');
        dispatch(setTelegramChannels(response.data));
      } catch (err) {
        console.error('Error fetching Telegram channels:', err);
        dispatch(setError(err.response?.data?.message || translate('Failed to fetch Telegram channels')));
      }
    };

    fetchChannels();
  }, [dispatch, translate]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleDeleteClick = (channel) => {
    setChannelToDelete(channel);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!channelToDelete) return;

    try {
      await axios.delete(`/api/telegram-channels/${channelToDelete._id}`);
      
      // Update the state by removing the deleted channel
      dispatch(setTelegramChannels(
        telegramChannels.filter(channel => channel._id !== channelToDelete._id)
      ));
      
      setDeleteDialogOpen(false);
      setChannelToDelete(null);
    } catch (err) {
      console.error('Error deleting channel:', err);
      dispatch(setError(err.response?.data?.message || translate('Failed to delete channel')));
    }
  };

  const handleSendTestMessage = async (channelId) => {
    try {
      setTestMessageStatus({
        ...testMessageStatus,
        [channelId]: { loading: true }
      });
      
      await axios.post(`/api/telegram-channels/${channelId}/test`);
      
      setTestMessageStatus({
        ...testMessageStatus,
        [channelId]: { success: true }
      });
      
      // Clear success status after 3 seconds
      setTimeout(() => {
        setTestMessageStatus({
          ...testMessageStatus,
          [channelId]: null
        });
      }, 3000);
    } catch (err) {
      console.error('Error sending test message:', err);
      setTestMessageStatus({
        ...testMessageStatus,
        [channelId]: { error: err.response?.data?.message || translate('Failed to send test message') }
      });
    }
  };

  // Filter channels based on search term
  const filteredChannels = telegramChannels.filter(channel => 
    channel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    channel.chatId.includes(searchTerm) ||
    (channel.username && channel.username.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{translate('Telegram Channels')}</Typography>
        <Button
          component={RouterLink}
          to="/channels/new"
          variant="contained"
          startIcon={<AddIcon />}
        >
          {translate('Add Channel')}
        </Button>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}
      
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <TextField
            label={translate('Search Channels')}
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
                <TableCell>{translate('Channel Name')}</TableCell>
                <TableCell>{translate('Channel ID')}</TableCell>
                <TableCell>{translate('Username')}</TableCell>
                <TableCell>{translate('Posts Received')}</TableCell>
                <TableCell>{translate('Status')}</TableCell>
                <TableCell align="right">{translate('Actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <CircularProgress size={24} sx={{ my: 2 }} />
                  </TableCell>
                </TableRow>
              ) : filteredChannels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body1">
                      {telegramChannels.length === 0 
                        ? translate("No Telegram channels configured yet. Add your first channel to get started.")
                        : translate("No channels match your search.")}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredChannels.map(channel => (
                  <TableRow key={channel._id}>
                    <TableCell>{channel.name}</TableCell>
                    <TableCell>{channel.chatId}</TableCell>
                    <TableCell>{channel.username || '-'}</TableCell>
                    <TableCell>{channel.postsForwarded}</TableCell>
                    <TableCell>
                      <Chip 
                        color={channel.active ? "success" : "default"}
                        label={channel.active ? translate("Active") : translate("Inactive")}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={translate('Send test message')}>
                        <IconButton 
                          onClick={() => handleSendTestMessage(channel._id)}
                          disabled={testMessageStatus[channel._id]?.loading}
                        >
                          {testMessageStatus[channel._id]?.loading ? (
                            <CircularProgress size={20} />
                          ) : (
                            <SendIcon color={testMessageStatus[channel._id]?.success ? "success" : "inherit"} />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={translate('Edit')}>
                        <IconButton component={RouterLink} to={`/channels/${channel._id}`}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={translate('Delete')}>
                        <IconButton onClick={() => handleDeleteClick(channel)}>
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
        <DialogTitle>{translate('Delete Channel')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {translate('Are you sure you want to delete the channel')} "{channelToDelete?.name}"? {translate('This action cannot be undone.')}
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

export default ChannelsList; 