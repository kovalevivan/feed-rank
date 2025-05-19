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
  ThumbUp as ThumbUpIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { fetchDashboardData } from '../../redux/slices/postsSlice';
import { useTranslation } from '../../translations/TranslationContext';

const Dashboard = () => {
  const dispatch = useDispatch();
  const { dashboardData, loading } = useSelector((state) => state.posts);
  const translate = useTranslation();
  
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
  
  // Filter out any posts with missing sources to prevent errors
  const filteredRecentViralPosts = dashboardData.recentViralPosts.filter(post => post.vkSource);
  const filteredTopSources = dashboardData.topSources.filter(item => item.source);
  
  const { counts } = dashboardData;
  
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
        {translate('Dashboard')}
      </Typography>
      
      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map((card, index) => (
          <Grid item xs={12} sm={6} md={6} key={index}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" color="text.secondary">
                    {translate(card.title)}
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
                    {translate('View Sources')}
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
              {translate('Recent Viral Posts')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {filteredRecentViralPosts && filteredRecentViralPosts.length > 0 ? (
              <List>
                {filteredRecentViralPosts.map((post) => (
                  <ListItem key={post._id} divider>
                    <ListItemAvatar>
                      <Avatar src={post.attachments && post.attachments[0]?.thumbnailUrl} />
                    </ListItemAvatar>
                    <ListItemText
                      primary={truncateText(post.text, 80)}
                      secondary={
                        <React.Fragment>
                          <Typography variant="body2" component="span" color="text.primary">
                            {post.vkSource?.name || translate('Unknown source')} | {formatDate(post.publishedAt)}
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
                    {post.vkSource ? (
                      <Button
                        component={RouterLink}
                        to={`/sources/${post.vkSource._id}`}
                        variant="outlined"
                        size="small"
                      >
                        {translate('View Source')}
                      </Button>
                    ) : (
                      <Button
                        variant="outlined"
                        size="small"
                        color="error"
                        startIcon={<ErrorIcon />}
                        disabled
                      >
                        {translate('Source deleted')}
                      </Button>
                    )}
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                {translate('No viral posts found')}
              </Typography>
            )}
            
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Button
                component={RouterLink}
                to="/sources"
                variant="contained"
              >
                {translate('View All Sources')}
              </Button>
            </Box>
          </Paper>
        </Grid>
        
        {/* Top Sources */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              {translate('Top VK Sources')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {filteredTopSources && filteredTopSources.length > 0 ? (
              <List>
                {filteredTopSources.map((item, index) => (
                  <ListItem key={index} divider>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        {index + 1}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={item.source?.name || translate('Unknown Source')}
                      secondary={`${item.count} ${translate('viral posts')}`}
                    />
                    {item.source ? (
                      <Button
                        component={RouterLink}
                        to={`/sources/${item.source._id}`}
                        variant="outlined"
                        size="small"
                      >
                        {translate('Details')}
                      </Button>
                    ) : (
                      <Button
                        variant="outlined"
                        size="small"
                        color="error"
                        startIcon={<ErrorIcon />}
                        disabled
                      >
                        {translate('Source deleted')}
                      </Button>
                    )}
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                {translate('No top sources data available')}
              </Typography>
            )}
            
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Button
                component={RouterLink}
                to="/sources"
                variant="contained"
              >
                {translate('Manage Sources')}
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard; 