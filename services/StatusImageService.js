const fs = require('fs');
const config = require('../config');

const icons = {
  server: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01M11 7h6M11 17h6"/></svg>',
  activity: '<svg viewBox="0 0 24 24"><path d="M22 12h-4l-3 8-6-16-3 8H2"/></svg>',
  users: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  tag: '<svg viewBox="0 0 24 24"><path d="M20.59 13.41 11 3H4v7l9.59 9.59a2 2 0 0 0 2.82 0l4.18-4.18a2 2 0 0 0 0-2.82Z"/><path d="M7.5 7.5h.01"/></svg>',
  gamepad: '<svg viewBox="0 0 24 24"><path d="M6 12h4m-2-2v4"/><path d="M15 13h.01M18 11h.01"/><rect x="2" y="6" width="20" height="12" rx="4"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  leaf: '<svg viewBox="0 0 24 24"><path d="M11 20A7 7 0 0 1 4 13c0-6 8-9 16-9 0 8-3 16-9 16Z"/><path d="M4 13c3 0 7 1 10 4"/></svg>',
  database: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/></svg>',
  alert: '<svg viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4M12 17h.01"/></svg>',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatNumber(value, digits = 2) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : 'N/A';
}

function formatPercent(value) {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value * 100)}%` : 'N/A';
}

function formatProbeAt(value) {
  if (!value) return 'N/A';
  const time = new Date(value);
  return Number.isNaN(time.valueOf()) ? value : time.toLocaleString('zh-CN', { hour12: false });
}

function stat(icon, label, value, hint = '') {
  return `
    <div class="stat">
      <div class="stat-icon">${icons[icon]}</div>
      <div class="stat-text">
        <div class="stat-label">${escapeHtml(label)}</div>
        <div class="stat-value">${escapeHtml(value)}</div>
        ${hint ? `<div class="stat-hint">${escapeHtml(hint)}</div>` : ''}
      </div>
    </div>`;
}

function wrapHtml(content, footer) {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=760, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    body {
      width: 760px;
      margin: 0;
      background: #111827;
      color: #e5e7eb;
      font-family: "Inter", "Segoe UI", "Microsoft YaHei", Arial, sans-serif;
    }
    .panel {
      width: 760px;
      padding: 26px;
      background:
        radial-gradient(circle at 16% 0%, rgba(34, 197, 94, 0.24), transparent 30%),
        radial-gradient(circle at 84% 12%, rgba(56, 189, 248, 0.18), transparent 28%),
        linear-gradient(145deg, #111827 0%, #172033 100%);
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      margin-bottom: 20px;
    }
    .title-wrap { min-width: 0; }
    .eyebrow {
      color: #93c5fd;
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .title {
      color: #f9fafb;
      font-size: 30px;
      line-height: 1.18;
      font-weight: 800;
      word-break: break-word;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
      min-height: 34px;
      padding: 7px 12px;
      border-radius: 999px;
      font-size: 15px;
      font-weight: 800;
      color: #052e16;
      background: #86efac;
    }
    .badge.offline {
      color: #450a0a;
      background: #fca5a5;
    }
    .badge svg, .stat-icon svg {
      stroke: currentColor;
      stroke-width: 2;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .badge svg { width: 18px; height: 18px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .stat {
      display: flex;
      gap: 12px;
      min-height: 86px;
      padding: 14px;
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-radius: 8px;
      background: rgba(15, 23, 42, 0.68);
    }
    .stat-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 38px;
      width: 38px;
      height: 38px;
      border-radius: 8px;
      color: #67e8f9;
      background: rgba(8, 145, 178, 0.18);
    }
    .stat-icon svg { width: 21px; height: 21px; }
    .stat-text { min-width: 0; }
    .stat-label {
      color: #9ca3af;
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 5px;
    }
    .stat-value {
      color: #f9fafb;
      font-size: 20px;
      line-height: 1.25;
      font-weight: 800;
      word-break: break-word;
    }
    .stat-hint {
      color: #cbd5e1;
      font-size: 13px;
      line-height: 1.35;
      margin-top: 5px;
      word-break: break-word;
    }
    .motd {
      margin-top: 12px;
      padding: 14px 16px;
      border-left: 4px solid #22c55e;
      border-radius: 8px;
      background: rgba(15, 23, 42, 0.76);
      color: #d1d5db;
      font-size: 16px;
      line-height: 1.5;
      word-break: break-word;
    }
    .list {
      display: grid;
      gap: 10px;
    }
    .server-item {
      display: grid;
      grid-template-columns: 38px minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
      padding: 13px 14px;
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-radius: 8px;
      background: rgba(15, 23, 42, 0.68);
    }
    .server-main { min-width: 0; }
    .server-name {
      color: #f9fafb;
      font-size: 18px;
      line-height: 1.25;
      font-weight: 800;
      word-break: break-word;
    }
    .server-meta {
      margin-top: 5px;
      color: #cbd5e1;
      font-size: 13px;
      line-height: 1.35;
      word-break: break-word;
    }
    .server-version {
      align-self: start;
      max-width: 120px;
      padding: 5px 8px;
      border-radius: 999px;
      background: rgba(147, 197, 253, 0.16);
      color: #bfdbfe;
      font-size: 12px;
      font-weight: 800;
      text-align: center;
      word-break: break-word;
    }
    .footer {
      margin-top: 16px;
      padding: 12px 14px;
      border-radius: 8px;
      background: rgba(3, 7, 18, 0.46);
      color: #94a3b8;
      text-align: center;
      font-size: 13px;
      line-height: 1.45;
    }
  </style>
</head>
<body>
  <main class="panel">
    ${content}
    <div class="footer">${footer}</div>
  </main>
</body>
</html>`;
}

