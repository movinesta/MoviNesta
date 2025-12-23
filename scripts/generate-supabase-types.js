#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { newDb } = require('pg-mem');

/**
 * Option B:
 * - Prefer the newest schema dump in supabase/schema/schema_full_*.sql
 * - Fallback to supabase/schema.sql (legacy path)
 * - Optional override via env var SUPABASE_SCHEMA_FILE (relative to repo root or absolute)
 */
function resolveSchemaPath() {
  const repoRoot = path.join(__dirname, '..');

  // 1) Explicit override
  const envPath = process.env.SUPABASE_SCHEMA_FILE;
  if (envPath) {
    const abs = path.isAbsolute(envPath) ? envPath : path.join(repoRoot, envPath);
    if (!fs.existsSync(abs)) {
      console.error(`SUPABASE_SCHEMA_FILE is set but file not found: ${abs}`);
      process.exit(1);
    }
    return abs;
  }

  // 2) Auto-pick newest supabase/schema/schema_full_*.sql
  const schemaDir = path.join(repoRoot, 'supabase', 'schema');
  if (fs.existsSync(schemaDir) && fs.statSync(schemaDir).isDirectory()) {
    const files = fs.readdirSync(schemaDir);

    const candidates = files
      .filter((f) => /^schema_full_\d{8}(?:_\d{6})?\.sql$/i.test(f))
      .map((filename) => {
        const fullPath = path.join(schemaDir, filename);

        // Prefer the timestamp embedded in filename, e.g. schema_full_20251223_071805.sql
        const m = filename.match(/^schema_full_(\d{8})(?:_(\d{6}))?\.sql$/i);
        const scoreFromName = m ? Number(`${m[1]}${m[2] || '000000'}`) : 0;

        // As a fallback tie-breaker, use mtime
        const mtimeMs = fs.statSync(fullPath).mtimeMs;

        return { filename, fullPath, scoreFromName, mtimeMs };
      })
      .sort((a, b) => {
        if (b.scoreFromName !== a.scoreFromName) return b.scoreFromName - a.scoreFromName;
        return b.mtimeMs - a.mtimeMs;
      });

    if (candidates.length) return candidates[0].fullPath;
  }

  // 3) Legacy fallback
  const legacy = path.join(repoRoot, 'supabase', 'schema.sql');
  if (fs.existsSync(legacy)) return legacy;

  console.error(
    [
      'No schema file found.',
      `Looked for newest: ${path.join('supabase', 'schema', 'schema_full_*.sql')}`,
      `Fallback path: ${path.join('supabase', 'schema.sql')}`,
      'You can also set SUPABASE_SCHEMA_FILE to override.',
    ].join('\n'),
  );
  process.exit(1);
}

const schemaPath = resolveSchemaPath();
const rawSchemaSql = fs.readFileSync(schemaPath, 'utf8');

