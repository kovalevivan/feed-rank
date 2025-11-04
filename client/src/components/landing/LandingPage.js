import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  AppBar,
  Toolbar,
  Stack,
  Chip,
} from '@mui/material';
import {
  TrendingUp,
  Speed,
  AutoAwesome,
  Timeline,
  GroupWork,
  EmojiEvents,
} from '@mui/icons-material';

const LandingPage = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <TrendingUp sx={{ fontSize: 48 }} />,
      title: 'Умная Аналитика',
      description: 'Автоматический анализ популярности и вовлеченности постов из соцсетей',
    },
    {
      icon: <AutoAwesome sx={{ fontSize: 48 }} />,
      title: 'Автоматический Отбор',
      description: 'Интеллектуальная фильтрация контента по метрикам и порогам качества',
    },
    {
      icon: <Speed sx={{ fontSize: 48 }} />,
      title: 'Быстрая Публикация',
      description: 'Мгновенная пересылка лучших постов в ваши Telegram каналы',
    },
    {
      icon: <Timeline sx={{ fontSize: 48 }} />,
      title: 'Детальная Статистика',
      description: 'Подробная аналитика источников и эффективности контента',
    },
    {
      icon: <GroupWork sx={{ fontSize: 48 }} />,
      title: 'Управление Группами',
      description: 'Организация источников по группам с гибкими настройками',
    },
    {
      icon: <EmojiEvents sx={{ fontSize: 48 }} />,
      title: 'Топ Контент',
      description: 'Только самые популярные и качественные материалы для вашей аудитории',
    },
  ];

  const stats = [
    { value: '1000+', label: 'Источников' },
    { value: '24/7', label: 'Мониторинг' },
    { value: '99%', label: 'Точность' },
    { value: '< 1 мин', label: 'Скорость' },
  ];

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      {/* Header */}
      <AppBar position="static" elevation={0} sx={{ background: 'transparent' }}>
        <Toolbar>
          <Typography variant="h5" sx={{ flexGrow: 1, fontWeight: 700, color: 'white' }}>
            📊 FeedRank
          </Typography>
          <Button
            color="inherit"
            onClick={() => navigate('/login')}
            sx={{ mr: 1, color: 'white' }}
          >
            Вход
          </Button>
          <Button
            variant="contained"
            onClick={() => navigate('/register')}
            sx={{
              backgroundColor: 'white',
              color: '#667eea',
              '&:hover': { backgroundColor: '#f5f5f5' },
            }}
          >
            Регистрация
          </Button>
        </Toolbar>
      </AppBar>

      {/* Hero Section */}
      <Container maxWidth="lg">
        <Box sx={{ pt: 8, pb: 6, textAlign: 'center' }}>
          <Chip
            label="🚀 Новая эра контент-маркетинга"
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              mb: 3,
              fontSize: '0.9rem',
              fontWeight: 600,
            }}
          />
          <Typography
            variant="h2"
            component="h1"
            gutterBottom
            sx={{
              fontWeight: 800,
              color: 'white',
              mb: 3,
              textShadow: '0 2px 20px rgba(0,0,0,0.2)',
            }}
          >
            Автоматизация Контента
            <br />
            Нового Поколения
          </Typography>
          <Typography
            variant="h5"
            sx={{
              color: 'rgba(255, 255, 255, 0.95)',
              mb: 5,
              fontWeight: 400,
              maxWidth: 700,
              mx: 'auto',
            }}
          >
            Умная система мониторинга ВКонтакте и Telegram для автоматического
            отбора и публикации лучшего контента в ваши каналы
          </Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            justifyContent="center"
            sx={{ mb: 6 }}
          >
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/register')}
              sx={{
                px: 5,
                py: 2,
                fontSize: '1.1rem',
                backgroundColor: 'white',
                color: '#667eea',
                '&:hover': { backgroundColor: '#f5f5f5', transform: 'translateY(-2px)' },
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              }}
            >
              Начать Бесплатно
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/app')}
              sx={{
                px: 5,
                py: 2,
                fontSize: '1.1rem',
                color: 'white',
                borderColor: 'white',
                '&:hover': {
                  borderColor: 'white',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              Открыть Приложение
            </Button>
          </Stack>

          {/* Stats */}
          <Grid container spacing={3} sx={{ mb: 8 }}>
            {stats.map((stat, index) => (
              <Grid item xs={6} md={3} key={index}>
                <Box
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: 3,
                    p: 3,
                  }}
                >
                  <Typography
                    variant="h3"
                    sx={{ color: 'white', fontWeight: 700, mb: 1 }}
                  >
                    {stat.value}
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                    {stat.label}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Features Section */}
        <Box sx={{ pb: 10 }}>
          <Typography
            variant="h3"
            align="center"
            gutterBottom
            sx={{ color: 'white', fontWeight: 700, mb: 6 }}
          >
            Возможности Платформы
          </Typography>
          <Grid container spacing={4}>
            {features.map((feature, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(10px)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 4, textAlign: 'center' }}>
                    <Box sx={{ color: '#667eea', mb: 2 }}>{feature.icon}</Box>
                    <Typography
                      variant="h5"
                      component="h3"
                      gutterBottom
                      sx={{ fontWeight: 600, mb: 2 }}
                    >
                      {feature.title}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      {feature.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* How It Works */}
        <Box sx={{ pb: 10 }}>
          <Typography
            variant="h3"
            align="center"
            gutterBottom
            sx={{ color: 'white', fontWeight: 700, mb: 6 }}
          >
            Как Это Работает
          </Typography>
          <Grid container spacing={4}>
            {[
              {
                step: '1',
                title: 'Подключите Источники',
                description: 'Добавьте группы ВКонтакте и Telegram каналы для мониторинга',
              },
              {
                step: '2',
                title: 'Настройте Критерии',
                description: 'Установите пороги популярности и параметры отбора контента',
              },
              {
                step: '3',
                title: 'Получайте Результат',
                description: 'Система автоматически отбирает и публикует лучший контент',
              },
            ].map((step, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Box
                  sx={{
                    textAlign: 'center',
                    position: 'relative',
                  }}
                >
                  <Box
                    sx={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      backgroundColor: 'white',
                      color: '#667eea',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '2rem',
                      fontWeight: 700,
                      margin: '0 auto 24px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                    }}
                  >
                    {step.step}
                  </Box>
                  <Typography
                    variant="h5"
                    gutterBottom
                    sx={{ color: 'white', fontWeight: 600, mb: 2 }}
                  >
                    {step.title}
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                    {step.description}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* CTA Section */}
        <Box
          sx={{
            pb: 10,
            textAlign: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            borderRadius: 4,
            p: 6,
          }}
        >
          <Typography
            variant="h3"
            gutterBottom
            sx={{ color: 'white', fontWeight: 700, mb: 3 }}
          >
            Готовы Начать?
          </Typography>
          <Typography
            variant="h6"
            sx={{ color: 'rgba(255, 255, 255, 0.9)', mb: 4, maxWidth: 600, mx: 'auto' }}
          >
            Присоединяйтесь к FeedRank и автоматизируйте управление контентом уже сегодня
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/register')}
            sx={{
              px: 6,
              py: 2.5,
              fontSize: '1.2rem',
              backgroundColor: 'white',
              color: '#667eea',
              '&:hover': { backgroundColor: '#f5f5f5', transform: 'translateY(-2px)' },
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            }}
          >
            Попробовать Бесплатно
          </Button>
        </Box>
      </Container>

      {/* Footer */}
      <Box
        sx={{
          mt: 8,
          py: 4,
          textAlign: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
        }}
      >
        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
          © 2025 FeedRank. Умная автоматизация контента.
        </Typography>
      </Box>
    </Box>
  );
};

export default LandingPage;

