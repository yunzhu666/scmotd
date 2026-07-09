class SckeyUpstreamService {
  constructor() {
    // Reuse DatabaseService env loading so root .env and ScKey-master/.env are available here too.
    this.baseUrl = (process.env.SCKEY_API_BASE || 'https://api.sckey.net').replace(/\/+$/, '');
  }

  getAuthorization(req) {
    const header = req.get('authorization');
    if (header) {
      return header;
    }

    const token = process.env.SCKEY_BEARER_TOKEN || process.env.SCKEY_TOKEN;
    return token ? `Bearer ${token}` : '';
  }

  buildHeaders(req) {
    const headers = {
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/json',
    };

    const authorization = this.getAuthorization(req);
    if (authorization) {
      headers.authorization = authorization;
    }

    const requestId = req.get('x-request-id');
    if (requestId) {
      headers['x-request-id'] = requestId;
    }

    return headers;
  }

  async forward(req, path) {
    const method = req.method.toUpperCase();
    const url = new URL(`${this.baseUrl}/${path.replace(/^\/+/, '')}`);

    if (method === 'GET') {
      for (const [key, value] of Object.entries(req.query || {})) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const response = await fetch(url, {
      method,
      headers: this.buildHeaders(req),
      body: method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify(req.body || {}),
    });

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (err) {
      data = text;
    }

    return {
      status: response.status,
      data,
    };
  }
}

module.exports = new SckeyUpstreamService();
