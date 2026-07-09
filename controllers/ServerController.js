const validator = require('../utils/validator');
const cacheService = require('../services/CacheService');
const probeService = require('../services/ServerMotdProbe');
const serverDirectory = require('../services/ServerDirectoryService');
const sckeyUpstream = require('../services/SckeyUpstreamService');
const statusImage = require('../services/StatusImageService');
const logger = require('../utils/logger');

class ServerController {
  // 统一响应格式
  success(data) {
    return {
      code: 0,
      message: 'success',
      data,
    };
  }

  error(code, message) {
    return {
      code,
      message,
      data: null,
    };
  }

  sckeySuccess(data = '', msg = 'Success') {
    return { code: 0, msg, data };
  }

  sckeyError(code, msg, data = '') {
    return { code, msg, data };
  }

  getParam(req, name, fallback = '') {
    if (req.body && req.body[name] !== undefined) {
      return req.body[name];
    }
    if (req.query && req.query[name] !== undefined) {
      return req.query[name];
    }
    return fallback;
  }

  // 格式化地址
  parseAddress(address) {
    const [host, port] = address.includes(':')
      ? address.split(':', 2)
      : [address, null];
    return {
      host,
      port: port ? parseInt(port, 10) : null,
    };
  }

  // 格式化响应数据
  formatResponse(raw, address, cached = false) {
    const { host, port } = this.parseAddress(address);

    const base = {
      address: host,
      port: port || 28887,
      cached,
      probeAt: new Date().toISOString(),
    };

    if (raw.online) {
      return {
        ...base,
        online: true,
        ip: raw.ip || null,
        latencyMs: Math.round((raw.latencyMs || 0) * 100) / 100,
        version: raw.version || null,
        playerCount: raw.playerCount || 0,
        maxPlayerCount: raw.maxPlayerCount || 0,
        gameMode: raw.gameMode ?? null,
        gameModeName: raw.gameModeName || null,
        needLogin: raw.needLogin || false,
        needPassword: raw.needPassword || false,
        timeOfDay: raw.timeOfDay ?? null,
        season: raw.season ?? null,
        timeOfSeason: raw.timeOfSeason ?? null,
        isLegacyVersion: raw.isLegacyVersion || false,
      };
    } else {
      return {
        ...base,
        online: false,
        error: raw.error || 'Server offline or unreachable',
      };
    }
  }

  // 主处理函数
  async getStatus(req, res) {
    try {
      // 1. 提取参数（支持 GET 和 POST）
      const address = req.query.address || req.body.address;
      const timeout = req.query.timeout || req.body.timeout;
      const force = req.query.force !== undefined
        ? req.query.force
        : req.body.force;

      // 2. 参数校验
      const addressResult = validator.validateAddress(address);
      if (!addressResult.valid) {
        return res.status(400).json(this.error(1001, addressResult.error));
      }

      // 组装完整地址（用于缓存键）
      const fullAddress = addressResult.port
        ? `${addressResult.host}:${addressResult.port}`
        : addressResult.host;

      const normalizedTimeout = validator.validateTimeout(timeout);
      const forceRefresh = validator.validateForce(force);

      // 3. 检查缓存
      const cacheKey = cacheService.getKey(fullAddress);

      if (!forceRefresh) {
        const cached = cacheService.get(cacheKey);
        if (cached) {
          logger.info('Cache hit', { address: fullAddress, key: cacheKey });

          // 判断是成功还是失败缓存
          if (cached.online) {
            return res.json(this.success(this.formatResponse(cached, fullAddress, true)));
          } else {
            // 离线状态也返回，但标记为离线
            const formatted = this.formatResponse({ online: false, error: cached.error }, fullAddress, true);
            return res.json(this.success(formatted));
          }
        }
      }

      // 4. 执行探测
      logger.info('Probing server', { address: fullAddress, timeout: normalizedTimeout });

      let probeResult;
      try {
        probeResult = await probeService.probeMotd(
          fullAddress,
          normalizedTimeout,
          forceRefresh
        );

        // 探测成功，写入缓存
        cacheService.set(cacheKey, probeResult, true);

        const formatted = this.formatResponse(probeResult, fullAddress, false);
        return res.json(this.success(formatted));
      } catch (err) {
        // 探测失败（离线或超时）
        logger.warn('Probe failed', {
          address: fullAddress,
          error: err.message
        });

        // 失败也缓存（防止缓存击穿）
        const failData = {
          online: false,
          error: err.message,
        };
        cacheService.set(cacheKey, failData, false);

        const formatted = this.formatResponse(failData, fullAddress, false);
        return res.json(this.success(formatted));
      }
    } catch (err) {
      logger.error('Controller error', {
        error: err.message,
        stack: err.stack
      });

      return res.status(500).json(this.error(2001, 'Internal server error'));
    }
  }

