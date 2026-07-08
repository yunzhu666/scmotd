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
- 探测包：`\x09` + gzip(`\x88\x00\x01`)
- 缓存 key：`server:motd:{md5(strtolower(trim(address)))}`
- 成功缓存：300 秒
- 失败缓存：180 秒
- 推荐调用：`POST /server/motd`
