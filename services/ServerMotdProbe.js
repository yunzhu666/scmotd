const dns = require('dns');
const zlib = require('zlib');
const config = require('../config');
const logger = require('../utils/logger');

class ServerMotdProbe {
  constructor() {
    this.blockedRanges = config.security.blockedIPRanges;
  }

  // DNS 解析 + IP 校验
  resolveAddress(host) {
    return new Promise((resolve, reject) => {
      dns.lookup(host, { family: 4 }, (err, address) => {
        if (err) {
          return reject(new Error(`DNS resolution failed: ${err.message}`));
        }

        // 校验 IP 是否为公网地址
        if (!this.isPublicIP(address)) {
          return reject(new Error(`Blocked IP: ${address} (SSRF protection)`));
        }

        resolve(address);
      });
    });
  }

  // 检查 IP 是否为公网地址（防 SSRF）
  isPublicIP(ip) {
    // IPv6 简单过滤
    if (ip.includes(':')) {
      // 只允许全球单播地址 (2000::/3)
      if (ip.startsWith('2000:') || ip.startsWith('2001:') || ip.startsWith('2002:') || ip.startsWith('2003:')) {
        return true;
      }
      // 不允许回环、链路本地、唯一本地等
      return false;
    }

    // IPv4 校验
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return false;

    // 0.0.0.0/8
    if (parts[0] === 0) return false;
    // 10.0.0.0/8
    if (parts[0] === 10) return false;
    // 127.0.0.0/8
    if (parts[0] === 127) return false;
    // 169.254.0.0/16
    if (parts[0] === 169 && parts[1] === 254) return false;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return false;
    // 224.0.0.0/4 (多播)
    if (parts[0] >= 224 && parts[0] <= 239) return false;
    // 240.0.0.0/4 (保留)
    if (parts[0] >= 240) return false;

    return true;
  }

  // 构建探测包（符合 LiteNetLib 协议）
  buildProbePacket() {
    const payload = Buffer.from([0x88, 0x00, 0x01]);
    return Buffer.concat([Buffer.from([0x09]), zlib.deflateRawSync(payload)]);
  }

  createReader(buffer) {
    let offset = 0;

    const ensure = (size) => {
      if (offset + size > buffer.length) {
        throw new Error('Unexpected end of response');
      }
    };

    const readByte = () => {
      ensure(1);
      return buffer[offset++];
    };

    const readBoolean = () => readByte() !== 0;

    const readUInt16 = () => {
      ensure(2);
      const value = buffer.readUInt16LE(offset);
      offset += 2;
      return value;
    };

    const readInt32 = () => {
      ensure(4);
      const value = buffer.readInt32LE(offset);
      offset += 4;
      return value;
    };

    const readFloat = () => {
      ensure(4);
      const value = buffer.readFloatLE(offset);
      offset += 4;
      return value;
    };

    const read7BitEncodedInt = () => {
      let count = 0;
      let shift = 0;
      let byte;

      do {
        if (shift === 35) {
          throw new Error('Invalid 7-bit encoded integer');
        }

        byte = readByte();
        count |= (byte & 0x7F) << shift;
        shift += 7;
      } while ((byte & 0x80) !== 0);

      return count;
    };

    const readDotNetString = () => {
      const length = read7BitEncodedInt();
      ensure(length);
      const value = buffer.toString('utf8', offset, offset + length);
      offset += length;
      return value;
    };

    return {
      get remaining() { return buffer.length - offset; },
      readByte,
      readBoolean,
      readUInt16,
      readInt32,
      readFloat,
      readDotNetString,
    };
  }

  decompressLiteNetPayload(data) {
    if (data.length < 2) {
      throw new Error('Response too short');
    }

    const packetType = data[0];
    if ((packetType & 0x1F) !== 9) {
      throw new Error(`Unexpected packet type: ${packetType}`);
    }

    const payload = data.slice(1);
    return zlib.inflateRawSync(payload);
  }

