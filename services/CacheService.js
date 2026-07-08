const config = require('../config');
const crypto = require('crypto');

class CacheService {
  constructor() {
    this.cache = new Map();
    this.successTTL = config.cache.successTTL;
    this.failTTL = config.cache.failTTL;
  }

  // 生成缓存键
  getKey(address) {
    const normalizedAddress = String(address || '').trim().toLowerCase();
    const hash = crypto.createHash('md5').update(normalizedAddress).digest('hex');
    return `server:motd:${hash}`;
  }

  // 获取缓存
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  // 设置缓存
  set(key, data, isSuccess) {
    const ttl = isSuccess ? this.successTTL : this.failTTL;
    const expiresAt = Date.now() + ttl * 1000;

    // 缓存大小限制（防止内存溢出）
    if (this.cache.size >= 10000) {
      // 删除最早的 10% 缓存
      const keysToDelete = Array.from(this.cache.keys()).slice(0, 1000);
      keysToDelete.forEach(k => this.cache.delete(k));
    }

    this.cache.set(key, { data, expiresAt });
  }

  // 删除缓存
  delete(key) {
    this.cache.delete(key);
  }

  // 清空所有缓存
  clear() {
    this.cache.clear();
  }

  // 获取缓存统计
  getStats() {
    const now = Date.now();
    let validCount = 0;
    let expiredCount = 0;

    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        expiredCount++;
      } else {
        validCount++;
      }
    }

    return { total: this.cache.size, valid: validCount, expired: expiredCount };
  }
}

module.exports = new CacheService();
