#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { newDb } = require('pg-mem');

/**
 * Local (offline) Supabase types generator.
 *
 * The schema file in this repo is a pg_dump *plain text* dump which includes psql meta
 * commands (like \restrict) and lots of non-DDL statements (SET, ALTER, CREATE FUNCTION, etc).
 * pg-mem cannot parse that whole file directly.
 *
 * So this script:
 *  1) Auto-selects a schema file (newest supabase/schema/schema_full_*.sql by default)
 *  2) Extracts ONLY the DDL we need for typing:
 *     - public enums (CREATE TYPE public.* AS ENUM ...)
 *     - public tables (CREATE TABLE public.* (...))
 *  3) Sanitizes the extracted table DDL (removes defaults, checks, references, and constraints)
 *     so pg-mem can load it.
 *  4) Queries information_schema.columns from pg-mem to get column names + types.
 *  5) Generates src/types/supabase.ts with Database types.
 */

function resolveSchemaPath() {
  const repoRoot = path.join(__dirname, '..');

  // Optional override
  const envPath = process.env.SUPABASE_SCHEMA_FILE;
  if (envPath) {
    const abs = path.isAbsolute(envPath) ? envPath : path.join(repoRoot, envPath);
    if (!fs.existsSync(abs)) {
      console.error(`SUPABASE_SCHEMA_FILE is set but file not found: ${abs}`);
      process.exit(1);
    }
    return abs;
  }

  // Prefer newest schema_full dump
  const schemaDir = path.join(repoRoot, 'supabase', 'schema');
  if (fs.existsSync(schemaDir) && fs.statSync(schemaDir).isDirectory()) {
    const candidates = fs
      .readdirSync(schemaDir)
      .filter((f) => /^schema_full_\d{8}(?:_\d{6})?\.sql$/i.test(f))
      .map((filename) => {
        const fullPath = path.join(schemaDir, filename);
        const m = filename.match(/^schema_full_(\d{8})(?:_(\d{6}))?\.sql$/i);
        const scoreFromName = m ? Number(`${m[1]}${m[2] || '000000'}`) : 0;
        const mtimeMs = fs.statSync(fullPath).mtimeMs;
        return { fullPath, scoreFromName, mtimeMs };
      })
      .sort((a, b) => {
        if (b.scoreFromName !== a.scoreFromName) return b.scoreFromName - a.scoreFromName;
        return b.mtimeMs - a.mtimeMs;
      });
    if (candidates.length) return candidates[0].fullPath;
  }

  // Legacy fallback
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

function isValidKey(key) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key);
}

function formatKey(key) {
  return isValidKey(key) ? key : JSON.stringify(key);
}

