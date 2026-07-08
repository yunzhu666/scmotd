module.exports = {
  // 服务器配置
  port: 3009,
  host: '0.0.0.0',

  // 缓存配置
  cache: {
    successTTL: 300, // 成功状态缓存 5 分钟（秒）
    failTTL: 180,    // 失败状态缓存 3 分钟（秒）
  },

  // 探测配置
  probe: {
    defaultTimeout: 2.0,  // 默认超时（秒）
    minTimeout: 0.5,
    maxTimeout: 5.0,
    defaultPort: 28887,   // Minecraft 默认端口
  },

  // 安全配置
  security: {
    // 禁止探测的内网 IP 段
    blockedIPRanges: [
      '127.0.0.0/8',
      '10.0.0.0/8',
      '172.16.0.0/12',
      '192.168.0.0/16',
      '169.254.0.0/16',
      '::1/128',
      'fc00::/7',
      'fe80::/10',
    ],
    maxAddressLength: 255,
  },

  // 日志配置
  logging: {
    level: 'info',
    format: 'json',
  },
};