  async getStatusImage(req, res) {
    try {
      const address = req.query.address || req.body.address;
      const timeout = req.query.timeout || req.body.timeout;
      const force = req.query.force !== undefined
        ? req.query.force
        : req.body.force;

      const addressResult = validator.validateAddress(address);
      if (!addressResult.valid) {
        return res.status(400).json(this.error(1001, addressResult.error));
      }

      const fullAddress = addressResult.port
        ? `${addressResult.host}:${addressResult.port}`
        : addressResult.host;

      const normalizedTimeout = validator.validateTimeout(timeout);
      const forceRefresh = validator.validateForce(force);
      const cacheKey = cacheService.getKey(fullAddress);
      let formatted;

      if (!forceRefresh) {
        const cached = cacheService.get(cacheKey);
        if (cached) {
          logger.info('Cache hit', { address: fullAddress, key: cacheKey });
          formatted = cached.online
            ? this.formatResponse(cached, fullAddress, true)
            : this.formatResponse({ online: false, error: cached.error }, fullAddress, true);
        }
      }

      if (!formatted) {
        logger.info('Probing server', { address: fullAddress, timeout: normalizedTimeout });

        try {
          const probeResult = await probeService.probeMotd(
            fullAddress,
            normalizedTimeout,
            forceRefresh
          );
          cacheService.set(cacheKey, probeResult, true);
          formatted = this.formatResponse(probeResult, fullAddress, false);
        } catch (err) {
          logger.warn('Probe failed', {
            address: fullAddress,
            error: err.message
          });

          const failData = {
            online: false,
            error: err.message,
          };
          cacheService.set(cacheKey, failData, false);
          formatted = this.formatResponse(failData, fullAddress, false);
        }
      }

      const image = await statusImage.renderStatus(formatted, {
        footer: this.getParam(req, 'footer', undefined),
        scale: this.getParam(req, 'scale', undefined),
      });

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', formatted.cached ? 'public, max-age=60' : 'no-store');
      return res.send(image);
    } catch (err) {
      logger.error('Status image render failed', {
        error: err.message,
        stack: err.stack
      });

      return res.status(500).json(this.error(2002, err.message || 'Failed to render image'));
    }
  }

  async probeMotd(req, res) {
    try {
      const address = String(this.getParam(req, 'address', '')).trim();
      if (!address) {
        return res.status(400).json(this.sckeyError(1, 'address is required'));
      }

      const timeout = validator.validateTimeout(this.getParam(req, 'timeout', 2.0));
      const force = validator.validateForce(this.getParam(req, 'force', false));
      const cacheKey = cacheService.getKey(address);

      if (!force) {
        const cached = cacheService.get(cacheKey);
        if (cached) {
          return res.json(this.sckeySuccess({
            ...cached,
            cached: true,
          }));
        }

        return res.json(this.sckeySuccess({
          address,
          online: false,
          pending: true,
          cached: true,
          updatedAt: null,
          error: 'server probe cache is not ready',
        }));
      }

      const result = await probeService.probeMotd(address, timeout, force);
      const data = {
        ...result,
        online: true,
        cached: false,
        updatedAt: new Date().toISOString(),
        cacheTtl: cacheService.successTTL,
      };
      cacheService.set(cacheKey, data, true);
      return res.json(this.sckeySuccess(data));
    } catch (err) {
      return res.status(400).json(this.sckeyError(1, err.message));
    }
  }

  async serverList(req, res) {
    try {
      const version = String(this.getParam(req, 'version', '')).trim();
      const list = await serverDirectory.listActiveServers(version || null);
      return res.json(this.sckeySuccess({ list }));
    } catch (err) {
      logger.error('Server list failed', { error: err.message });
      return res.status(500).json(this.sckeyError(900, `获取失败${err.message}`, { error: 'internal_error' }));
    }
  }

  async listVersions(req, res) {
    try {
      const data = await serverDirectory.listVersions();
      return res.json(this.sckeySuccess(data));
    } catch (err) {
      logger.error('Version list failed', { error: err.message });
      return res.status(500).json(this.sckeyError(900, `获取版本列表失败${err.message}`, { error: 'internal_error' }));
    }
  }

  async adminServerList(req, res) {
    try {
      const data = await serverDirectory.listForAdmin({
        page: this.getParam(req, 'page', 1),
        pageSize: this.getParam(req, 'pageSize', 20),
        keyword: this.getParam(req, 'keyword', ''),
        state: this.getParam(req, 'state', null),
        levelGroup: String(this.getParam(req, 'levelGroup', '') || '').trim(),
        recommendType: String(this.getParam(req, 'recommendType', '') || '').trim(),
      });
      return res.json(this.sckeySuccess(data));
    } catch (err) {
      logger.error('Admin server list failed', { error: err.message });
      return res.status(500).json(this.sckeyError(900, `获取失败${err.message}`, { error: 'internal_error' }));
    }
  }

  notImplemented(name) {
    return (req, res) => res.status(501).json(this.sckeyError(501, `${name} is not implemented in this standalone API yet`));
  }

  upstream(path) {
    return async (req, res) => {
      try {
        const result = await sckeyUpstream.forward(req, path);
        return res.status(result.status).json(result.data);
      } catch (err) {
        logger.error('ScKey upstream failed', { path, error: err.message });
        return res.status(502).json(this.sckeyError(502, `ScKey upstream failed: ${err.message}`, { error: 'bad_gateway' }));
      }
    };
  }

  // 健康检查
  async health(req, res) {
    const stats = cacheService.getStats();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      cache: stats,
      uptime: process.uptime(),
    });
  }

  // 清除缓存
  async clearCache(req, res) {
    const address = req.query.address || req.body.address;

    if (address) {
      const addressResult = validator.validateAddress(address);
      if (!addressResult.valid) {
        return res.status(400).json(this.error(1001, addressResult.error));
      }
      const fullAddress = addressResult.port
        ? `${addressResult.host}:${addressResult.port}`
        : addressResult.host;
      // 清除所有超时版本的缓存
      const keys = Array.from(cacheService.cache.keys());
      const toDelete = keys.filter(k => k.includes(fullAddress));
      toDelete.forEach(k => cacheService.delete(k));
      return res.json(this.success({ deleted: toDelete.length }));
    } else {
      cacheService.clear();
      return res.json(this.success({ deleted: 'all' }));
    }
  }
}

module.exports = new ServerController();
