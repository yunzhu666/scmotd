const express = require('express');
const router = express.Router();
const controller = require('../controllers/ServerController');

// ScKey 公开服务器接口
router.post('/server/list', (req, res) => controller.serverList(req, res));
router.get('/server/list', (req, res) => controller.serverList(req, res));
router.post('/server/motd', (req, res) => controller.probeMotd(req, res));
router.post('/server/version/list', (req, res) => controller.listVersions(req, res));
router.get('/server/version/list', (req, res) => controller.listVersions(req, res));

// ScKey 管理端服务器列表（权限校验由上游网关或后续登录模块接入）
router.post('/admin/server/list', (req, res) => controller.adminServerList(req, res));
router.get('/admin/server/list', (req, res) => controller.adminServerList(req, res));

// ScKey 账号和服务器写接口：转发到上游，使用请求 Authorization 或 .env 的 SCKEY_BEARER_TOKEN。
router.post('/account/info', controller.upstream('account/info'));
router.post('/account/servers', controller.upstream('account/servers'));
router.post('/server/join', controller.upstream('server/join'));
router.post('/server/left', controller.upstream('server/left'));
router.post('/server/verify', controller.upstream('server/verify'));
router.post('/server/moderate', controller.upstream('server/moderate'));
router.post('/server/player-sync/config', controller.upstream('server/player-sync/config'));
router.post('/server/player-sync/lock', controller.upstream('server/player-sync/lock'));
router.post('/server/player-sync/unlock', controller.upstream('server/player-sync/unlock'));
router.post('/server/player-sync/pull', controller.upstream('server/player-sync/pull'));
router.post('/server/player-sync/push', controller.upstream('server/player-sync/push'));
router.post('/server/create', controller.upstream('server/create'));
router.post('/server/deleteMine', controller.upstream('server/deleteMine'));
router.post('/owner/servers', controller.upstream('owner/servers'));
router.post('/owner/servers/update', controller.upstream('owner/servers/update'));
router.post('/owner/servers/publish-state/set', controller.upstream('owner/servers/publish-state/set'));
router.post('/owner/servers/whitelist-policy/set', controller.upstream('owner/servers/whitelist-policy/set'));
router.post('/owner/servers/entry-policy/set', controller.upstream('owner/servers/entry-policy/set'));
router.post('/owner/servers/team/list', controller.upstream('owner/servers/team/list'));
router.post('/owner/servers/team/add', controller.upstream('owner/servers/team/add'));
router.post('/owner/servers/team/remove', controller.upstream('owner/servers/team/remove'));
router.post('/owner/servers/transfer', controller.upstream('owner/servers/transfer'));
router.post('/owner/servers/player-sync/list', controller.upstream('owner/servers/player-sync/list'));
router.post('/owner/servers/player-sync/save', controller.upstream('owner/servers/player-sync/save'));
router.post('/admin/server/delete', controller.upstream('admin/server/delete'));
router.post('/admin/server/approve', controller.upstream('admin/server/approve'));
router.post('/admin/server/recommend', controller.upstream('admin/server/recommend'));
router.post('/admin/server/version', controller.upstream('admin/server/version'));
router.post('/admin/server/transfer', controller.upstream('admin/server/transfer'));
router.post('/admin/server/entry-policy', controller.upstream('admin/server/entry-policy'));
router.post('/admin/server/text-audit/list', controller.upstream('admin/server/text-audit/list'));

// 状态查询（兼容旧路径，支持 GET 和 POST）
router.get('/status', (req, res) => controller.getStatus(req, res));
router.post('/status', (req, res) => controller.getStatus(req, res));

// 健康检查
router.get('/health', (req, res) => controller.health(req, res));

// 清除缓存（管理员功能）
router.delete('/cache', (req, res) => controller.clearCache(req, res));

module.exports = router;
