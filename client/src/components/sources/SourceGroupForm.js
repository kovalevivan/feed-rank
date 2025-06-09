import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  Divider,
  CircularProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import {
  fetchVkSourceGroupById,
  createVkSourceGroup,
  updateVkSourceGroup,
  addSourceToGroup,
  removeSourceFromGroup,
  clearVkSourceGroupsError,
  clearCurrentVkSourceGroup,
  resetSuccess,
  fetchGlobalStopWords
} from '../../redux/slices/vkSourceGroupsSlice';
import { fetchVkSources } from '../../redux/slices/vkSourcesSlice';
import ApiErrorAlert from '../common/ApiErrorAlert';
import { useTranslation } from '../../translations/TranslationContext';

const SourceGroupForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const translate = useTranslation();
  
  const { currentVkSourceGroup, loading, creating, updating, error, success } = useSelector((state) => state.vkSourceGroups);
  const { vkSources } = useSelector((state) => state.vkSources);
  
  // Local state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    active: true
  });
  const [stopWordsInput, setStopWordsInput] = useState('');
  const [globalStopWords, setGlobalStopWords] = useState([]);
  const [addSourceDialogOpen, setAddSourceDialogOpen] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [availableSources, setAvailableSources] = useState([]);
  
  // Define isEditMode early so it can be used in useEffect dependencies
  const isEditMode = id && id !== 'new';
  const isSubmitting = creating || updating;
  
  // Load sources and current group if editing
  useEffect(() => {
    dispatch(fetchVkSources());
    
    if (isEditMode) {
      console.log(`🔍 Attempting to fetch group with ID: ${id}`);
      dispatch(fetchVkSourceGroupById(id))
        .unwrap()
        .then(response => {
          console.log('✅ Successfully fetched group:', response);
        })
        .catch(error => {
          console.error('❌ Failed to fetch group:', error);
        });
    } else {
      dispatch(clearCurrentVkSourceGroup());
    }
    
    // Fetch global stop words for display
    dispatch(fetchGlobalStopWords()).then((action) => {
      if (action.payload) {
        setGlobalStopWords(action.payload);
      }
    });
    
    // Cleanup on unmount
    return () => {
      dispatch(clearCurrentVkSourceGroup());
      dispatch(clearVkSourceGroupsError());
      dispatch(resetSuccess());
    };
  }, [dispatch, id, isEditMode]);
  
  // Update form data when currentVkSourceGroup changes
  useEffect(() => {
    if (currentVkSourceGroup) {
      setFormData({
        name: currentVkSourceGroup.name || '',
        description: currentVkSourceGroup.description || '',
        active: currentVkSourceGroup.active !== undefined ? currentVkSourceGroup.active : true
      });
      
      // Set stop words input
      if (currentVkSourceGroup.stopWords && Array.isArray(currentVkSourceGroup.stopWords)) {
        setStopWordsInput(currentVkSourceGroup.stopWords.join('\n'));
      } else {
        setStopWordsInput('');
      }
    }
  }, [currentVkSourceGroup]);
  
  // Filter available sources when sources or currentVkSourceGroup changes
  useEffect(() => {
    if (vkSources.length > 0) {
      if (currentVkSourceGroup && currentVkSourceGroup.sources) {
        // Filter out sources that are already in the group
        // Convert ObjectIDs to strings for proper comparison
        const currentSourceIds = currentVkSourceGroup.sources.map(source => 
          typeof source === 'object' ? source._id : source
        );
        
        setAvailableSources(vkSources.filter(source => 
          !currentSourceIds.some(id => id === source._id)
        ));
      } else {
        setAvailableSources(vkSources);
      }
    }
  }, [vkSources, currentVkSourceGroup]);
  
  // Redirect after successful submission
  useEffect(() => {
    if (success) {
      navigate('/source-groups');
    }
  }, [success, navigate]);
  
  // Input change handler
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };
  
  // Navigation handler - make sure to reset success state
  const handleNavigateBack = () => {
    dispatch(resetSuccess());
    navigate('/source-groups');
  };
  
  // Form submission handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Process stop words input into array
    const stopWords = stopWordsInput
      .split(/[\n,]/)
      .map(word => word.trim())
      .filter(word => word.length > 0);
    
    const groupData = {
      ...formData,
      stopWords
    };
    
    try {
      if (isEditMode) {
        await dispatch(updateVkSourceGroup({ id, groupData })).unwrap();
      } else {
        await dispatch(createVkSourceGroup(groupData)).unwrap();
      }
      
      // Navigate back to groups list on success
      navigate('/source-groups');
    } catch (error) {
      // Error is handled by the slice
      console.error('Error saving VK source group:', error);
    }
  };
  
  // Add source dialog handlers
  const handleAddSourceDialogOpen = () => {
    setAddSourceDialogOpen(true);
    setSelectedSourceId(availableSources.length > 0 ? availableSources[0]._id : '');
  };
  
  const handleAddSourceDialogClose = () => {
    setAddSourceDialogOpen(false);
    setSelectedSourceId('');
  };
  
  // Add source to group
  const handleAddSource = () => {
    if (selectedSourceId) {
      console.log('Adding source to group:', { groupId: id, sourceId: selectedSourceId });
      dispatch(addSourceToGroup({ groupId: id, sourceId: selectedSourceId }))
        .unwrap()
        .then(result => {
          console.log('Source added successfully:', result);
          handleAddSourceDialogClose();
        })
        .catch(error => {
          console.error('Failed to add source:', error);
        });
    } else {
      console.warn('No source selected to add');
    }
  };
  
  // Remove source from group
  const handleRemoveSource = (sourceId) => {
    if (!sourceId) {
      console.warn('No source ID provided for removal');
      return;
    }
    
    console.log('Removing source from group:', { groupId: id, sourceId });
    dispatch(removeSourceFromGroup({ groupId: id, sourceId }))
      .unwrap()
      .then(result => {
        console.log('Source removed successfully:', result);
      })
      .catch(error => {
        console.error('Failed to remove source:', error);
      });
  };
  
  // Handle error close
  const handleErrorClose = () => {
    dispatch(clearVkSourceGroupsError());
  };
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {isEditMode ? translate('Edit VK Source Group') : translate('Add VK Source Group')}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={handleNavigateBack}
        >
          {translate('Back to Groups')}
        </Button>
      </Box>
      
      {error && <ApiErrorAlert error={error} onClose={handleErrorClose} />}
      
      {isEditMode && !loading && !currentVkSourceGroup && !error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load the source group. The group may not exist or you may not have permission to view it.
          <Button 
            variant="outlined" 
            size="small" 
            sx={{ ml: 2 }} 
            onClick={handleNavigateBack}
          >
            {translate('Back to Groups')}
          </Button>
        </Alert>
      )}
      
      <Paper sx={{ p: 3 }}>
        <Box component="form" onSubmit={handleSubmit}>
          <Typography variant="h6" gutterBottom>
            {translate('Group Details')}
          </Typography>
          
          <TextField
            fullWidth
            label={translate('Group Name')}
            name="name"
            value={formData.name}
            onChange={handleChange}
            margin="normal"
            required
          />
          
          <TextField
            fullWidth
            label={translate('Description')}
            name="description"
            value={formData.description}
            onChange={handleChange}
            margin="normal"
            multiline
            rows={2}
            placeholder={translate('Optional description for this group')}
          />
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="h6" gutterBottom>
            {translate('Stop Words')}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {translate('Words to filter out from posts in this group. These will be combined with global stop words.')}
          </Typography>
          
          {globalStopWords.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {translate('Global Stop Words')} ({globalStopWords.length}):
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                {globalStopWords.join(', ')}
              </Typography>
            </Box>
          )}
          
          <TextField
            fullWidth
            label={translate('Group Stop Words')}
            multiline
            rows={4}
            placeholder={translate('Enter words separated by commas or new lines')}
            value={stopWordsInput}
            onChange={(e) => setStopWordsInput(e.target.value)}
            helperText={translate('These stop words will be added to the global stop words for sources in this group')}
            margin="normal"
          />
          
          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.active}
                  onChange={handleChange}
                  name="active"
                  color="primary"
                />
              }
              label={translate('Active')}
            />
            <Typography variant="body2" color="textSecondary">
              {translate('When active, this group can be used in mappings and sources in it will be processed.')}
            </Typography>
          </Box>
          
          <Divider sx={{ my: 3 }} />
          
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="button"
              variant="outlined"
              onClick={handleNavigateBack}
              sx={{ mr: 2 }}
            >
              {translate('Cancel')}
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={isSubmitting ? <CircularProgress size={20} /> : <SaveIcon />}
              disabled={isSubmitting}
            >
              {isSubmitting ? translate('Saving...') : translate('Save Group')}
            </Button>
          </Box>
        </Box>
      </Paper>
      
      {/* Sources section - only show for existing groups */}
      {isEditMode && currentVkSourceGroup && (
        <Paper sx={{ p: 3, mt: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              {translate('Sources in this Group')}
            </Typography>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleAddSourceDialogOpen}
              disabled={availableSources.length === 0}
            >
              {translate('Add Source')}
            </Button>
          </Box>
          
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          ) : currentVkSourceGroup.sources && currentVkSourceGroup.sources.length > 0 ? (
            <List sx={{ width: '100%' }}>
              {currentVkSourceGroup.sources.map((source) => (
                <ListItem key={typeof source === 'object' ? source._id : source} divider>
                  <ListItemText
                    primary={typeof source === 'object' ? source.name : 'Loading...'}
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                        {typeof source === 'object' && (
                          <Chip
                            label={source.active ? translate('Active') : translate('Inactive')}
                            color={source.active ? 'success' : 'default'}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      color="error"
                      onClick={() => handleRemoveSource(typeof source === 'object' ? source._id : source)}
                      disabled={updating}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          ) : (
            <Alert severity="info" sx={{ mt: 2 }}>
              {translate('This group has no sources yet. Add sources to include them in this group.')}
            </Alert>
          )}
        </Paper>
      )}
      
      {/* Add Source Dialog */}
      <Dialog open={addSourceDialogOpen} onClose={handleAddSourceDialogClose}>
        <DialogTitle>{translate('Add Source to Group')}</DialogTitle>
        <DialogContent>
          {availableSources.length === 0 ? (
            <Alert severity="info" sx={{ mt: 1 }}>
              {translate('All available sources are already in this group.')}
            </Alert>
          ) : (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel id="source-select-label">{translate('Select Source')}</InputLabel>
                  <Select
                    labelId="source-select-label"
                    value={selectedSourceId}
                    label={translate('Select Source')}
                    onChange={(e) => setSelectedSourceId(e.target.value)}
                  >
                    {availableSources.map((source) => (
                      <MenuItem key={source._id} value={source._id}>
                        {source.name} {!source.active && `(${translate('Inactive')})`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleAddSourceDialogClose}>{translate('Cancel')}</Button>
          <Button 
            onClick={handleAddSource}
            color="primary"
            disabled={!selectedSourceId || updating}
            variant="contained"
          >
            {updating ? (
              <CircularProgress size={24} />
            ) : (
              translate('Add Source')
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SourceGroupForm; 