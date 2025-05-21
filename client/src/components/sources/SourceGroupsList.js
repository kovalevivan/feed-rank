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
  fetchVkSourceGroups,
  deleteVkSourceGroup,
  clearVkSourceGroupsError,
  resetSuccess
} from '../../redux/slices/vkSourceGroupsSlice';
import ApiErrorAlert from '../common/ApiErrorAlert';
import { useTranslation } from '../../translations/TranslationContext';

const SourceGroupsList = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const translate = useTranslation();
  
  const { vkSourceGroups, loading, error, deleting } = useSelector((state) => state.vkSourceGroups);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Load groups on component mount and reset success state
  useEffect(() => {
    // Reset the success state to prevent redirects when navigating back from a form
    dispatch(resetSuccess());
    
    // Fetch the groups
    dispatch(fetchVkSourceGroups());
    
    // Clean up
    return () => {
      dispatch(clearVkSourceGroupsError());
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
      await dispatch(deleteVkSourceGroup(groupToDelete._id));
      handleDeleteConfirmClose();
    }
  };
  
  // Handle add new group
  const handleAddGroup = () => {
    navigate('/source-groups/new');
  };
  
  // Handle error close
  const handleErrorClose = () => {
    dispatch(clearVkSourceGroupsError());
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
  const paginatedGroups = vkSourceGroups.slice(
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
        ) : vkSourceGroups.length === 0 ? (
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
                    <TableCell>{translate('Status')}</TableCell>
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
                        {group.sources && group.sources.length > 0 ? (
                          <Chip 
                            label={`${group.sources.length} ${translate('sources')}`} 
                            color="primary" 
                            variant="outlined" 
                          />
                        ) : (
                          <Chip 
                            label={translate('No sources')} 
                            color="default" 
                            variant="outlined" 
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {group.active ? (
                          <Chip
                            icon={<CheckIcon />}
                            label={translate('Active')}
                            color="success"
                            size="small"
                          />
                        ) : (
                          <Chip
                            icon={<WarningIcon />}
                            label={translate('Inactive')}
                            color="default"
                            size="small"
                          />
                        )}
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
                            disabled={deleting}
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
              count={vkSourceGroups.length}
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
        <DialogTitle>{translate('Delete VK Source Group')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {translate('Are you sure you want to delete the group')} "{groupToDelete?.name}"?
            {translate('This action cannot be undone and will remove all associated mappings.')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteConfirmClose} disabled={deleting}>
            {translate('Cancel')}
          </Button>
          <Button
            onClick={handleDeleteGroup}
            color="error"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {deleting ? translate('Deleting...') : translate('Delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SourceGroupsList; 