// --- Extract FK relationships from the raw schema dump (before we strip FK lines for pg-mem)
const fkDefs = [];
const tableNames = [];
const tableBlockRegex = /CREATE TABLE\s+public\.([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\);/g;
let match;
while ((match = tableBlockRegex.exec(rawSchemaSql)) !== null) {
  const [, tableName, body] = match;
  tableNames.push(tableName);
  const fkRegex =
    /CONSTRAINT\s+([a-zA-Z0-9_]+)\s+FOREIGN KEY\s*\(([^)]+)\)\s+REFERENCES\s+([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s*\(([^)]+)\)/gi;
  let fkMatch;
  while ((fkMatch = fkRegex.exec(body)) !== null) {
    const [, constraintName, cols, , refTable, refCols] = fkMatch;
    fkDefs.push({
      table: tableName,
      constraintName,
      columns: cols.split(',').map((c) => c.trim().replace(/"/g, '')),
      referencedRelation: refTable,
      referencedColumns: refCols.split(',').map((c) => c.trim().replace(/"/g, '')),
    });
  }
}

// --- Extract enums from the raw schema
const enumDefs = new Map();
const enumRegex = /CREATE TYPE\s+public\.([a-zA-Z0-9_]+)\s+AS ENUM\s*\(([^)]+)\)/gi;
let enumMatch;
while ((enumMatch = enumRegex.exec(rawSchemaSql)) !== null) {
  const [, name, valuesRaw] = enumMatch;
  const values = valuesRaw
    .split(',')
    .map((v) => v.trim().replace(/^'(.*)'$/, '$1'))
    .filter(Boolean);
  enumDefs.set(name, values);
}

/**
 * pg-mem is picky about some Postgres/Supabase-specific constructs.
 * This "sanitized" schema gets loaded into pg-mem so we can query information_schema.columns
 * to generate accurate column lists/types.
 *
 * NOTE: We intentionally strip FOREIGN KEY lines here because pg-mem can choke on some FK variants,
 * but we already captured FKs above (fkDefs), and we emit relationships from that.
 */
const schemaSql = rawSchemaSql
  .replace(/CREATE EXTENSION[^;]+;/gi, '')
  .replace(/now\(\)\s*AT TIME ZONE\s*'[^']*'/gi, 'now()')
  .replace(/\(\(\s*now\(\)\s*\)::text\s*\)::date/gi, 'now()')
  .replace(/DEFAULT\s+[^,]*?(tmdb_raw|omdb_raw)[^,]*/gi, '')
  .replace(/\s+CHECK\s*\([^)]+\)/gi, '')
  .split('\n')
  .filter((line) => !/FOREIGN KEY/i.test(line))
  .join('\n')
  .replace(/,\s*\)/g, '\n)')
  .replace(/;\s*;/g, ';');

const isValidKey = (key) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key);
const formatKey = (key) => (isValidKey(key) ? key : JSON.stringify(key));

const mapScalarType = (udtName, enums) => {
  if (enums.has(udtName)) {
    return `Database["public"]["Enums"]["${udtName}"]`;
  }

  const base = udtName && udtName.startsWith('_') ? udtName.slice(1) : udtName;
  const lookup = {
    text: 'string',
    varchar: 'string',
    bpchar: 'string',
    'character varying': 'string',
    citext: 'string',
    uuid: 'string',
    bytea: 'string',
    bool: 'boolean',
    boolean: 'boolean',
    int2: 'number',
    int4: 'number',
    int8: 'number',
    float4: 'number',
    float8: 'number',
    numeric: 'number',
    money: 'number',
    date: 'string',
    timestamptz: 'string',
    timestamp: 'string',
    'timestamp without time zone': 'string',
    'timestamp with time zone': 'string',
    time: 'string',
    timetz: 'string',
    json: 'Json',
    jsonb: 'Json',
  };

  return lookup[base] || 'unknown';
};

const mapColumnType = (dataType, udtName, enums) => {
  if (dataType === 'ARRAY' || (udtName && udtName.startsWith('_'))) {
    const base = mapScalarType(udtName, enums);
    return `${base}[]`;
  }

  if (dataType === 'USER-DEFINED') {
    return mapScalarType(udtName, enums);
  }

  return mapScalarType(udtName || dataType, enums);
};

(async () => {
  const db = newDb({ autoCreateForeignKeyIndices: true });

  // Support common Supabase default function
  db.public.registerFunction({
    name: 'gen_random_uuid',
    returns: 'uuid',
    implementation: () => randomUUID(),
  });

  // Some schemas reference auth.users; create a minimal placeholder
  db.public.none('CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid primary key);');

  try {
    for (const statement of schemaSql.split(/;\s*/)) {
      const sql = statement.trim();
      if (!sql) continue;
      db.public.none(sql);
    }
  } catch (err) {
    console.error(`Failed to load schema into the in-memory database.`);
    console.error(`Schema path: ${schemaPath}`);
    console.error(err && err.message ? err.message : err);
    process.exit(1);
  }

  const { Pool } = db.adapters.createPg();
  const pool = new Pool();
  const query = async (sql, params = []) => {
    const res = await pool.query(sql, params);
    return res.rows;
  };

  const enums = enumDefs;
  const tables = Array.from(new Set(tableNames));

  const relsByTableName = new Map();
  for (const rel of fkDefs) {
    const list = relsByTableName.get(rel.table) || [];
    list.push(rel);
    relsByTableName.set(rel.table, list);
  }

  const lines = [];
  lines.push('export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];');
  lines.push('');
  lines.push('export interface Database {');
  lines.push('  public: {');
  lines.push('    Tables: {');

  for (const tableName of tables) {
    const columns = await query(
      `
      SELECT
        column_name,
        data_type,
        udt_name,
        is_nullable,
        column_default,
        is_identity,
        identity_generation,
        is_generated
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `,
      [tableName],
    );

    const relsForTable = relsByTableName.get(tableName) || [];

    const rowFields = columns.map((col) => {
      const baseType = mapColumnType(col.data_type, col.udt_name, enums);
      const tsType = col.is_nullable === 'YES' ? `${baseType} | null` : baseType;
      return `          ${formatKey(col.column_name)}: ${tsType};`;
    });

    const insertFields = columns.map((col) => {
      const baseType = mapColumnType(col.data_type, col.udt_name, enums);
      const tsType = col.is_nullable === 'YES' ? `${baseType} | null` : baseType;
      const hasDefault =
        col.column_default !== null ||
        col.is_identity === 'YES' ||
        (col.identity_generation && col.identity_generation !== 'NEVER') ||
        (col.is_generated && col.is_generated !== 'NEVER');
      const key = hasDefault || col.is_nullable === 'YES' ? `${formatKey(col.column_name)}?:` : `${formatKey(col.column_name)}:`;
      return `          ${key} ${tsType};`;
    });

    const updateFields = columns.map((col) => {
      const baseType = mapColumnType(col.data_type, col.udt_name, enums);
      const tsType = col.is_nullable === 'YES' ? `${baseType} | null` : baseType;
      return `          ${formatKey(col.column_name)}?: ${tsType};`;
    });

    lines.push(`      ${formatKey(tableName)}: {`);
    lines.push('        Row: {');
    lines.push(...rowFields);
    lines.push('        };');
    lines.push('        Insert: {');
    lines.push(...insertFields);
    lines.push('        };');
    lines.push('        Update: {');
    lines.push(...updateFields);
    lines.push('        };');
    lines.push('        Relationships: [');

    if (relsForTable.length) {
      for (const rel of relsForTable) {
        lines.push('          {');
        lines.push(`            foreignKeyName: "${rel.constraintName}";`);
        lines.push(`            columns: [${rel.columns.map((c) => `"${c}"`).join(', ')}];`);
        lines.push(`            referencedRelation: "${rel.referencedRelation}";`);
        lines.push(`            referencedColumns: [${rel.referencedColumns.map((c) => `"${c}"`).join(', ')}];`);
        lines.push('          },');
      }
      const last = lines.pop();
      lines.push(last?.replace(/,$/, '') ?? '');
    }

    lines.push('        ];');
    lines.push('      };');
  }

  lines.push('    };');
  lines.push('    Views: {');
  lines.push('      [_ in never]: never;');
  lines.push('    };');
  lines.push('    Functions: {');
  lines.push('      [_ in never]: never;');
  lines.push('    };');
  lines.push('    Enums: {');
  for (const [name, values] of enums.entries()) {
    lines.push(`      ${formatKey(name)}: ${values.map((v) => `'${v}'`).join(' | ')};`);
  }
  lines.push('    };');
  lines.push('    CompositeTypes: {');
  lines.push('      [_ in never]: never;');
  lines.push('    };');
  lines.push('  };');
  lines.push('}');

  const outPath = path.join(__dirname, '..', 'src', 'types', 'supabase.ts');
  fs.writeFileSync(outPath, lines.join('\n') + '\n');

  const relOut = path.relative(path.join(__dirname, '..'), outPath);
  const schemaRel = path.relative(path.join(__dirname, '..'), schemaPath);
  console.log(`✅ Generated Supabase types -> ${relOut}`);
  console.log(`📄 Schema used -> ${schemaRel}`);
})();
