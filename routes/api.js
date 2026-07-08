const express = require('express');
const router = express.Router();
const controller = require('../controllers/ServerController');

// 原仓库对外入口：POST /server/motd
router.post('/server/motd', (req, res) => controller.getStatus(req, res));

// 状态查询（兼容旧路径，支持 GET 和 POST）
router.get('/status', (req, res) => controller.getStatus(req, res));
router.post('/status', (req, res) => controller.getStatus(req, res));

// 健康检查
router.get('/health', (req, res) => controller.health(req, res));

// 清除缓存（管理员功能）
router.delete('/cache', (req, res) => controller.clearCache(req, res));

module.exports = router;
