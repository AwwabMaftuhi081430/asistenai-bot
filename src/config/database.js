const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'asistenai',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+07:00',
});

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function select(table, { columns = '*', where = {}, orderBy, orderDir = 'ASC', limit, single = false } = {}) {
  let sql = `SELECT ${columns} FROM \`${table}\``;
  const params = [];
  const whereClauses = [];

  for (const [key, value] of Object.entries(where)) {
    if (value === null) {
      whereClauses.push(`\`${key}\` IS NULL`);
    } else if (typeof value === 'object' && value !== null && value.operator) {
      whereClauses.push(`\`${key}\` ${value.operator} ?`);
      params.push(value.value);
    } else {
      whereClauses.push(`\`${key}\` = ?`);
      params.push(value);
    }
  }

  if (whereClauses.length > 0) {
    sql += ' WHERE ' + whereClauses.join(' AND ');
  }

  if (orderBy) {
    sql += ` ORDER BY \`${orderBy}\` ${orderDir}`;
  }

  if (limit) {
    sql += ` LIMIT ${limit}`;
  }
  if (single) {
    sql += ' LIMIT 1';
  }

  const [rows] = await pool.execute(sql, params);
  return single ? rows[0] || null : rows;
}

async function insert(table, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map(() => '?').join(', ');
  const cols = keys.map(k => `\`${k}\``).join(', ');

  const sql = `INSERT INTO \`${table}\` (${cols}) VALUES (${placeholders})`;
  const [result] = await pool.execute(sql, values);
  return result;
}

async function update(table, data, where) {
  const setClauses = Object.keys(data).map(k => `\`${k}\` = ?`).join(', ');
  const whereClauses = Object.keys(where).map(k => `\`${k}\` = ?`).join(' AND ');
  const params = [...Object.values(data), ...Object.values(where)];

  const sql = `UPDATE \`${table}\` SET ${setClauses} WHERE ${whereClauses}`;
  const [result] = await pool.execute(sql, params);
  return result;
}

async function upsert(table, data, conflictKey) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map(() => '?').join(', ');
  const cols = keys.map(k => `\`${k}\``).join(', ');

  const updateSet = keys.map(k => `\`${k}\` = VALUES(\`${k}\`)`).join(', ');

  const sql = `INSERT INTO \`${table}\` (${cols}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateSet}`;
  const [result] = await pool.execute(sql, values);
  return result;
}

async function remove(table, where) {
  const whereClauses = Object.keys(where).map(k => `\`${k}\` = ?`).join(' AND ');
  const params = Object.values(where);

  const sql = `DELETE FROM \`${table}\` WHERE ${whereClauses}`;
  const [result] = await pool.execute(sql, params);
  return result;
}

async function raw(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

module.exports = { pool, query, select, insert, update, upsert, delete: remove, raw };
