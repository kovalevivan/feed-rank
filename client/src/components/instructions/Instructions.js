import React from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Divider, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemIcon,
  Card,
  CardContent,
  Grid,
  Link,
  Button
} from '@mui/material';
import { 
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  ArrowForward as ArrowForwardIcon
} from '@mui/icons-material';
import { useTranslation } from '../../translations/TranslationContext';
import { Link as RouterLink } from 'react-router-dom';

const Instructions = () => {
  const translate = useTranslation();

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {translate('Instructions')}
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom color="primary">
          {translate('Welcome to FeedRank')}
        </Typography>
        
        <Typography paragraph>
          {translate('FeedRank service description')}
        </Typography>

        <Divider sx={{ my: 3 }} />
        
        <Typography variant="h6" gutterBottom color="primary">
          {translate('1. VK Sources Setup')}
        </Typography>
        
        <List>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="primary" />
            </ListItemIcon>
            <ListItemText 
              primary={translate('Add VK Groups')}
              secondary={translate('Go to VK Sources section and click Add Source. Specify exact group name from its URL (e.g., techcrunch from vk.com/techcrunch).')}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="primary" />
            </ListItemIcon>
            <ListItemText 
              primary={translate('Configure Virality Threshold')}
              secondary={translate('You can choose automatic threshold calculation based on view statistics or set it manually. Automatic threshold is calculated using statistical methods.')}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="primary" />
            </ListItemIcon>
            <ListItemText 
              primary={translate('Set Check Frequency')}
              secondary={translate('Specify how often the system should check the group for new viral posts. Minimum interval is 5 minutes, recommended is 60 minutes.')}
            />
          </ListItem>
        </List>

        <Box sx={{ mt: 2, mb: 2, display: 'flex', justifyContent: 'center' }}>
          <Button 
            component={RouterLink} 
            to="/sources" 
            variant="contained" 
            endIcon={<ArrowForwardIcon />}
            sx={{ mx: 1 }}
          >
            {translate('Go to VK Sources')}
          </Button>
        </Box>

        <Divider sx={{ my: 3 }} />
        
        <Typography variant="h6" gutterBottom color="primary">
          {translate('2. Telegram Channels Setup')}
        </Typography>
        
        <List>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="primary" />
            </ListItemIcon>
            <ListItemText 
              primary={translate('Add FeedRank Bot to Your Channel')}
              secondary={translate('First add the bot as an administrator to your Telegram channel with permission to post messages.')}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="primary" />
            </ListItemIcon>
            <ListItemText 
              primary={translate('Add Channel to the System')}
              secondary={translate('Go to Telegram Channels section and click Add Channel. You can add a channel by ID or by username (@username).')}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="primary" />
            </ListItemIcon>
            <ListItemText 
              primary={translate('Test Connection')}
              secondary={translate('Click on the send message icon in the channels list to send a test message and ensure the connection works.')}
            />
          </ListItem>
        </List>

        <Box sx={{ mt: 2, mb: 2, display: 'flex', justifyContent: 'center' }}>
          <Button 
            component={RouterLink} 
            to="/channels" 
            variant="contained" 
            endIcon={<ArrowForwardIcon />}
            sx={{ mx: 1 }}
          >
            {translate('Go to Telegram Channels')}
          </Button>
        </Box>

        <Divider sx={{ my: 3 }} />
        
        <Typography variant="h6" gutterBottom color="primary">
          {translate('3. Creating Mappings')}
        </Typography>
        
        <List>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="primary" />
            </ListItemIcon>
            <ListItemText 
              primary={translate('Link Sources to Channels')}
              secondary={translate('Go to Mappings section and click Add Mapping. Select a VK source and a Telegram channel to create a connection between them.')}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <InfoIcon color="info" />
            </ListItemIcon>
            <ListItemText 
              primary={translate('One-to-One or Many-to-One')}
              secondary={translate('You can direct posts from one VK group to one Telegram channel or collect posts from multiple groups into one channel.')}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <WarningIcon color="warning" />
            </ListItemIcon>
            <ListItemText 
              primary={translate('Important')}
              secondary={translate('Both the VK source and the Telegram channel must be active for the mapping to work.')}
            />
          </ListItem>
        </List>

        <Box sx={{ mt: 2, mb: 2, display: 'flex', justifyContent: 'center' }}>
          <Button 
            component={RouterLink} 
            to="/mappings" 
            variant="contained" 
            endIcon={<ArrowForwardIcon />}
            sx={{ mx: 1 }}
          >
            {translate('Go to Mappings')}
          </Button>
        </Box>

        <Divider sx={{ my: 3 }} />
        
        <Typography variant="h6" gutterBottom color="primary">
          {translate('4. System Monitoring')}
        </Typography>
        
        <Grid container spacing={3} sx={{ mt: 1 }}>
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" color="primary" gutterBottom>
                  {translate('Dashboard')}
                </Typography>
                <Typography variant="body2" paragraph>
                  {translate('The main page displays statistics on pending and forwarded posts, as well as a list of recent viral posts.')}
                </Typography>
                <Button 
                  component={RouterLink} 
                  to="/" 
                  variant="outlined" 
                  size="small" 
                  fullWidth
                >
                  {translate('Dashboard')}
                </Button>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" color="primary" gutterBottom>
                  {translate('Threshold Statistics')}
                </Typography>
                <Typography variant="body2" paragraph>
                  {translate('In the VK Sources section, when editing a source, you can view detailed view statistics and configure the virality threshold calculation.')}
                </Typography>
                <Button 
                  component={RouterLink} 
                  to="/sources" 
                  variant="outlined" 
                  size="small" 
                  fullWidth
                >
                  {translate('Threshold Statistics')}
                </Button>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" color="primary" gutterBottom>
                  {translate('Settings')}
                </Typography>
                <Typography variant="body2" paragraph>
                  {translate('In the settings section, you can check the connection status to the VK API, Telegram bot, and database.')}
                </Typography>
                <Button 
                  component={RouterLink} 
                  to="/settings" 
                  variant="outlined" 
                  size="small" 
                  fullWidth
                >
                  {translate('Settings')}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        
        <Divider sx={{ my: 3 }} />
        
        <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
          <Typography variant="subtitle1" gutterBottom>
            {translate('Additional Help')}
          </Typography>
          <Typography variant="body2">
            {translate('If you have questions or problems using the system, please contact technical support.')}
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default Instructions; 