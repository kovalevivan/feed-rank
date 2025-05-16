import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Paper,
  Divider,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  SendToMobile as SendToMobileIcon,
  ThumbUp as ThumbUpIcon
} from '@mui/icons-material';
import { fetchDashboardData } from '../../redux/slices/postsSlice';

const Dashboard = () => {
  const dispatch = useDispatch();
  const { dashboardData, loading } = useSelector((state) => state.posts);
  
  useEffect(() => {
    dispatch(fetchDashboardData());
  }, [dispatch]);
  
  if (loading || !dashboardData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  const { counts, recentViralPosts, topSources } = dashboardData;
  
  // Stats cards data
  const statCards = [
    {
      title: 'Pending Posts',
      value: counts.pending,
      icon: <VisibilityIcon fontSize="large" color="primary" />,
      color: 'primary.light',
      link: '/sources'
    },
    {
      title: 'Forwarded Posts',
      value: counts.forwarded,
      icon: <SendToMobileIcon fontSize="large" color="info" />,
      color: 'info.light',
      link: '/sources'
    }
  ];
  
  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  // Truncate text
  const truncateText = (text, maxLength = 100) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };
  
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map((card, index) => (
          <Grid item xs={12} sm={6} md={6} key={index}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" color="text.secondary">
                    {card.title}
                  </Typography>
                  {card.icon}
                </Box>
                <Typography variant="h4" component="div">
                  {card.value}
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Button
                    component={RouterLink}
                    to={card.link}
                    size="small"
                    variant="outlined"
                  >
                    View Sources
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      
      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Recent Viral Posts */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Recent Viral Posts
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {recentViralPosts && recentViralPosts.length > 0 ? (
              <List>
                {recentViralPosts.map((post) => (
                  <ListItem key={post._id} divider>
                    <ListItemAvatar>
                      <Avatar src={post.attachments && post.attachments[0]?.thumbnailUrl} />
                    </ListItemAvatar>
                    <ListItemText
                      primary={truncateText(post.text, 80)}
                      secondary={
                        <React.Fragment>
                          <Typography variant="body2" component="span" color="text.primary">
                            {post.vkSource?.name} | {formatDate(post.publishedAt)}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                              <VisibilityIcon fontSize="small" sx={{ mr: 0.5 }} />
                              <Typography variant="body2">
                                {post.viewCount.toLocaleString()}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <ThumbUpIcon fontSize="small" sx={{ mr: 0.5 }} />
                              <Typography variant="body2">
                                {post.likeCount.toLocaleString()}
                              </Typography>
                            </Box>
                          </Box>
                        </React.Fragment>
                      }
                    />
                    <Button
                      component={RouterLink}
                      to={`/sources/${post.vkSource._id}`}
                      variant="outlined"
                      size="small"
                    >
                      View Source
                    </Button>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No viral posts found
              </Typography>
            )}
            
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Button
                component={RouterLink}
                to="/sources"
                variant="contained"
              >
                View All Sources
              </Button>
            </Box>
          </Paper>
        </Grid>
        
        {/* Top Sources */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Top VK Sources
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {topSources && topSources.length > 0 ? (
              <List>
                {topSources.map((item, index) => (
                  <ListItem key={index} divider>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        {index + 1}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={item.source?.name || 'Unknown Source'}
                      secondary={`${item.count} viral posts`}
                    />
                    <Button
                      component={RouterLink}
                      to={`/sources/${item.source?._id}`}
                      variant="outlined"
                      size="small"
                    >
                      Details
                    </Button>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No top sources data available
              </Typography>
            )}
            
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Button
                component={RouterLink}
                to="/sources"
                variant="contained"
              >
                Manage Sources
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard; 