# Minecraft Server Status API

一个运行在端口 `3009` 的 Node.js 服务器状态查询 API。

## 项目结构

```text
server-status-api/
├── package.json
├── index.js
├── config.js
├── services/
│   ├── ServerMotdProbe.js
│   └── CacheService.js
├── controllers/
│   └── ServerController.js
├── routes/
│   └── api.js
├── utils/
│   ├── validator.js
│   └── logger.js
└── README.md
```

## 启动服务

```bash
npm install
npm start
```

开发模式：

```bash
npm run dev
```

## API 测试

获取服务器大厅列表：

```bash
curl -X POST "http://localhost:3009/server/list" \
  -H "Content-Type: application/json" \
  -d '{"version": ""}'
```

获取服务器版本列表：

```bash
curl -X POST "http://localhost:3009/server/version/list"
```

管理端服务器列表：

```bash
curl -X POST "http://localhost:3009/admin/server/list" \
  -H "Content-Type: application/json" \
  -d '{"page": 1, "pageSize": 20, "keyword": "", "state": "", "levelGroup": ""}'
```

原仓库兼容入口：

```bash
curl -X POST "http://localhost:3009/server/motd" \
  -H "Content-Type: application/json" \
  -d '{"address": "game.example.com:28887", "timeout": 2.0, "force": false}'
```

兼容查询入口（GET）：

```bash
curl "http://localhost:3009/api/status?address=play.hypixel.net:25565"
```

兼容查询入口（POST）：

```bash
curl -X POST "http://localhost:3009/api/status" \
  -H "Content-Type: application/json" \
  -d '{"address": "game.example.com:28887", "timeout": 3.0, "force": true}'
```

健康检查：

```bash
curl "http://localhost:3009/api/health"
```

清除单个地址缓存：

```bash
curl -X DELETE "http://localhost:3009/api/cache?address=game.example.com:28887"
```

清除所有缓存：

```bash
curl -X DELETE "http://localhost:3009/api/cache"
```

## 响应示例

成功响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "address": "play.hypixel.net",
    "port": 25565,
    "cached": false,
    "probeAt": "2026-07-08T14:30:25.123Z",
    "online": true,
    "ip": "209.222.114.51",
    "latencyMs": 45.32,
    "version": "1.20.4",
    "playerCount": 12,
    "maxPlayerCount": 50,
    "gameMode": "Survival",
    "timeOfDay": 6000,
    "isLegacyVersion": false,
    "motd": "Welcome to the server!"
  }
}
```

离线响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "address": "game.example.com",
    "port": 28887,
    "cached": false,
    "probeAt": "2026-07-08T14:30:25.123Z",
    "online": false,
    "error": "Connection timeout"
  }
}
```

## 前端调用示例

```javascript
async function probe() {
  const address = document.getElementById('address').value.trim();

  const response = await fetch('http://localhost:3009/api/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, timeout: 2.0 })
  });

  const result = await response.json();

  if (result.code === 0 && result.data.online) {
    console.log('在线！延迟:', result.data.latencyMs, 'ms');
    console.log('玩家:', result.data.playerCount, '/', result.data.maxPlayerCount);
    console.log('模式:', result.data.gameMode);
  } else {
    console.log('离线或无法连接');
  }
}
```

## 协议说明

这个 API 做的是服务器在线状态探测（MOTD Probe），不是上传/下载带宽测速。

- 默认端口：`28887`
- 探测协议：LiteNetLib UDP
- 探测包：`\x09` + raw deflate(`\x88\x00\x01`)
- 缓存 key：`server:motd:{md5(strtolower(trim(address)))}`
- 成功缓存：300 秒
- 失败缓存：180 秒
- 推荐调用：`POST /server/motd`

## ScKey 数据库接口

新增的服务器列表接口会直接读取 ScKey 的 PostgreSQL 数据库。配置方式：

1. 在项目根目录创建 `.env`，可参考 `.env.example`
2. 或者把 ScKey 的 `.env` 放在 `ScKey-master/.env`
3. 或者直接设置 `DATABASE_URL`

已接入的 ScKey 服务器接口：

- `POST /server/list`
- `POST /server/motd`
- `POST /server/version/list`
- `POST /admin/server/list`
- `POST /account/info`
- `POST /account/servers`
- `POST /server/join`
- `POST /server/left`
- `POST /server/verify`
- `POST /server/moderate`
- `POST /server/player-sync/config`
- `POST /server/player-sync/lock`
- `POST /server/player-sync/unlock`
- `POST /server/player-sync/pull`
- `POST /server/player-sync/push`
- `POST /server/create`
- `POST /server/deleteMine`
- `POST /owner/servers`
- `POST /owner/servers/update`
- `POST /owner/servers/publish-state/set`
- `POST /owner/servers/whitelist-policy/set`
- `POST /owner/servers/entry-policy/set`
- `POST /owner/servers/team/list`
- `POST /owner/servers/team/add`
- `POST /owner/servers/team/remove`
- `POST /owner/servers/transfer`
- `POST /owner/servers/player-sync/list`
- `POST /owner/servers/player-sync/save`
- `POST /admin/server/delete`
- `POST /admin/server/approve`
- `POST /admin/server/recommend`
- `POST /admin/server/version`
- `POST /admin/server/transfer`
- `POST /admin/server/entry-policy`
- `POST /admin/server/text-audit/list`

其中 `server/list`、`server/version/list`、`admin/server/list` 读取本地 ScKey 数据库；登录、服主、管理和玩家同步等写接口会转发到 `SCKEY_API_BASE`。

转发接口会优先使用请求里的 `Authorization` 头；如果请求没有带 Authorization，可以在 `.env` 中设置：

```env
SCKEY_API_BASE=https://api.sckey.net
SCKEY_BEARER_TOKEN=你的token
```

不要把 Bearer token 写进源码或提交到仓库。

## 状态图片接口

图片接口会返回 `image/png`，样式与 Koishi 插件的服务器状态卡片一致：

```bash
curl "http://localhost:3009/api/status/image?address=game.example.com:28887" --output status.png
```

```bash
curl -X POST "http://localhost:3009/api/status/image" \
  -H "Content-Type: application/json" \
  -d '{"address": "game.example.com:28887", "timeout": 3.0, "force": true}' \
  --output status.png
```

兼容 ScKey MOTD 路径：

```bash
curl "http://localhost:3009/server/motd/image?address=game.example.com:28887" --output status.png
```

可选配置：

```env
PUPPETEER_EXECUTABLE_PATH=
STATUS_IMAGE_FOOTER=ClouderyStudio
STATUS_IMAGE_SCALE=1
```

如果 `PUPPETEER_EXECUTABLE_PATH` 留空，服务会自动尝试常见的 Chrome / Edge 安装路径。
