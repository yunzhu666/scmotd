const config = require('../config');
const net = require('net');

class Validator {
  parseAddress(address) {
    const trimmed = String(address || '').trim();

    const bracketMatch = trimmed.match(/^\[([0-9a-fA-F:.%]+)\](?::(\d{1,5}))?$/);
    if (bracketMatch) {
      if (net.isIP(bracketMatch[1]) !== 6) {
        return null;
      }

      return {
        host: bracketMatch[1],
        port: bracketMatch[2] ? parseInt(bracketMatch[2], 10) : null,
        family: 6,
      };
    }

    if (net.isIP(trimmed)) {
      return {
        host: trimmed,
        port: null,
        family: net.isIP(trimmed),
      };
    }

    if ((trimmed.match(/:/g) || []).length > 1) {
      return null;
    }

    const hostPortMatch = trimmed.match(/^([a-zA-Z0-9._-]+)(?::(\d{1,5}))?$/);
    if (!hostPortMatch) {
      return null;
    }

    return {
      host: hostPortMatch[1],
      port: hostPortMatch[2] ? parseInt(hostPortMatch[2], 10) : null,
      family: net.isIP(hostPortMatch[1]) || 0,
    };
  }

  formatAddress(host, port = null) {
    if (port === null || port === undefined) {
      return String(host || '');
    }

    return net.isIP(host) === 6
      ? `[${host}]:${port}`
      : `${host}:${port}`;
  }

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

    const parsed = this.parseAddress(trimmed);
    if (!parsed) {
      return { valid: false, error: 'invalid address format. Use [IPv6]:port when specifying a port for IPv6' };
    }

    if (parsed.port !== null && (parsed.port < 1 || parsed.port > 65535)) {
      return { valid: false, error: 'port must be 1-65535' };
    }

    return {
      valid: true,
      host: parsed.host,
      port: parsed.port,
      family: parsed.family,
    };
  }

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
