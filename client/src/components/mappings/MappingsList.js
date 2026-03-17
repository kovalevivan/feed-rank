import React, { useState, useEffect } from 'react';
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
  TextField,
  Tooltip,
  CircularProgress,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Switch
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Link as LinkIcon,
  Error as ErrorIcon,
  FolderOpen as FolderIcon,
  Source as SourceIcon
} from '@mui/icons-material';
import { useTranslation } from '../../translations/TranslationContext';

const MappingsList = () => {
  // State for mappings data
  const [mappings, setMappings] = useState([]);
  const [filteredMappings, setFilteredMappings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const translate = useTranslation();
  
  // State for UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // State for delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mappingToDelete, setMappingToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Fetch mappings from API
  useEffect(() => {
    const fetchMappings = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/mappings');
        
        // Filter out any mappings with missing sources/groups and channels
        const validMappings = response.data.filter(
          mapping => (mapping.sourceGroup || mapping.vkSource || mapping.vkSourceGroup || mapping.telegramSource) && mapping.telegramChannel
        );
        
        // If there are invalid mappings, clean them up on the server (don't wait)
        const invalidMappings = response.data.filter(
          mapping => (!mapping.sourceGroup && !mapping.vkSource && !mapping.vkSourceGroup && !mapping.telegramSource) || !mapping.telegramChannel
        );
        
        if (invalidMappings.length > 0) {
          console.warn(`Found ${invalidMappings.length} invalid mappings with missing references`);
          // Silently try to delete invalid mappings in the background
          invalidMappings.forEach(mapping => {
            axios.delete(`/api/mappings/${mapping._id}`).catch(err => {
              console.error(`Failed to delete invalid mapping ${mapping._id}:`, err);
            });
          });
        }
        
        setMappings(validMappings);
        setFilteredMappings(validMappings);
        setLoading(false);
      } catch (err) {
        setError(err.response?.data?.message || translate('Failed to fetch mappings'));
        setLoading(false);
      }
    };
    
    fetchMappings();
  }, [translate]);
  
  // Filter mappings when search term changes
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredMappings(mappings);
      return;
    }
    
    const lowercaseSearch = searchTerm.toLowerCase();
    const filtered = mappings.filter(mapping => 
      (mapping.sourceGroup?.name?.toLowerCase().includes(lowercaseSearch)) ||
      (mapping.vkSource?.name?.toLowerCase().includes(lowercaseSearch)) ||
      (mapping.vkSourceGroup?.name?.toLowerCase().includes(lowercaseSearch)) ||
      (mapping.telegramSource?.name?.toLowerCase().includes(lowercaseSearch)) ||
      (mapping.telegramChannel?.name?.toLowerCase().includes(lowercaseSearch))
    );
    
    setFilteredMappings(filtered);
  }, [searchTerm, mappings]);
  
  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };
  
  // Handle delete button click
  const handleDeleteClick = (mapping) => {
    setMappingToDelete(mapping);
    setDeleteDialogOpen(true);
  };
  
  // Handle cancel delete
  const handleDeleteCancel = () => {
    setMappingToDelete(null);
    setDeleteDialogOpen(false);
  };
  
  // Handle confirm delete
  const handleDeleteConfirm = async () => {
    if (!mappingToDelete) return;
    
    try {
      setDeleteLoading(true);
      await axios.delete(`/api/mappings/${mappingToDelete._id}`);
      
      // Update mappings list
      setMappings(prevMappings => 
        prevMappings.filter(m => m._id !== mappingToDelete._id)
      );
      
      setSuccess(translate('Mapping deleted successfully'));
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.message || translate('Failed to delete mapping'));
      
      // Clear error message after 3 seconds
      setTimeout(() => {
        setError('');
      }, 3000);
    } finally {
      setDeleteLoading(false);
      setMappingToDelete(null);
      setDeleteDialogOpen(false);
    }
  };
  
  // Handle toggle active state
  const handleToggleActive = async (mapping) => {
    try {
      const updatedMapping = { 
        ...mapping,
        active: !mapping.active
      };
      
      // Update in the API
      await axios.put(`/api/mappings/${mapping._id}`, { 
        active: !mapping.active 
      });
      
      // Update in the local state
      setMappings(prevMappings => 
        prevMappings.map(m => 
          m._id === mapping._id ? { ...m, active: !m.active } : m
        )
      );
      
      setSuccess(translate(`Mapping ${updatedMapping.active ? 'activated' : 'deactivated'} successfully`));
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.message || translate('Failed to update mapping'));
      
      // Clear error message after 3 seconds
      setTimeout(() => {
        setError('');
      }, 3000);
    }
  };
  
  // Helper to get source group display info
  const getSourceGroupDisplayInfo = (mapping) => {
    if (mapping.sourceGroup) {
      const vkCount = mapping.sourceGroup.vkSources?.length || 0;
      const telegramCount = mapping.sourceGroup.telegramSources?.length || 0;
      const totalCount = vkCount + telegramCount;
      
      return {
        name: mapping.sourceGroup.name,
        id: mapping.sourceGroup._id,
        type: 'sourceGroup',
        vkCount,
        telegramCount,
        totalCount,
        icon: <FolderIcon fontSize="small" sx={{ mr: 1, color: 'success.main' }} />
      };
    } else if (mapping.vkSourceGroup) {
      // Legacy VK source group
      return {
        name: mapping.vkSourceGroup.name,
        id: mapping.vkSourceGroup._id,
        type: 'legacyVkGroup',
        sourcesCount: mapping.vkSourceGroup.sources?.length || 0,
        icon: <FolderIcon fontSize="small" sx={{ mr: 1, color: 'success.main' }} />
      };
    } else if (mapping.vkSource) {
      // Legacy individual VK source
      return {
        name: mapping.vkSource.name,
        id: mapping.vkSource._id,
        type: 'legacyVkSource',
        icon: <SourceIcon fontSize="small" sx={{ mr: 1, color: 'warning.main' }} />
      };
    } else if (mapping.telegramSource) {
      // Legacy individual Telegram source
      return {
        name: mapping.telegramSource.name,
        id: mapping.telegramSource._id,
        type: 'legacyTelegramSource',
        username: mapping.telegramSource.username,
        icon: <SourceIcon fontSize="small" sx={{ mr: 1, color: 'warning.main' }} />
      };
    } else {
      return {
        name: translate('Source not found'),
        id: null,
        type: 'unknown',
        icon: <ErrorIcon fontSize="small" sx={{ mr: 1, color: 'error.main' }} />
      };
    }
  };
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{translate('Mappings')}</Typography>
        <Button
          component={RouterLink}
          to="/app/mappings/new"
          variant="contained"
          startIcon={<AddIcon />}
        >
          {translate('Add Mapping')}
        </Button>
      </Box>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <TextField
            label={translate('Search Mappings')}
            variant="outlined"
            size="small"
            sx={{ width: 300 }}
            value={searchTerm}
            onChange={handleSearchChange}
            disabled={loading}
          />
        </Box>
        
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{translate('Source Group')}</TableCell>
                <TableCell>{translate('Sources')}</TableCell>
                <TableCell>{translate('Telegram Channel')}</TableCell>
                <TableCell align="right">{translate('Actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    <CircularProgress size={24} sx={{ my: 2 }} />
                  </TableCell>
                </TableRow>
              ) : filteredMappings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    <Typography variant="body1">
                      {mappings.length === 0
                        ? translate("No mappings configured yet. Create a mapping to connect source groups to Telegram channels.")
                        : translate("No mappings match your search.")}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredMappings.map(mapping => {
                  const sourceInfo = getSourceGroupDisplayInfo(mapping);
                  
                  return (
                    <TableRow key={mapping._id}>
                      {/* Source Group Column */}
                      <TableCell>
                        <Tooltip title={sourceInfo.id ? `ID: ${sourceInfo.id}` : translate('Source not found')}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {sourceInfo.icon}
                            <Typography variant="body2">
                              {sourceInfo.name}
                            </Typography>
                            {/* No legacy label shown */}
                          </Box>
                        </Tooltip>
                      </TableCell>
                      
                      {/* Sources Column */}
                      <TableCell>
                        {sourceInfo.type === 'sourceGroup' ? (
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {sourceInfo.vkCount > 0 && (
                              <Chip 
                                label={`VK: ${sourceInfo.vkCount}`} 
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            )}
                            {sourceInfo.telegramCount > 0 && (
                              <Chip 
                                label={`Telegram: ${sourceInfo.telegramCount}`} 
                                size="small"
                                color="secondary"
                                variant="outlined"
                              />
                            )}
                            {sourceInfo.totalCount === 0 && (
                              <Chip 
                                label={translate('No sources')} 
                                size="small"
                                color="default"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        ) : sourceInfo.type === 'legacyVkGroup' ? (
                          <Chip 
                            label={`VK: ${sourceInfo.sourcesCount}`} 
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        ) : sourceInfo.type === 'legacyVkSource' ? (
                          <Chip 
                            label={translate('VK Individual')} 
                            size="small"
                            color="warning"
                            variant="outlined"
                          />
                        ) : sourceInfo.type === 'legacyTelegramSource' ? (
                          <Chip 
                            label={translate('Telegram Individual')} 
                            size="small"
                            color="warning"
                            variant="outlined"
                          />
                        ) : (
                          <Chip 
                            label={translate('Unknown')} 
                            size="small"
                            color="error"
                            variant="outlined"
                          />
                        )}
                      </TableCell>
                      
                      {/* Telegram Channel Column */}
                      <TableCell>
                        {mapping.telegramChannel ? (
                          <Tooltip title={`ID: ${mapping.telegramChannel._id}`}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              {mapping.telegramChannel.name}
                            </Box>
                          </Tooltip>
                        ) : (
                          <Box sx={{ display: 'flex', alignItems: 'center', color: 'error.main' }}>
                            <ErrorIcon fontSize="small" sx={{ mr: 1 }} />
                            <Typography variant="body2">{translate('Channel not found')}</Typography>
                          </Box>
                        )}
                      </TableCell>
                      
                      {/* Actions Column */}
                      <TableCell align="right">
                        <Tooltip title={translate("Delete Mapping")}>
                          <IconButton 
                            onClick={() => handleDeleteClick(mapping)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          {translate('What are Mappings?')}
        </Typography>
        <Typography variant="body1" paragraph>
          {translate('Mappings define which VK public group posts are forwarded to which Telegram channels.')}
        </Typography>
        <Typography variant="body1" paragraph>
          {translate('You can create mappings in two ways:')}
        </Typography>
        <ul>
          <li>
            <Typography variant="body1">
              <strong>{translate('Individual Source Mapping')}</strong>: {translate('Connect a single VK source to a Telegram channel')}
            </Typography>
          </li>
          <li>
            <Typography variant="body1">
              <strong>{translate('Group Mapping')}</strong>: {translate('Connect a group of VK sources to a Telegram channel, simplifying management of multiple sources')}
            </Typography>
          </li>
        </ul>
        <Typography variant="body1">
          {translate('Mappings only affect posts that are identified as viral based on your threshold settings.')}
        </Typography>
      </Paper>
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
      >
        <DialogTitle>{translate('Delete Mapping')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {translate('Are you sure you want to delete the mapping between')} 
            "{mappingToDelete?.vkSource?.name || mappingToDelete?.vkSourceGroup?.name || translate('Unknown source')}" 
            {translate('and')} 
            "{mappingToDelete?.telegramChannel?.name || translate('Unknown channel')}"?
            {translate('This action cannot be undone.')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleteLoading}>
            {translate('Cancel')}
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            variant="contained"
            disabled={deleteLoading}
            startIcon={deleteLoading ? <CircularProgress size={20} /> : null}
          >
            {deleteLoading ? translate('Deleting...') : translate('Delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MappingsList; 
