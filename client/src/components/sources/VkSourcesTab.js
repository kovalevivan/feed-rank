import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link as RouterLink } from 'react-router-dom';
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
  Calculate as CalculateIcon,
  Sync as SyncIcon
} from '@mui/icons-material';
import {
  fetchVkSources,
  deleteVkSource,
  calculateThreshold,
  processSourceNow,
  clearVkSourcesError,
  clearVkSourceSuccess
} from '../../redux/slices/vkSourcesSlice';
import ApiErrorAlert from '../common/ApiErrorAlert';
import { useTranslation } from '../../translations/TranslationContext';

const VkSourcesTab = () => {
  const dispatch = useDispatch();
  const { vkSources, loading, error, success } = useSelector((state) => state.vkSources);
  const translate = useTranslation();
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState(null);
  const [thresholdDialogOpen, setThresholdDialogOpen] = useState(false);
  const [sourceForThreshold, setSourceForThreshold] = useState(null);
  const [calculatingThreshold, setCalculatingThreshold] = useState(false);
  const [processingSource, setProcessingSource] = useState(null);

  useEffect(() => {
    dispatch(fetchVkSources());
  }, [dispatch]);

  const handleDeleteClick = (source) => {
    setSourceToDelete(source);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (sourceToDelete) {
      await dispatch(deleteVkSource(sourceToDelete._id));
      setDeleteDialogOpen(false);
      setSourceToDelete(null);
      dispatch(fetchVkSources());
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setSourceToDelete(null);
  };

  const handleCalculateThreshold = (source) => {
    setSourceForThreshold(source);
    setThresholdDialogOpen(true);
  };

  const handleThresholdCalculate = async () => {
    if (sourceForThreshold) {
      setCalculatingThreshold(true);
      try {
        await dispatch(calculateThreshold(sourceForThreshold._id));
        setThresholdDialogOpen(false);
        setSourceForThreshold(null);
        dispatch(fetchVkSources());
      } catch (error) {
        console.error('Error calculating threshold:', error);
      } finally {
        setCalculatingThreshold(false);
      }
    }
  };

  const handleThresholdCancel = () => {
    setThresholdDialogOpen(false);
    setSourceForThreshold(null);
  };

  const handleProcessNow = async (source) => {
    setProcessingSource(source._id);
    try {
      await dispatch(processSourceNow(source._id));
      dispatch(fetchVkSources());
    } catch (error) {
      console.error('Error processing source:', error);
    } finally {
      setProcessingSource(null);
    }
  };

  const handleRefresh = () => {
    dispatch(fetchVkSources());
  };

  const handleCloseError = () => {
    dispatch(clearVkSourcesError());
  };

  const handleCloseSuccess = () => {
    dispatch(clearVkSourceSuccess());
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'default';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
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
        <ApiErrorAlert 
          error={error} 
          onClose={handleCloseError}
          sx={{ mb: 2 }}
        />
      )}

      {success && (
        <Alert severity="success" onClose={handleCloseSuccess} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            component={RouterLink}
            to="/app/sources/new"
            variant="contained"
            startIcon={<AddIcon />}
          >
            {translate('Add VK Source')}
          </Button>
          <Button
            onClick={handleRefresh}
            variant="outlined"
            startIcon={<RefreshIcon />}
          >
            {translate('Refresh')}
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{translate('Name')}</TableCell>
              <TableCell>{translate('Group ID')}</TableCell>
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
            {vkSources.map((source) => (
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
                  <Typography variant="body2" fontFamily="monospace">
                    {source.groupId}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip 
                    label={translate(source.active ? 'Active' : 'Inactive')}
                    color={getStatusColor(source.active ? 'active' : 'inactive')}
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
                        to={`/app/sources/${source._id}`}
                        size="small"
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    
                    {source.thresholdType === 'auto' && (
                      <Tooltip title={translate('Calculate Threshold')}>
                        <IconButton
                          onClick={() => handleCalculateThreshold(source)}
                          size="small"
                          color="secondary"
                        >
                          <CalculateIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    
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
                          <SyncIcon />
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

      {vkSources.length === 0 && (
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Typography variant="h6" color="text.secondary">
            {translate('No VK sources found')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {translate('Create your first VK source to get started')}
          </Typography>
          <Button
            component={RouterLink}
            to="/app/sources/new"
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ mt: 2 }}
          >
            {translate('Add VK Source')}
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
            {translate('Are you sure you want to delete this VK source?')} 
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

      {/* Calculate Threshold Dialog */}
      <Dialog
        open={thresholdDialogOpen}
        onClose={handleThresholdCancel}
        aria-labelledby="threshold-dialog-title"
        aria-describedby="threshold-dialog-description"
      >
        <DialogTitle id="threshold-dialog-title">
          {translate('Calculate Threshold')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="threshold-dialog-description">
            {translate('This will recalculate the viral threshold for this source based on recent posts.')}
            {sourceForThreshold && (
              <>
                <br />
                <strong>{sourceForThreshold.name}</strong>
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleThresholdCancel} disabled={calculatingThreshold}>
            {translate('Cancel')}
          </Button>
          <Button 
            onClick={handleThresholdCalculate} 
            color="primary" 
            autoFocus
            disabled={calculatingThreshold}
          >
            {calculatingThreshold ? (
              <>
                <CircularProgress size={16} sx={{ mr: 1 }} />
                {translate('Calculating...')}
              </>
            ) : (
              translate('Calculate')
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VkSourcesTab;