  readOptional(reader, fallback, readFn) {
    if (reader.remaining <= 0) {
      return fallback;
    }

    try {
      return readFn();
    } catch (err) {
      return fallback;
    }
  }

  // 解析响应数据
  parseResponse(data, latencyMs) {
    try {
      const payload = this.decompressLiteNetPayload(data);
      const reader = this.createReader(payload);
      const verify = reader.readByte();

      if (verify !== 0x88) {
        throw new Error(`Unexpected verify byte: ${verify}`);
      }

      const packageId = reader.readByte();
      if (packageId !== 0) {
        throw new Error(`Unexpected package id: ${packageId}`);
      }

      const requestInfo = reader.readBoolean();
      if (requestInfo) {
        throw new Error('Unexpected request package');
      }

      const gameModes = ['Survival', 'Creative', 'Adventure', 'Cruel', 'Harmless'];
      const version = this.readOptional(reader, null, () => reader.readDotNetString());
      const playerCount = this.readOptional(reader, 0, () => reader.readUInt16());
      const maxPlayerCount = this.readOptional(reader, 0, () => reader.readUInt16());
      const gameModeValue = this.readOptional(reader, 0, () => reader.readByte());
      const gameMode = gameModes[gameModeValue] || String(gameModeValue);
      const needLogin = this.readOptional(reader, false, () => reader.readBoolean());
      const needPassword = this.readOptional(reader, false, () => reader.readBoolean());
      const timeOfDay = this.readOptional(reader, null, () => reader.readFloat());
      const hasSeasonInfo = reader.remaining >= 8;

      const result = {
        online: true,
        version,
        playerCount,
        maxPlayerCount,
        gameMode: gameModeValue,
        gameModeName: gameMode,
        needLogin,
        needPassword,
        timeOfDay,
        season: hasSeasonInfo ? reader.readInt32() : null,
        timeOfSeason: hasSeasonInfo ? reader.readFloat() : null,
        isLegacyVersion: !hasSeasonInfo,
        latencyMs,
      };

      return result;
    } catch (err) {
      logger.error('Failed to parse response', { error: err.message });
      throw new Error(`Parse failed: ${err.message}`);
    }
  }

  // UDP 探测
  probeUDP(address, port, timeout) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const udp = require('dgram').createSocket('udp4');
      let resolved = false;

      // 超时定时器
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          udp.close();
          reject(new Error('Connection timeout'));
        }
      }, timeout * 1000);

      // 接收响应
      udp.on('message', (msg) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);

        const latencyMs = Date.now() - startTime;

        try {
          const result = this.parseResponse(msg, latencyMs);
          udp.close();
          resolve(result);
        } catch (err) {
          udp.close();
          reject(err);
        }
      });

      udp.on('error', (err) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        udp.close();
        reject(new Error(`Socket error: ${err.message}`));
      });

      // 发送探测包
      const packet = this.buildProbePacket();
      udp.send(packet, 0, packet.length, port, address, (err) => {
        if (err) {
          resolved = true;
          clearTimeout(timer);
          udp.close();
          reject(new Error(`Send failed: ${err.message}`));
        }
      });
    });
  }

  // 主探测方法
  async probeMotd(address, timeout, force = false) {
    const startTime = Date.now();

    // 解析地址
    const [host, portFromAddr] = address.includes(':')
      ? address.split(':', 2)
      : [address, null];

    const port = portFromAddr
      ? parseInt(portFromAddr, 10)
      : config.probe.defaultPort;

    // DNS 解析 + SSRF 校验
    const ip = await this.resolveAddress(host);

    // UDP 探测
    const result = await this.probeUDP(ip, port, timeout);

    // 补充元数据
    result.address = address;
    result.ip = ip;
    result.port = port;
    result.probeTime = Date.now() - startTime;

    return result;
  }
}

module.exports = new ServerMotdProbe();
