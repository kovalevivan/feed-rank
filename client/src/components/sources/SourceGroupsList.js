import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
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
  CircularProgress,
  Tooltip,
  TablePagination
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Check as CheckIcon,
  WarningAmber as WarningIcon
} from '@mui/icons-material';
import {
  fetchSourceGroups,
  deleteSourceGroup,
  clearSourceGroupsError,
  resetSuccess
} from '../../redux/slices/sourceGroupsSlice';
import ApiErrorAlert from '../common/ApiErrorAlert';
import { useTranslation } from '../../translations/TranslationContext';

const SourceGroupsList = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const translate = useTranslation();
  
  const { sourceGroups, loading, error, deleting } = useSelector((state) => state.sourceGroups);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Load groups on component mount and reset success state
  useEffect(() => {
    // Reset the success state to prevent redirects when navigating back from a form
    dispatch(resetSuccess());
    
    // Fetch the groups
    dispatch(fetchSourceGroups());
    
    // Clean up
    return () => {
      dispatch(clearSourceGroupsError());
    };
  }, [dispatch]);
  
  // Handle edit group
  const handleEditGroup = (id) => {
    console.log(`🔍 Navigating to edit group with ID: ${id}`);
    navigate(`/source-groups/${id}`);
  };
  
  // Handle delete confirmation dialog
  const handleDeleteConfirmOpen = (group) => {
    setGroupToDelete(group);
    setDeleteDialogOpen(true);
  };
  
  const handleDeleteConfirmClose = () => {
    setDeleteDialogOpen(false);
    setGroupToDelete(null);
  };
  
  // Handle delete group
  const handleDeleteGroup = async () => {
    if (groupToDelete) {
      await dispatch(deleteSourceGroup(groupToDelete._id));
      handleDeleteConfirmClose();
    }
  };
  
  // Handle add new group
  const handleAddGroup = () => {
    navigate('/source-groups/new');
  };
  
  // Handle error close
  const handleErrorClose = () => {
    dispatch(clearSourceGroupsError());
  };
  
  // Handle pagination
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };
  
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  // Calculate pagination
  const paginatedGroups = sourceGroups.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{translate('VK Source Groups')}</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleAddGroup}
        >
          {translate('Add Group')}
        </Button>
      </Box>
      
      {error && <ApiErrorAlert error={error} onClose={handleErrorClose} />}
      
      <Paper>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : sourceGroups.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1">
              {translate('No VK source groups found. Create your first group to get started.')}
            </Typography>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleAddGroup}
              sx={{ mt: 2 }}
            >
              {translate('Add Group')}
            </Button>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{translate('Name')}</TableCell>
                    <TableCell>{translate('Description')}</TableCell>
                    <TableCell>{translate('Sources')}</TableCell>
                    <TableCell align="right">{translate('Actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedGroups.map((group) => (
                    <TableRow key={group._id}>
                      <TableCell>{group.name}</TableCell>
                      <TableCell>
                        {group.description || translate('No description')}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const vkCount = group.vkSources?.length || 0;
                          const telegramCount = group.telegramSources?.length || 0;
                          const totalCount = vkCount + telegramCount;
                          
                          if (totalCount > 0) {
                            return (
                              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                {vkCount > 0 && (
                                  <Chip 
                                    label={`VK: ${vkCount}`} 
                                    color="primary" 
                                    variant="outlined" 
                                    size="small"
                                  />
                                )}
                                {telegramCount > 0 && (
                                  <Chip 
                                    label={`Telegram: ${telegramCount}`} 
                                    color="secondary" 
                                    variant="outlined" 
                                    size="small"
                                  />
                                )}
                              </Box>
                            );
                          } else {
                            return (
                              <Chip 
                                label={translate('No sources')} 
                                color="default" 
                                variant="outlined" 
                                size="small"
                              />
                            );
                          }
                        })()}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title={translate('Edit')}>
                          <IconButton
                            color="primary"
                            onClick={() => handleEditGroup(group._id)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={translate('Delete')}>
                          <IconButton
                            color="error"
                            onClick={() => handleDeleteConfirmOpen(group)}
                            disabled={deleting[group._id]}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={sourceGroups.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              labelRowsPerPage={translate('Rows per page:')}
            />
          </>
        )}
      </Paper>
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteConfirmClose}
      >
        <DialogTitle>{translate('Delete Source Group')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {translate('Are you sure you want to delete the group')} "{groupToDelete?.name}"?
            {translate('This action cannot be undone and will remove all associated mappings.')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteConfirmClose} disabled={groupToDelete && deleting[groupToDelete._id]}>
            {translate('Cancel')}
          </Button>
          <Button
            onClick={handleDeleteGroup}
            color="error"
            disabled={groupToDelete && deleting[groupToDelete._id]}
            startIcon={groupToDelete && deleting[groupToDelete._id] ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {groupToDelete && deleting[groupToDelete._id] ? translate('Deleting...') : translate('Delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SourceGroupsList; 