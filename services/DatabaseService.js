const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

class DatabaseService {
  constructor() {
    this.pool = null;
    this.loadEnvFile(path.resolve(__dirname, '..', '.env'));
    this.loadEnvFile(path.resolve(__dirname, '..', 'ScKey-master', '.env'));
  }

  loadEnvFile(filePath) {
    if (!fs.existsSync(filePath)) {
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const index = trimmed.indexOf('=');
      if (index === -1) {
        continue;
      }

      const key = trimmed.slice(0, index).trim();
      let value = trimmed.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }

  getConfig() {
    const connectionString = process.env.DATABASE_URL || process.env.PG_URL;
    if (connectionString) {
      return { connectionString };
    }

    return {
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || process.env.PGDATABASE,
      user: process.env.DB_USER || process.env.PGUSER,
      password: process.env.DB_PASS || process.env.PGPASSWORD || '',
    };
  }

  getPool() {
    if (!this.pool) {
      const config = this.getConfig();
      if (!config.connectionString && (!config.database || !config.user)) {
        throw new Error('Database is not configured. Set DATABASE_URL or DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASS.');
      }

      this.pool = new Pool({
        ...config,
        max: Number(process.env.DB_POOL_MAX || 10),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    }

    return this.pool;
  }

  async query(sql, params = []) {
    return this.getPool().query(sql, params);
  }

  async health() {
    const result = await this.query('select 1 as ok');
    return result.rows[0]?.ok === 1;
  }
}

module.exports = new DatabaseService();