function extractPublicEnums(rawSql) {
  // Capture full CREATE TYPE ... AS ENUM (...) ; blocks for public schema
  const enumDDL = [];
  const enumValues = new Map();

  const re = /CREATE TYPE\s+public\.([a-zA-Z0-9_]+)\s+AS ENUM\s*\(([\s\S]*?)\)\s*;/gi;
  let m;
  while ((m = re.exec(rawSql)) !== null) {
    const [, enumName, valuesRaw] = m;
    enumDDL.push(m[0]);

    const values = valuesRaw
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      // values in pg_dump are like 'text' OR 'text'::something; strip quotes and any casts
      .map((v) => v.replace(/::[a-zA-Z0-9_\.\"]+/g, ''))
      .map((v) => v.replace(/^'(.*)'$/, '$1'));

    enumValues.set(enumName, values);
  }

  return { enumDDL, enumValues };
}

function extractPublicTables(rawSql) {
  // Capture CREATE TABLE public.<name> ( ... ); blocks.
  // We ALSO parse column defaults from the raw body so we can decide Insert optionality
  // even if we remove DEFAULT clauses for pg-mem compatibility.
  const tableNames = [];
  const tableBodies = new Map(); // table -> raw body
  const defaultsByTable = new Map(); // table -> Set<column>

  const tableRe = /CREATE TABLE\s+public\.([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\);/g;
  let m;
  while ((m = tableRe.exec(rawSql)) !== null) {
    const [, tableName, body] = m;
    tableNames.push(tableName);
    tableBodies.set(tableName, body);

    const defaults = new Set();
    const lines = body.split(/\r?\n/);
    for (const line0 of lines) {
      const line = line0.trim();
      if (!line) continue;
      if (/^CONSTRAINT\b/i.test(line)) continue;
      if (/^PRIMARY KEY\b/i.test(line)) continue;
      if (/^UNIQUE\b/i.test(line)) continue;

      // column name is first token (quoted or not)
      const colMatch = line.match(/^"?([a-zA-Z0-9_]+)"?\s+/);
      if (!colMatch) continue;
      const colName = colMatch[1];

      // treat DEFAULT / identity / serial as "has server-side value"
      if (/\bDEFAULT\b/i.test(line)) defaults.add(colName);
      if (/\bGENERATED\s+.*\bIDENTITY\b/i.test(line)) defaults.add(colName);
      if (/\bserial\b/i.test(line)) defaults.add(colName);
    }
    defaultsByTable.set(tableName, defaults);
  }

  return { tableNames: Array.from(new Set(tableNames)), tableBodies, defaultsByTable };
}

function extractForeignKeysFromTableBody(tableName, body) {
  // FK constraints only (table-level). Column-level REFERENCES are ignored here.
  const fkDefs = [];
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
  return fkDefs;
}

function sanitizeTableDDL(tableName, rawBody) {
  // Make a pg-mem-friendly CREATE TABLE statement.
  // We remove most constraints/defaults/references; we only need columns + their types.
  const outLines = [];
  for (const line0 of rawBody.split(/\r?\n/)) {
    let line = line0.trimEnd();
    if (!line.trim()) continue;

    // Drop table-level constraints entirely (includes CHECK, FK, UNIQUE, PK constraints)
    if (/^\s*CONSTRAINT\b/i.test(line)) continue;
    if (/^\s*(PRIMARY KEY|UNIQUE)\b/i.test(line)) continue;

    // Remove CHECK constraints that can appear inline
    line = line.replace(/\s+CHECK\s*\([\s\S]*?\)/gi, '');

    // Remove DEFAULT clauses (pg-mem often fails on Supabase functions / casts)
    // This regex removes from DEFAULT to end-of-line (before optional trailing comma)
    line = line.replace(/\s+DEFAULT\s+[\s\S]*?(?=,\s*$|$)/i, '');

    // Remove column-level REFERENCES ... clauses (can reference schemas we didn't create)
    line = line.replace(/\s+REFERENCES\s+[\s\S]*?(?=,\s*$|$)/i, '');

    // Remove some Postgres-only decorations
    line = line.replace(/\s+COLLATE\s+"[^"]+"\."[^"]+"/gi, '');
    line = line.replace(/\s+COLLATE\s+"[^"]+"/gi, '');

    // Clean double spaces
    line = line.replace(/\s{2,}/g, ' ');

    // If line became just a comma, skip
    if (line.trim() === ',') continue;

    outLines.push(line.trim());
  }

  // Ensure valid commas between column lines
  const fixed = outLines
    .map((l) => l.replace(/,\s*$/, ''))
    .filter(Boolean)
    .map((l, idx, arr) => (idx === arr.length - 1 ? l : `${l},`));

  return `CREATE TABLE public.${tableName} (\n${fixed.map((l) => `  ${l}`).join('\n')}\n);`;
}

function mapScalarType(udtName, enums) {
  if (enums.has(udtName)) {
    return `Database["public"]["Enums"]["${udtName}"]`;
  }

  const base = udtName && udtName.startsWith('_') ? udtName.slice(1) : udtName;
  const lookup = {
    text: 'string',
    varchar: 'string',
    bpchar: 'string',
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
    time: 'string',
    timetz: 'string',
    json: 'Json',
    jsonb: 'Json',
  };

  return lookup[base] || 'unknown';
}

function mapColumnType(dataType, udtName, enums) {
  if (dataType === 'ARRAY' || (udtName && udtName.startsWith('_'))) {
    const base = mapScalarType(udtName, enums);
    return `${base}[]`;
  }
  if (dataType === 'USER-DEFINED') {
    return mapScalarType(udtName, enums);
  }
  return mapScalarType(udtName || dataType, enums);
}

(async () => {
  const schemaPath = resolveSchemaPath();
  const rawSchemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Extract the parts we need from a pg_dump text file
  const { enumDDL, enumValues } = extractPublicEnums(rawSchemaSql);
  const { tableNames, tableBodies, defaultsByTable } = extractPublicTables(rawSchemaSql);

  // Extract FK relationships from raw bodies (table-level FKs only)
  const fkDefs = [];
  for (const t of tableNames) {
    const body = tableBodies.get(t) || '';
    fkDefs.push(...extractForeignKeysFromTableBody(t, body));
  }

  // Create pg-mem DB
  const db = newDb({ autoCreateForeignKeyIndices: true });

  // Common functions used in schemas
  db.public.registerFunction({
    name: 'gen_random_uuid',
    returns: 'uuid',
    implementation: () => randomUUID(),
  });
  db.public.registerFunction({
    name: 'now',
    returns: 'timestamptz',
    implementation: () => new Date(),
  });

  // Create placeholder schemas that often get referenced
  db.public.none('CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA realtime;');
  db.public.none('CREATE TABLE auth.users (id uuid primary key);');

  try {
    // Load enums first
    for (const ddl of enumDDL) {
      db.public.none(ddl);
    }

    // Load sanitized public tables
    for (const tableName of tableNames) {
      const body = tableBodies.get(tableName);
      if (!body) continue;
      const ddl = sanitizeTableDDL(tableName, body);
      db.public.none(ddl);
    }
  } catch (err) {
    console.error('Failed to load schema into the in-memory database.');
    console.error(`Schema path: ${schemaPath}`);
    console.error(err && err.message ? err.message : err);
    process.exit(1);
  }

  const { Pool } = db.adapters.createPg();
  const pool = new Pool();

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

  for (const tableName of tableNames) {
    const res = await pool.query(
      `
      SELECT
        column_name,
        data_type,
        udt_name,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `,
      [tableName],
    );
    const columns = res.rows;

    const hasDefaultSet = defaultsByTable.get(tableName) || new Set();
    const relsForTable = relsByTableName.get(tableName) || [];

    const rowFields = columns.map((col) => {
      const baseType = mapColumnType(col.data_type, col.udt_name, enumValues);
      const tsType = col.is_nullable === 'YES' ? `${baseType} | null` : baseType;
      return `          ${formatKey(col.column_name)}: ${tsType};`;
    });

    const insertFields = columns.map((col) => {
      const baseType = mapColumnType(col.data_type, col.udt_name, enumValues);
      const tsType = col.is_nullable === 'YES' ? `${baseType} | null` : baseType;

      // Optional if nullable OR has a DEFAULT/identity detected from raw dump
      const hasServerDefault = hasDefaultSet.has(col.column_name);
      const key =
        hasServerDefault || col.is_nullable === 'YES'
          ? `${formatKey(col.column_name)}?:`
          : `${formatKey(col.column_name)}:`;
      return `          ${key} ${tsType};`;
    });

    const updateFields = columns.map((col) => {
      const baseType = mapColumnType(col.data_type, col.udt_name, enumValues);
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
        lines.push(
          `            referencedColumns: [${rel.referencedColumns.map((c) => `"${c}"`).join(', ')}];`,
        );
        lines.push('          },');
      }
      // Remove trailing comma in last relationship
      const last = lines.pop();
      lines.push(last ? last.replace(/,$/, '') : '');
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
  for (const [name, values] of enumValues.entries()) {
    lines.push(`      ${formatKey(name)}: ${values.map((v) => `'${v}'`).join(' | ')};`);
  }
  lines.push('    };');
  lines.push('    CompositeTypes: {');
  lines.push('      [_ in never]: never;');
  lines.push('    };');
  lines.push('  };');
  lines.push('}');

  const outPath = path.join(__dirname, '..', 'src', 'types', 'supabase.ts');
  fs.writeFileSync(outPath, `${lines.join('\n')}\n`);

  const relOut = path.relative(path.join(__dirname, '..'), outPath);
  const schemaRel = path.relative(path.join(__dirname, '..'), schemaPath);
  console.log(`✅ Generated Supabase types -> ${relOut}`);
  console.log(`📄 Schema used -> ${schemaRel}`);
})();
