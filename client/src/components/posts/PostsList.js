import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Button,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  IconButton,
  Pagination
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  ThumbUp as ThumbUpIcon,
  Share as ShareIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material';

const PostsList = () => {
  const [tabValue, setTabValue] = useState(0);
  
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Posts</Typography>
      </Box>
      
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="All Posts" />
          <Tab label="Viral Posts" />
          <Tab label="Pending" />
          <Tab label="Approved" />
          <Tab label="Rejected" />
          <Tab label="Forwarded" />
        </Tabs>
      </Paper>
      
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 2 }}>
          <TextField
            label="Search Posts"
            variant="outlined"
            size="small"
            sx={{ width: 250 }}
          />
          
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="source-filter-label">VK Source</InputLabel>
            <Select
              labelId="source-filter-label"
              label="VK Source"
              value=""
            >
              <MenuItem value="">
                <em>All Sources</em>
              </MenuItem>
            </Select>
          </FormControl>
          
          <Button variant="outlined" size="medium">
            Apply Filters
          </Button>
        </Box>
        
        {/* Card View of Posts */}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  VK Group Name • June 2, 2023
                </Typography>
                <Typography variant="body1" sx={{ mb: 1.5 }}>
                  This is a sample post text that would appear in the card. It might be truncated if it's too long...
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <VisibilityIcon fontSize="small" sx={{ mr: 0.5 }} />
                    <Typography variant="body2">5.2K</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <ThumbUpIcon fontSize="small" sx={{ mr: 0.5 }} />
                    <Typography variant="body2">120</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <ShareIcon fontSize="small" sx={{ mr: 0.5 }} />
                    <Typography variant="body2">35</Typography>
                  </Box>
                </Box>
              </CardContent>
              <Box sx={{ px: 2, pb: 2 }}>
                <Chip 
                  label="Viral" 
                  color="success" 
                  size="small" 
                  sx={{ mr: 1 }} 
                />
                <Chip 
                  label="Pending" 
                  color="warning" 
                  size="small" 
                />
              </Box>
              <CardActions sx={{ justifyContent: 'space-between' }}>
                <Box>
                  <IconButton size="small" color="success" title="Approve">
                    <CheckCircleIcon />
                  </IconButton>
                  <IconButton size="small" color="error" title="Reject">
                    <CancelIcon />
                  </IconButton>
                </Box>
                <IconButton size="small" title="View Original Post">
                  <OpenInNewIcon />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        </Grid>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination count={10} color="primary" />
        </Box>
      </Paper>
    </Box>
  );
};

export default PostsList; 