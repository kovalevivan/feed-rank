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

const SourcesList = () => {
  const dispatch = useDispatch();
  const { vkSources, loading, error, success } = useSelector((state) => state.vkSources);
  
  // Local state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredSources, setFilteredSources] = useState([]);
  
  // Load sources on mount
  useEffect(() => {
    dispatch(fetchVkSources());
  }, [dispatch]);
  
  // Filter sources when search term or sources change
  useEffect(() => {
    if (vkSources) {
      setFilteredSources(
        vkSources.filter((source) =>
          source.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }
  }, [vkSources, searchTerm]);
  
  // Clear success message after 3 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        dispatch(clearVkSourceSuccess());
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [success, dispatch]);
  
  // Handle delete dialog
  const openDeleteDialog = (source) => {
    setSelectedSource(source);
    setDeleteDialogOpen(true);
  };
  
  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setSelectedSource(null);
  };
  
  const confirmDelete = () => {
    if (selectedSource) {
      dispatch(deleteVkSource(selectedSource._id));
      closeDeleteDialog();
    }
  };
  
  // Handle refresh sources
  const handleRefresh = () => {
    dispatch(fetchVkSources());
  };
  
  // Handle calculate threshold
  const handleCalculateThreshold = (id) => {
    dispatch(calculateThreshold(id));
  };
  
  // Handle process now
  const handleProcessNow = (id) => {
    dispatch(processSourceNow(id));
  };
  
  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };
  
  // Handle clearing errors
  const handleErrorClose = () => {
    dispatch(clearVkSourcesError());
  };
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">VK Sources</Typography>
        <Button
          component={RouterLink}
          to="/sources/new"
          variant="contained"
          startIcon={<AddIcon />}
        >
          Add Source
        </Button>
      </Box>
      
      {error && <ApiErrorAlert error={error} onClose={handleErrorClose} />}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Operation completed successfully!
        </Alert>
      )}
      
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <TextField
            label="Search Sources"
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ width: 300 }}
          />
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
        
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Threshold</TableCell>
                <TableCell>Check Frequency</TableCell>
                <TableCell>Last Checked</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : filteredSources.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No VK sources found
                  </TableCell>
                </TableRow>
              ) : (
                filteredSources.map((source) => (
                  <TableRow key={source._id}>
                    <TableCell>
                      <Typography variant="body1">{source.name}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        {source.url}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Chip
                          label={source.thresholdType === 'auto' ? 'Auto' : 'Manual'}
                          color={source.thresholdType === 'auto' ? 'primary' : 'secondary'}
                          size="small"
                          sx={{ mr: 1 }}
                        />
                        {source.thresholdType === 'auto'
                          ? source.calculatedThreshold
                          : source.manualThreshold}{' '}
                        views
                      </Box>
                    </TableCell>
                    <TableCell>
                      {source.checkFrequency === 60
                        ? 'Hourly'
                        : source.checkFrequency < 60
                        ? `Every ${source.checkFrequency} minutes`
                        : `Every ${source.checkFrequency / 60} hours`}
                    </TableCell>
                    <TableCell>{formatDate(source.lastChecked)}</TableCell>
                    <TableCell>
                      <Chip
                        label={source.active ? 'Active' : 'Inactive'}
                        color={source.active ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Tooltip title="Calculate Threshold">
                          <IconButton
                            onClick={() => handleCalculateThreshold(source._id)}
                            disabled={loading}
                            color="primary"
                          >
                            <CalculateIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Process Now">
                          <IconButton
                            onClick={() => handleProcessNow(source._id)}
                            disabled={loading}
                            color="secondary"
                          >
                            <SyncIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton
                            component={RouterLink}
                            to={`/sources/${source._id}`}
                            color="primary"
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            onClick={() => openDeleteDialog(source)}
                            color="error"
                            disabled={loading}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={closeDeleteDialog}>
        <DialogTitle>Delete VK Source</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the VK source "{selectedSource?.name}"? This action
            cannot be undone and will remove all associated data.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog} color="primary">
            Cancel
          </Button>
          <Button onClick={confirmDelete} color="error" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SourcesList; 