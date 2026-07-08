const config = require('../config');

class Validator {
  // 校验服务器地址格式
  validateAddress(address) {
    if (!address || typeof address !== 'string') {
      return { valid: false, error: 'address is required' };
    }

    const trimmed = address.trim();
    if (trimmed.length === 0) {
      return { valid: false, error: 'address cannot be empty' };
    }

    if (trimmed.length > config.security.maxAddressLength) {
      return { valid: false, error: 'address too long' };
    }

    // 格式：主机名或 IP:端口
    const pattern = /^([a-zA-Z0-9._-]+)(?::(\d{1,5}))?$/;
    const match = trimmed.match(pattern);

    if (!match) {
      return { valid: false, error: 'invalid address format' };
    }

    // 校验端口范围
    if (match[2]) {
      const port = parseInt(match[2], 10);
      if (port < 1 || port > 65535) {
        return { valid: false, error: 'port must be 1-65535' };
      }
    }

    return {
      valid: true,
      host: match[1],
      port: match[2] ? parseInt(match[2], 10) : null
    };
  }

  // 校验超时参数
  validateTimeout(timeout) {
    const { minTimeout, maxTimeout, defaultTimeout } = config.probe;

    if (timeout === undefined || timeout === null) {
      return defaultTimeout;
    }

    const parsed = parseFloat(timeout);
    if (isNaN(parsed) || parsed <= 0) {
      return defaultTimeout;
    }

    return Math.max(minTimeout, Math.min(maxTimeout, parsed));
  }

  // 校验 force 参数
  validateForce(force) {
    if (force === undefined || force === null) {
      return false;
    }
    if (typeof force === 'boolean') {
      return force;
    }
    if (typeof force === 'string') {
      return force.toLowerCase() === 'true' || force === '1';
    }
    return Boolean(force);
  }
}

module.exports = new Validator();
