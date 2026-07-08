const config = require('../config');

class Logger {
  constructor() {
    this.level = config.logging.level;
    this.format = config.logging.format;
  }

  log(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const entry = { timestamp, level, message, ...meta };

    if (this.format === 'json') {
      console.log(JSON.stringify(entry));
    } else {
      console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, meta);
    }
  }

  info(message, meta) { this.log('info', message, meta); }
  error(message, meta) { this.log('error', message, meta); }
  warn(message, meta) { this.log('warn', message, meta); }
  debug(message, meta) { this.log('debug', message, meta); }
}

module.exports = new Logger();
