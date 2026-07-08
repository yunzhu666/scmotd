const express = require('express');
const config = require('./config');
const logger = require('./utils/logger');
const apiRoutes = require('./routes/api');

const app = express();

// 中间件
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 请求日志
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path}`, {
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  });
  next();
});

// CORS（允许跨域）
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// 路由
app.use('/', apiRoutes);
app.use('/api', apiRoutes);

// 根路径
app.get('/', (req, res) => {
  res.json({
    service: 'Minecraft Server Status API',
    version: '1.0.0',
    endpoints: {
      'POST /server/motd': 'Probe server MOTD',
      'GET /api/status?address=xxx': 'Query server status',
      'POST /api/status': 'Query server status (JSON body)',
      'GET /api/health': 'Health check',
      'DELETE /api/cache?address=xxx': 'Clear cache',
    },
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    code: 404,
    message: 'Endpoint not found',
    data: null,
  });
});

// 错误处理
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({
    code: 2001,
    message: 'Internal server error',
    data: null,
  });
});

// 启动服务器
const { port, host } = config;
app.listen(port, host, () => {
  logger.info('Server started', {
    host,
    port,
    env: process.env.NODE_ENV || 'development'
  });
});

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;
