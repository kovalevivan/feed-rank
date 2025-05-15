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
  Link as LinkIcon
} from '@mui/icons-material';

const MappingsList = () => {
  // State for mappings data
  const [mappings, setMappings] = useState([]);
  const [filteredMappings, setFilteredMappings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
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
        setMappings(response.data);
        setFilteredMappings(response.data);
        setLoading(false);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch mappings');
        setLoading(false);
      }
    };
    
    fetchMappings();
  }, []);
  
  // Filter mappings when search term changes
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredMappings(mappings);
      return;
    }
    
    const lowercaseSearch = searchTerm.toLowerCase();
    const filtered = mappings.filter(mapping => 
      mapping.vkSource.name.toLowerCase().includes(lowercaseSearch) ||
      mapping.telegramChannel.name.toLowerCase().includes(lowercaseSearch)
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
      
      setSuccess('Mapping deleted successfully');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete mapping');
      
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
      
      setSuccess(`Mapping ${updatedMapping.active ? 'activated' : 'deactivated'} successfully`);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update mapping');
      
      // Clear error message after 3 seconds
      setTimeout(() => {
        setError('');
      }, 3000);
    }
  };
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Mappings</Typography>
        <Button
          component={RouterLink}
          to="/mappings/new"
          variant="contained"
          startIcon={<AddIcon />}
        >
          Add Mapping
        </Button>
      </Box>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <TextField
            label="Search Mappings"
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
                <TableCell>VK Source</TableCell>
                <TableCell>Telegram Channel</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
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
                        ? "No mappings configured yet. Create a mapping to connect VK sources to Telegram channels."
                        : "No mappings match your search."}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredMappings.map(mapping => (
                  <TableRow key={mapping._id}>
                    <TableCell>
                      <Tooltip title={`ID: ${mapping.vkSource._id}`}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {mapping.vkSource.name}
                        </Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={`ID: ${mapping.telegramChannel._id}`}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {mapping.telegramChannel.name}
                        </Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={mapping.active ? "Active - posts will be forwarded" : "Inactive - posts will not be forwarded"}>
                        <Switch
                          checked={mapping.active}
                          onChange={() => handleToggleActive(mapping)}
                          color="primary"
                          size="small"
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Delete Mapping">
                        <IconButton 
                          onClick={() => handleDeleteClick(mapping)}
                          color="error"
                        >
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
      
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          What are Mappings?
        </Typography>
        <Typography variant="body1" paragraph>
          Mappings define which VK public group posts are forwarded to which Telegram channels.
        </Typography>
        <Typography variant="body1" paragraph>
          You can create multiple mappings to:
        </Typography>
        <ul>
          <li>
            <Typography variant="body1">
              Forward posts from one VK group to multiple Telegram channels
            </Typography>
          </li>
          <li>
            <Typography variant="body1">
              Forward posts from multiple VK groups to one Telegram channel
            </Typography>
          </li>
        </ul>
        <Typography variant="body1">
          Mappings only affect posts that are identified as viral based on your threshold settings.
        </Typography>
      </Paper>
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
      >
        <DialogTitle>Delete Mapping</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the mapping between 
            "{mappingToDelete?.vkSource.name}" and "{mappingToDelete?.telegramChannel.name}"?
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleteLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            variant="contained"
            disabled={deleteLoading}
            startIcon={deleteLoading ? <CircularProgress size={20} /> : null}
          >
            {deleteLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MappingsList; 