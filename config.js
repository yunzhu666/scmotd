module.exports = {
  port: 3009,
  host: '0.0.0.0',

  cache: {
    successTTL: 300,
    failTTL: 180,
  },

  probe: {
    defaultTimeout: 2.0,
    minTimeout: 0.5,
    maxTimeout: 5.0,
    defaultPort: 28887,
    useSckeyUpstream: process.env.PROBE_USE_SCKEY_UPSTREAM !== 'false',
  },

  security: {
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

  logging: {
    level: 'info',
    format: 'json',
  },

  image: {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '',
    footer: process.env.STATUS_IMAGE_FOOTER || 'ClouderyStudio',
    scale: parseFloat(process.env.STATUS_IMAGE_SCALE || '1'),
  },
};