function buildStatusHtml(status, options = {}) {
  const title = `${status.address}:${status.port}`;
  const stateText = status.online ? '在线' : '离线';
  const mode = status.gameModeName || status.gameMode || 'N/A';
  const auth = [
    status.needLogin ? '需要登录' : '无需登录',
    status.needPassword ? '需要密码' : '无密码',
  ].join(' / ');

  const stats = status.online
    ? [
      stat('activity', '延迟', `${formatNumber(status.latencyMs, 0)} ms`, status.cached ? '缓存命中' : '实时探测数据'),
      stat('tag', '版本', status.version || 'N/A', status.isLegacyVersion ? '旧版协议' : '新版协议'),
      stat('users', '玩家', `${status.playerCount ?? 0} / ${status.maxPlayerCount ?? 0}`, '当前在线 / 最大人数'),
      stat('gamepad', '模式', String(mode), typeof status.gameMode !== 'undefined' && status.gameMode !== null ? `模式 ID: ${status.gameMode}` : ''),
      stat('lock', '访问', auth),
      stat('clock', '世界时间', formatPercent(status.timeOfDay), typeof status.timeOfDay === 'number' ? `原始值: ${formatNumber(status.timeOfDay, 3)}` : ''),
      stat('leaf', '季节', typeof status.season === 'number' ? String(status.season) : 'N/A', typeof status.timeOfSeason === 'number' ? `进度: ${formatPercent(status.timeOfSeason)}` : ''),
      stat('database', '探测', formatProbeAt(status.probeAt), status.cached ? '来自缓存数据' : '新鲜数据'),
    ]
    : [
      stat('alert', '错误', status.error || '无法连接'),
      stat('database', '探测', formatProbeAt(status.probeAt), status.cached ? '缓存命中' : '新鲜数据'),
    ];

  const content = `
    <section class="header">
      <div class="title-wrap">
        <div class="eyebrow">Survivalcraft Server Status</div>
        <div class="title">${escapeHtml(title)}</div>
      </div>
      <div class="badge ${status.online ? '' : 'offline'}">${icons.activity}${stateText}</div>
    </section>
    <section class="grid">
      ${stat('server', '服务器', title, status.ip ? `解析 IP: ${status.ip}` : '')}
      ${stats.join('')}
    </section>
    ${status.motd ? `<section class="motd">${escapeHtml(status.motd)}</section>` : ''}
  `;

  const footer = escapeHtml(options.footer || config.image.footer).replace(/\n/g, '<br>');
  return wrapHtml(content, footer);
}

