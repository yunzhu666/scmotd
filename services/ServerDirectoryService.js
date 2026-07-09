const db = require('./DatabaseService');

const KIND_NORMAL = 0;
const KIND_GROUP = 1;
const GROUP_JOIN_DEFAULT = 1;
const GROUP_JOIN_AUTO = 2;
const DEFAULT_JOIN_WEIGHT = 100;
const ENTRY_VERIFY_ALL = 1 | 2 | 4 | 8 | 16 | 64 | 128 | 256;

function intValue(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeGroupJoinMode(mode) {
  return [1, 2, 3].includes(mode) ? mode : GROUP_JOIN_DEFAULT;
}

function normalizeJoinWeight(weight) {
  return Math.max(1, Math.min(intValue(weight, DEFAULT_JOIN_WEIGHT), 1000));
}

function entryVerifyLevelToFlags(level) {
  const normalized = Math.max(0, Math.min(intValue(level), 4));
  let flags = 0;
  if (normalized >= 1) flags |= 1;
  if (normalized >= 2) flags |= 2;
  if (normalized >= 3) flags |= 4;
  if (normalized >= 4) flags |= 8;
  return flags;
}

function resolveEntryVerifyFlags(row) {
  if (row.entry_verify_flags !== undefined && row.entry_verify_flags !== null) {
    return intValue(row.entry_verify_flags) & ENTRY_VERIFY_ALL;
  }

  return entryVerifyLevelToFlags(row.entry_verify_level);
}

function resolveAllowedRegions(row) {
  const regions = row.allowed_regions;
  if (!regions) {
    return [];
  }

  if (Array.isArray(regions)) {
    return regions.map(String).map(v => v.trim().toUpperCase()).filter(Boolean);
  }

  const raw = String(regions).trim();
  if (!raw) {
    return [];
  }

  try {
    const decoded = JSON.parse(raw);
    if (Array.isArray(decoded)) {
      return decoded.map(String).map(v => v.trim().toUpperCase()).filter(Boolean);
    }
  } catch (err) {
    // Fall through to comma/space splitting.
  }

  return raw.split(/[,\s]+/).map(v => v.trim().toUpperCase()).filter(Boolean);
}

function autoOfflineSecondsForLevel(level) {
  return intValue(level) === 1 ? 86400 : 259200;
}

class ServerDirectoryService {
  constructor() {
    this.schemaReady = false;
  }

  async ensureServerColumns() {
    if (this.schemaReady) {
      return;
    }

    await db.query(`
      alter table tb_server add column if not exists server_kind smallint not null default 0;
      alter table tb_server add column if not exists parent_id uuid null;
      alter table tb_server add column if not exists sort_order int not null default 0;
      alter table tb_server add column if not exists group_join_mode smallint not null default 1;
      alter table tb_server add column if not exists join_weight smallint not null default 100;
      alter table tb_server add column if not exists block_overseas_ip smallint not null default 0;
      alter table tb_server add column if not exists entry_verify_level smallint not null default 0;
      alter table tb_server add column if not exists allowed_regions text null;
      alter table tb_server add column if not exists entry_verify_flags int null;
      alter table tb_server add column if not exists probe_offline_since timestamp null;
      alter table tb_server add column if not exists auto_unpublished_at timestamp null;
      alter table tb_server add column if not exists auto_unpublish_reason varchar(255) null;
    `);

    this.schemaReady = true;
  }

  buildParentJoinModeMap(rows) {
    const map = new Map();
    for (const row of rows) {
      if (row.id) {
        map.set(String(row.id), normalizeGroupJoinMode(intValue(row.group_join_mode, GROUP_JOIN_DEFAULT)));
      }
    }
    return map;
  }

  async listActiveChildrenByParentIds(parentIds, version = null, parentJoinModes = new Map()) {
    const ids = [...new Set(parentIds.map(String).filter(Boolean))];
    if (ids.length === 0) {
      return {};
    }

    const params = [ids];
    let versionClause = '';
    if (version) {
      params.push(version);
      versionClause = `and v.name = $${params.length}`;
    }

    const result = await db.query(
      `
      select s.id, s.parent_id, s.name, s.ip, s.join_weight, s.level, s.server_kind, v.name as version
      from tb_server s
      join tb_version v on s.vid = v.id
      where s.parent_id = any($1::uuid[])
        and s.state = 1
        and s.is_delete = 0
        ${versionClause}
      order by s.sort_order asc, s.id asc
      `,
      params
    );

    const grouped = {};
    for (const row of result.rows) {
      const parentId = String(row.parent_id || '');
      if (!parentId) {
        continue;
      }

      const child = {
        id: String(row.id || ''),
        name: String(row.name || ''),
        ip: String(row.ip || ''),
      };

      if (parentJoinModes.get(parentId) === GROUP_JOIN_AUTO) {
        child.weight = normalizeJoinWeight(row.join_weight);
      }

      if (!grouped[parentId]) {
        grouped[parentId] = [];
      }
      grouped[parentId].push(child);
    }

    return grouped;
  }

  async listActiveServers(version = null) {
    await this.ensureServerColumns();

    const params = [];
    let versionClause = '';
    if (version) {
      params.push(version);
      versionClause = `and v.name = $${params.length}`;
    }

    const result = await db.query(
      `
      select s.id, s.name, s.ip, s.level, s.server_kind, s.group_join_mode, v.name as version
      from tb_server s
      join tb_version v on s.vid = v.id
      where s.state = 1
        and s.is_delete = 0
        and s.parent_id is null
        ${versionClause}
      order by s.id asc
      `,
      params
    );

    const parentJoinModes = this.buildParentJoinModeMap(result.rows);
    const childrenByParent = await this.listActiveChildrenByParentIds(
      result.rows.map(row => row.id),
      version,
      parentJoinModes
    );

    return result.rows.map((row) => {
      const serverId = String(row.id || '');
      const serverKind = intValue(row.server_kind, KIND_NORMAL);
      const children = childrenByParent[serverId] || [];
      const ip = serverKind === KIND_GROUP && children.length > 0 ? String(children[0].ip || '') : String(row.ip || '');
      const mapped = {
        id: serverId,
        name: String(row.name || ''),
        ip,
        level: intValue(row.level),
        version: String(row.version || ''),
      };

      if (serverKind === KIND_GROUP) {
        mapped.groupJoinMode = normalizeGroupJoinMode(intValue(row.group_join_mode, GROUP_JOIN_DEFAULT));
        mapped.children = children;
      }

      return mapped;
    });
  }

  async listVersions() {
    const result = await db.query('select id, name from tb_version order by id asc');
    return result.rows.map(row => ({
      id: intValue(row.id),
      name: String(row.name || ''),
    }));
  }

  async listChildrenByParentIds(parentIds, parentJoinModes = new Map()) {
    await this.ensureServerColumns();

    const ids = [...new Set(parentIds.map(String).filter(Boolean))];
    if (ids.length === 0) {
      return {};
    }

    const result = await db.query(
      `
      select *
      from tb_server
      where parent_id = any($1::uuid[])
        and is_delete = 0
      order by sort_order asc, id asc
      `,
      [ids]
    );

    const grouped = {};
    for (const row of result.rows) {
      const parentId = String(row.parent_id || '');
      if (!parentId) {
        continue;
      }

      const includeWeight = parentJoinModes.get(parentId) === GROUP_JOIN_AUTO;
      const child = this.mapManageServer(row, 'child', includeWeight);
      if (!grouped[parentId]) {
        grouped[parentId] = [];
      }
      grouped[parentId].push(child);
    }

    return grouped;
  }

  mapManageServer(row, manageType = null, includeWeight = false, children = []) {
    const mapped = {
      id: String(row.id || ''),
      parentId: row.parent_id || null,
      serverKind: intValue(row.server_kind, row.parent_id ? 2 : KIND_NORMAL),
      ownerUserId: intValue(row.uid),
      name: String(row.name || ''),
      ip: String(row.ip || ''),
      versionId: intValue(row.vid),
      level: intValue(row.level),
      state: intValue(row.state),
      whitelistEnabled: intValue(row.whitelist_enabled),
      blockOverseasIp: intValue(row.block_overseas_ip),
      allowedRegions: resolveAllowedRegions(row),
      entryVerifyLevel: intValue(row.entry_verify_level),
      entryVerifyFlags: resolveEntryVerifyFlags(row),
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
      probeOfflineSince: row.probe_offline_since || null,
      autoUnpublishedAt: row.auto_unpublished_at || null,
      autoUnpublishReason: row.auto_unpublish_reason || null,
      autoOfflineHours: Math.floor(autoOfflineSecondsForLevel(row.level) / 3600),
    };

    if (manageType) {
      mapped.manageType = manageType;
    }
    if (includeWeight) {
      mapped.weight = normalizeJoinWeight(row.join_weight);
    }
    if (children.length > 0) {
      mapped.children = children;
    }

    return mapped;
  }

  async listForAdmin({ page = 1, pageSize = 20, state = null, keyword = '', levelGroup = '', recommendType = '' }) {
    await this.ensureServerColumns();

    page = Math.max(1, intValue(page, 1));
    pageSize = Math.max(1, Math.min(intValue(pageSize, 20), 100));

    let levels = [];
    if (levelGroup === 'hall') {
      levels = [1];
    } else if (levelGroup === 'recommend') {
      levels = recommendType === 'featured' ? [2] : recommendType === 'community' ? [3] : [2, 3];
    }

    const params = [];
    const where = ['s.is_delete = 0', 's.parent_id is null'];

    if (state !== null && state !== '') {
      params.push(intValue(state));
      where.push(`s.state = $${params.length}`);
    }

    if (levels.length > 0) {
      params.push(levels);
      where.push(`s.level = any($${params.length}::int[])`);
    }

    keyword = String(keyword || '').trim();
    if (keyword) {
      params.push(`%${keyword}%`);
      const likeIndex = params.length;
      params.push(keyword);
      const exactIndex = params.length;
      where.push(`(s.id::text = $${exactIndex} or s.name ilike $${likeIndex} or s.ip ilike $${likeIndex} or u.username ilike $${likeIndex})`);
    }

    const whereSql = where.join(' and ');
    const countResult = await db.query(
      `
      select count(*)::int as total
      from tb_server s
      left join tb_user u on u.id = s.uid
      where ${whereSql}
      `,
      params
    );

    params.push(pageSize);
    const limitIndex = params.length;
    params.push((page - 1) * pageSize);
    const offsetIndex = params.length;

    const result = await db.query(
      `
      select s.id, s.uid, u.username as owner_username, s.name, s.ip, s.level, s.state, s.vid,
             s.whitelist_enabled, s.block_overseas_ip, s.allowed_regions, s.entry_verify_level,
             s.entry_verify_flags, s.server_kind, s.parent_id, s.group_join_mode,
             s.probe_offline_since, s.auto_unpublished_at, s.auto_unpublish_reason,
             v.name as version
      from tb_server s
      left join tb_version v on s.vid = v.id
      left join tb_user u on u.id = s.uid
      where ${whereSql}
      order by s.id desc
      limit $${limitIndex} offset $${offsetIndex}
      `,
      params
    );

    const parentJoinModes = this.buildParentJoinModeMap(result.rows);
    const childrenByParent = await this.listChildrenByParentIds(result.rows.map(row => row.id), parentJoinModes);
    const list = result.rows.map((row) => {
      const serverId = String(row.id || '');
      const serverKind = intValue(row.server_kind, KIND_NORMAL);
      const children = childrenByParent[serverId] || [];
      const ip = serverKind === KIND_GROUP && children.length > 0 ? String(children[0].ip || '') : String(row.ip || '');
      return {
        id: serverId,
        parentId: row.parent_id || null,
        serverKind,
        isGroup: serverKind === KIND_GROUP ? 1 : 0,
        groupJoinMode: serverKind === KIND_GROUP ? normalizeGroupJoinMode(row.group_join_mode) : GROUP_JOIN_DEFAULT,
        ownerUserId: intValue(row.uid),
        ownerUsername: String(row.owner_username || ''),
        name: String(row.name || ''),
        ip,
        level: intValue(row.level),
        state: intValue(row.state),
        whitelistEnabled: intValue(row.whitelist_enabled),
        blockOverseasIp: intValue(row.block_overseas_ip),
        allowedRegions: resolveAllowedRegions(row),
        entryVerifyLevel: intValue(row.entry_verify_level),
        entryVerifyFlags: resolveEntryVerifyFlags(row),
        versionId: intValue(row.vid),
        version: String(row.version || ''),
        children,
        probeOfflineSince: row.probe_offline_since || null,
        autoUnpublishedAt: row.auto_unpublished_at || null,
        autoUnpublishReason: row.auto_unpublish_reason || null,
        autoOfflineHours: Math.floor(autoOfflineSecondsForLevel(row.level) / 3600),
      };
    });

    return {
      list,
      total: intValue(countResult.rows[0]?.total),
      page,
      pageSize,
    };
  }
}

module.exports = new ServerDirectoryService();
