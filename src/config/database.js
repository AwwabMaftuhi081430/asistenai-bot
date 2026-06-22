const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

let supabase = null;
let pgPool = null;

function getSb() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
    supabase = createClient(url, key);
  }
  return supabase;
}

function getPool() {
  if (!pgPool) {
    const conn = process.env.DATABASE_URL;
    if (!conn) throw new Error('DATABASE_URL is required');
    pgPool = new Pool({
      connectionString: conn,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });
  }
  return pgPool;
}

// ── raw() via pg pool — only works where DNS resolves (local, Render)
async function raw(sql, params = []) {
  const pool = getPool();
  let idx = 0;
  const text = sql.replace(/\?/g, () => `$${++idx}`);
  const result = await pool.query(text, params);
  return result.rows;
}

// ── select with filter array — uses Supabase REST API only
async function find(table, { columns = '*', filters = [], orderBy, orderDir = 'ASC', limit, single = false } = {}) {
  const sb = getSb();
  let q = sb.from(table).select(columns);

  for (const f of filters) {
    switch (f.op) {
      case '=':  q = q.eq(f.key, f.val); break;
      case '>':  q = q.gt(f.key, f.val); break;
      case '<':  q = q.lt(f.key, f.val); break;
      case '>=': q = q.gte(f.key, f.val); break;
      case '<=': q = q.lte(f.key, f.val); break;
      case '!=': q = q.neq(f.key, f.val); break;
      case 'is': q = q.is(f.key, f.val); break;
      case 'in': q = q.in(f.key, f.val); break;
      case 'like':  q = q.like(f.key, f.val); break;
      case 'ilike': q = q.ilike(f.key, f.val); break;
    }
  }

  if (orderBy) q = q.order(orderBy, { ascending: orderDir === 'ASC' });
  if (limit) q = q.limit(limit);
  if (single && !limit) q = q.limit(1);

  const { data, error } = await q;
  if (error) throw error;
  return single ? (data?.[0] || null) : (data || []);
}

// ── select via Supabase REST (simple where map, backward compat)
async function select(table, { columns = '*', where = {}, orderBy, orderDir = 'ASC', limit, single = false } = {}) {
  const filters = [];
  for (const [key, val] of Object.entries(where)) {
    if (val === null) {
      filters.push({ key, op: 'is', val: null });
    } else if (typeof val === 'object' && val !== null && val.operator) {
      const opMap = { '>': '>', '<': '<', '>=': '>=', '<=': '<=', '!=': '!=', LIKE: 'like', ILIKE: 'ilike' };
      filters.push({ key, op: opMap[val.operator] || '=', val: val.value });
    } else {
      filters.push({ key, op: '=', val });
    }
  }
  return find(table, { columns, filters, orderBy, orderDir, limit, single });
}

async function insert(table, data) {
  const sb = getSb();
  const { data: result, error } = await sb.from(table).insert(data).select();
  if (error) throw error;
  return result?.[0] || null;
}

async function update(table, data, where) {
  const sb = getSb();
  let q = sb.from(table).update(data);
  for (const [key, val] of Object.entries(where)) q = q.eq(key, val);
  const { data: result, error } = await q;
  if (error) throw error;
  return result;
}

async function upsert(table, data, conflictKey) {
  const sb = getSb();
  const { data: result, error } = await sb.from(table).upsert(data, { onConflict: conflictKey }).select();
  if (error) throw error;
  return result;
}

async function remove(table, where) {
  const sb = getSb();
  let q = sb.from(table).delete();
  for (const [key, val] of Object.entries(where)) q = q.eq(key, val);
  const { data: result, error } = await q;
  if (error) throw error;
  return result;
}

module.exports = { raw, find, select, insert, update, upsert, delete: remove, getSb };
