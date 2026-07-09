const express = require('express');
const router = express.Router();
const controller = require('../controllers/ServerController');

// ScKey å…¬å¼€æœåŠ¡å™¨æŽ¥å£
router.post('/server/list', controller.upstream('server/list'));
router.get('/server/list', controller.upstream('server/list'));
router.post('/server/motd', (req, res) => controller.probeMotd(req, res));
router.get('/server/motd/image', (req, res) => controller.getStatusImage(req, res));
router.post('/server/motd/image', (req, res) => controller.getStatusImage(req, res));
router.post('/server/version/list', controller.upstream('server/version/list'));
router.get('/server/version/list', controller.upstream('server/version/list'));

// ScKey ç®¡ç†ç«¯æœåŠ¡å™¨åˆ—è¡¨ï¼ˆæƒé™æ ¡éªŒç”±ä¸Šæ¸¸ç½‘å…³æˆ–åŽç»­ç™»å½•æ¨¡å—æŽ¥å…¥ï¼‰
router.post('/admin/server/list', controller.upstream('admin/server/list'));
router.get('/admin/server/list', controller.upstream('admin/server/list'));

// ScKey è´¦å·å’ŒæœåŠ¡å™¨å†™æŽ¥å£ï¼šè½¬å‘åˆ°ä¸Šæ¸¸ï¼Œä½¿ç”¨è¯·æ±‚ Authorization æˆ– .env çš„ SCKEY_BEARER_TOKENã€‚
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

// çŠ¶æ€æŸ¥è¯¢ï¼ˆå…¼å®¹æ—§è·¯å¾„ï¼Œæ”¯æŒ GET å’Œ POSTï¼‰
router.get('/status', (req, res) => controller.getStatus(req, res));
router.post('/status', (req, res) => controller.getStatus(req, res));
router.get('/status/image', (req, res) => controller.getStatusImage(req, res));
router.post('/status/image', (req, res) => controller.getStatusImage(req, res));

// å¥åº·æ£€æŸ¥
router.get('/health', (req, res) => controller.health(req, res));

// æ¸…é™¤ç¼“å­˜ï¼ˆç®¡ç†å‘˜åŠŸèƒ½ï¼‰
router.delete('/cache', (req, res) => controller.clearCache(req, res));

module.exports = router;

