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

const SourcesList = () => {
  const dispatch = useDispatch();
  const { vkSources, loading, error, success } = useSelector((state) => state.vkSources);
  const translate = useTranslation();
  
  // Local state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredSources, setFilteredSources] = useState([]);
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  
  // Load sources on mount
  useEffect(() => {
    dispatch(fetchVkSources());
  }, [dispatch]);
  
  // Filter sources when search term or sources change
  useEffect(() => {
    if (vkSources) {
      // First filter by search term
      let filtered = vkSources.filter((source) =>
        source.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      // Then sort by the selected field
      filtered = [...filtered].sort((a, b) => {
        // Get values to compare, handling undefined/null
        let valueA = a[sortField] !== undefined ? a[sortField] : '';
        let valueB = b[sortField] !== undefined ? b[sortField] : '';
        
        // For string values, convert to lowercase for comparison
        if (typeof valueA === 'string') {
          valueA = valueA.toLowerCase();
        }
        if (typeof valueB === 'string') {
          valueB = valueB.toLowerCase();
        }
        
        // Handle date fields
        if (sortField === 'lastChecked') {
          valueA = valueA ? new Date(valueA).getTime() : 0;
          valueB = valueB ? new Date(valueB).getTime() : 0;
        }
        
        // Compare based on direction
        if (sortDirection === 'asc') {
          return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
        } else {
          return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
        }
      });
      
      setFilteredSources(filtered);
    }
  }, [vkSources, searchTerm, sortField, sortDirection]);
  
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
  
  // Handle sorting
  const handleSort = (field) => {
    // If clicking the same field, toggle direction
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // If clicking a new field, set it and default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Render sort indicator
  const renderSortIndicator = (field) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };
  
  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return translate('Never');
    return new Date(dateString).toLocaleString();
  };
  
  // Handle clearing errors
  const handleErrorClose = () => {
    dispatch(clearVkSourcesError());
  };
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{translate('VK Sources')}</Typography>
        <Button
          component={RouterLink}
          to="/sources/new"
          variant="contained"
          startIcon={<AddIcon />}
        >
          {translate('Add Source')}
        </Button>
      </Box>
      
      {error && <ApiErrorAlert error={error} onClose={handleErrorClose} />}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {translate('Operation completed successfully!')}
        </Alert>
      )}
      
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <TextField
            label={translate('Search Sources')}
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
            {translate('Refresh')}
          </Button>
        </Box>
        
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell 
                  onClick={() => handleSort('name')} 
                  style={{ cursor: 'pointer' }}
                >
                  {translate('Source Name')}{renderSortIndicator('name')}
                </TableCell>
                <TableCell 
                  onClick={() => handleSort('calculatedThreshold')} 
                  style={{ cursor: 'pointer' }}
                >
                  {translate('Threshold')}{renderSortIndicator('calculatedThreshold')}
                </TableCell>
                <TableCell 
                  onClick={() => handleSort('checkFrequency')} 
                  style={{ cursor: 'pointer' }}
                >
                  {translate('Check Frequency')}{renderSortIndicator('checkFrequency')}
                </TableCell>
                <TableCell 
                  onClick={() => handleSort('postsToCheck')} 
                  style={{ cursor: 'pointer' }}
                >
                  {translate('Posts to Check')}{renderSortIndicator('postsToCheck')}
                </TableCell>
                <TableCell 
                  onClick={() => handleSort('lastChecked')} 
                  style={{ cursor: 'pointer' }}
                >
                  {translate('Last Check')}{renderSortIndicator('lastChecked')}
                </TableCell>
                <TableCell 
                  onClick={() => handleSort('active')} 
                  style={{ cursor: 'pointer' }}
                >
                  {translate('Status')}{renderSortIndicator('active')}
                </TableCell>
                <TableCell align="right">{translate('Actions')}</TableCell>
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
                    {translate('No VK sources found')}
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
                          label={source.thresholdType === 'auto' ? translate('Auto') : translate('Manual')}
                          color={source.thresholdType === 'auto' ? 'primary' : 'secondary'}
                          size="small"
                          sx={{ mr: 1 }}
                        />
                        {source.thresholdType === 'auto'
                          ? source.calculatedThreshold
                          : source.manualThreshold}{' '}
                        {translate('views')}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {source.checkFrequency === 60
                        ? translate('Hourly')
                        : source.checkFrequency < 60
                        ? `${translate('Every')} ${source.checkFrequency} ${translate('minutes')}`
                        : `${translate('Every')} ${source.checkFrequency / 60} ${translate('hours')}`}
                    </TableCell>
                    <TableCell>{source.postsToCheck}</TableCell>
                    <TableCell>{formatDate(source.lastChecked)}</TableCell>
                    <TableCell>
                      <Chip
                        label={source.active ? translate('Active') : translate('Inactive')}
                        color={source.active ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Tooltip title={translate('Calculate Threshold')}>
                          <IconButton
                            onClick={() => handleCalculateThreshold(source._id)}
                            disabled={loading}
                            color="primary"
                          >
                            <CalculateIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={translate('Process now')}>
                          <IconButton
                            onClick={() => handleProcessNow(source._id)}
                            disabled={loading}
                            color="secondary"
                          >
                            <SyncIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={translate('Edit')}>
                          <IconButton
                            component={RouterLink}
                            to={`/sources/${source._id}`}
                            color="primary"
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={translate('Delete')}>
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
        <DialogTitle>{translate('Delete VK Source')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {translate('Are you sure you want to delete the VK source')} "{selectedSource?.name}"? {translate('This action cannot be undone and will remove all associated data.')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog} color="primary">
            {translate('Cancel')}
          </Button>
          <Button onClick={confirmDelete} color="error" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : translate('Delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SourcesList; 