function buildServerListHtml(list, options = {}) {
  const pageSize = Math.max(1, Math.min(Number.parseInt(options.pageSize, 10) || 10, 50));
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const currentPage = Math.min(Math.max(1, Number.parseInt(options.page, 10) || 1), totalPages);
  const start = (currentPage - 1) * pageSize;
  const shown = list.slice(start, start + pageSize);
  const version = String(options.version || '').trim();

  const items = shown.map((server, index) => {
    const children = Array.isArray(server.children) ? server.children : [];
    const childHint = children.length
      ? `子服 ${children.length} 个: ${children.slice(0, 3).map(child => child.name || child.ip || child.id || '未命名').join(' / ')}${children.length > 3 ? ' ...' : ''}`
      : '';
    const meta = [
      server.ip ? `地址: ${server.ip}` : '',
      typeof server.level === 'number' ? `等级: ${server.level}` : '',
      childHint,
    ].filter(Boolean).join(' · ');

    return `
      <div class="server-item">
        <div class="stat-icon">${icons.server}</div>
        <div class="server-main">
          <div class="server-name">${start + index + 1}. ${escapeHtml(server.name || server.ip || server.id || '未命名服务器')}</div>
          <div class="server-meta">${escapeHtml(meta || '暂无更多信息')}</div>
        </div>
        <div class="server-version">${escapeHtml(server.version || 'N/A')}</div>
      </div>`;
  }).join('');

  const content = `
    <section class="header">
      <div class="title-wrap">
        <div class="eyebrow">Survivalcraft Server Directory</div>
        <div class="title">服务器大厅列表</div>
      </div>
      <div class="badge">${icons.database}${currentPage}/${totalPages}</div>
    </section>
    <section class="motd">共 ${list.length} 个服务器 · 第 ${currentPage}/${totalPages} 页 · 每页 ${pageSize} 个${version ? ` · 版本筛选: ${escapeHtml(version)}` : ''}</section>
    <section class="list">
      ${items || '<div class="motd">没有找到服务器。</div>'}
    </section>
  `;

  const footer = escapeHtml(options.footer || config.image.footer).replace(/\n/g, '<br>');
  return wrapHtml(content, footer);
}

function findExecutablePath() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    config.image.executablePath,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);

  return candidates.find((file) => fs.existsSync(file));
}

class StatusImageService {
  constructor() {
    this.browserPromise = null;
  }

  async getBrowser() {
    if (!this.browserPromise) {
      let puppeteer;
      try {
        puppeteer = require('puppeteer-core');
      } catch (err) {
        throw new Error('puppeteer-core is required to render status images. Run npm install first.');
      }

      const executablePath = findExecutablePath();
      if (!executablePath) {
        throw new Error('Chromium/Chrome/Edge executable not found. Set PUPPETEER_EXECUTABLE_PATH.');
      }

      this.browserPromise = puppeteer.launch({
        executablePath,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }

    return this.browserPromise;
  }

  async renderStatus(status, options = {}) {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setViewport({ width: 760, height: 900, deviceScaleFactor: Number(options.scale || config.image.scale) || 1 });
      await page.setContent(buildStatusHtml(status, options), { waitUntil: 'networkidle0' });
      const element = await page.$('.panel');
      if (!element) {
        throw new Error('status image root element not found');
      }
      return await element.screenshot({ type: 'png' });
    } finally {
      await page.close();
    }
  }

  async renderServerList(list, options = {}) {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setViewport({ width: 760, height: 1400, deviceScaleFactor: Number(options.scale || config.image.scale) || 1 });
      await page.setContent(buildServerListHtml(list, options), { waitUntil: 'networkidle0' });
      const element = await page.$('.panel');
      if (!element) {
        throw new Error('server list image root element not found');
      }
      return await element.screenshot({ type: 'png' });
    } finally {
      await page.close();
    }
  }
}

module.exports = new StatusImageService();
