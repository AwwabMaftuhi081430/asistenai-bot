const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

let supabase = null;
let pgPool = null;

function getSupabase() {
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
    if (!conn) throw new Error('DATABASE_URL is required for raw queries');
    pgPool = new Pool({
      connectionString: conn,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pgPool;
}

// Convert MySQL ? placeholders to PostgreSQL $1, $2, ...
function convertParams(sql, params = []) {
  let idx = 0;
  const text = sql.replace(/\?/g, () => `$${++idx}`);
  return { text, values: params };
}

async function raw(sql, params = []) {
  const pool = getPool();
  const { text, values } = convertParams(sql, params);
  const result = await pool.query(text, values);
  return result.rows;
}

async function select(table, { columns = '*', where = {}, orderBy, orderDir = 'ASC', limit, single = false } = {}) {
  const sb = getSupabase();
  let query = sb.from(table).select(columns);

  for (const [key, value] of Object.entries(where)) {
    if (value === null) {
      query = query.is(key, null);
    } else if (typeof value === 'object' && value !== null && value.operator) {
      switch (value.operator) {
        case '>':  query = query.gt(key, value.value); break;
        case '<':  query = query.lt(key, value.value); break;
        case '>=': query = query.gte(key, value.value); break;
        case '<=': query = query.lte(key, value.value); break;
        case '!=': query = query.neq(key, value.value); break;
        case 'LIKE':  query = query.like(key, value.value); break;
        case 'ILIKE': query = query.ilike(key, value.value); break;
        default:
          // fallback to raw query for unknown operators
          return fallbackSelectRaw(table, columns, where, orderBy, orderDir, limit, single);
      }
    } else {
      query = query.eq(key, value);
    }
  }

  if (orderBy) {
    query = query.order(orderBy, { ascending: orderDir === 'ASC' });
  }

  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw error;

  if (single) return data?.[0] || null;
  return data || [];
}

// Fallback: build raw SQL for complex where clauses Supabase JS client can't express
async function fallbackSelectRaw(table, columns, where, orderBy, orderDir, limit, single) {
  const clauses = [];
  const params = [];

  for (const [key, value] of Object.entries(where)) {
    if (value === null) {
      clauses.push(`"${key}" IS NULL`);
    } else if (typeof value === 'object' && value !== null && value.operator) {
      clauses.push(`"${key}" ${value.operator} $${params.length + 1}`);
      params.push(value.value);
    } else {
      clauses.push(`"${key}" = $${params.length + 1}`);
      params.push(value);
    }
  }

  let sql = `SELECT ${columns} FROM "${table}"`;
  if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
  if (orderBy) sql += ` ORDER BY "${orderBy}" ${orderDir}`;
  if (limit) sql += ` LIMIT ${limit}`;
  if (single && !limit) sql += ' LIMIT 1';

  const pool = getPool();
  const result = await pool.query(sql, params);
  return single ? result.rows[0] || null : result.rows;
}

async function insert(table, data) {
  const sb = getSupabase();
  const { data: result, error } = await sb.from(table).insert(data).select();
  if (error) throw error;
  return result?.[0] || null;
}

async function update(table, data, where) {
  const sb = getSupabase();
  let query = sb.from(table).update(data);
  for (const [key, value] of Object.entries(where)) {
    query = query.eq(key, value);
  }
  const { data: result, error } = await query;
  if (error) throw error;
  return result;
}

async function upsert(table, data, conflictKey) {
  const sb = getSupabase();
  const { data: result, error } = await sb
    .from(table)
    .upsert(data, { onConflict: conflictKey })
    .select();
  if (error) throw error;
  return result;
}

async function remove(table, where) {
  const sb = getSupabase();
  let query = sb.from(table).delete();
  for (const [key, value] of Object.entries(where)) {
    query = query.eq(key, value);
  }
  const { data: result, error } = await query;
  if (error) throw error;
  return result;
}

module.exports = { raw, select, insert, update, upsert, delete: remove };
