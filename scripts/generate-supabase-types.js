#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { PostgresMeta } = require('@supabase/postgres-meta');

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Please set SUPABASE_DB_URL or DATABASE_URL to a Postgres connection string.');
  process.exit(1);
}

const isValidKey = (key) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key);
const formatKey = (key) => (isValidKey(key) ? key : JSON.stringify(key));

const mapType = (format, dataType) => {
  const lower = (format || dataType || '').toLowerCase();
  const isArray = lower.startsWith('_');
  const base = isArray ? lower.slice(1) : lower;
  const lookup = {
    text: 'string',
    varchar: 'string',
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
    'timestamp with time zone': 'string',
    timestamptz: 'string',
    'timestamp without time zone': 'string',
    timestamp: 'string',
    time: 'string',
    'time without time zone': 'string',
    'time with time zone': 'string',
    json: 'Json',
    jsonb: 'Json',
  };
  const mapped = lookup[base] || 'unknown';
  return isArray ? `${mapped}[]` : mapped;
};

(async () => {
  const meta = new PostgresMeta({ connectionString });
  const [{ data: tables, error: tablesError }, { data: rels, error: relsError }, { data: types, error: typesError }] = await Promise.all([
    meta.tables.list({ includeColumns: true }),
    meta.relationships.list(),
    meta.types.list(),
  ]);

  if (tablesError) throw tablesError;
  if (relsError) throw relsError;
  if (typesError) throw typesError;

  const enums = (types || []).filter((t) => t.schema === 'public' && (t.enums?.length ?? 0) > 0);
  const relationshipsByTable = new Map();
  for (const rel of rels || []) {
    if (rel.schema !== 'public') continue;
    const list = relationshipsByTable.get(rel.relation) || [];
    list.push(rel);
    relationshipsByTable.set(rel.relation, list);
  }

  const lines = [];
  lines.push('export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];');
  lines.push('');
  lines.push('export interface Database {');
  lines.push('  public: {');
  lines.push('    Tables: {');

  for (const table of (tables || []).filter((t) => t.schema === 'public')) {
    const relsForTable = relationshipsByTable.get(table.name) || [];
    const rowFields = table.columns.map((col) => {
      const baseType = col.enums?.length ? col.enums.map((v) => `'${v}'`).join(' | ') : mapType(col.format, col.data_type);
      const tsType = col.is_nullable ? `${baseType} | null` : baseType;
      return `          ${formatKey(col.name)}: ${tsType};`;
    });

    const insertFields = table.columns.map((col) => {
      const hasDefault =
        col.default_value !== null || col.is_identity || col.identity_generation || col.is_generated;
      const baseType = col.enums?.length ? col.enums.map((v) => `'${v}'`).join(' | ') : mapType(col.format, col.data_type);
      const tsType = col.is_nullable ? `${baseType} | null` : baseType;
      const key = hasDefault || col.is_nullable ? `${formatKey(col.name)}?:` : `${formatKey(col.name)}:`;
      return `          ${key} ${tsType};`;
    });

    const updateFields = table.columns.map((col) => {
      const baseType = col.enums?.length ? col.enums.map((v) => `'${v}'`).join(' | ') : mapType(col.format, col.data_type);
      const tsType = col.is_nullable ? `${baseType} | null` : baseType;
      return `          ${formatKey(col.name)}?: ${tsType};`;
    });

    lines.push(`      ${formatKey(table.name)}: {`);
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
        lines.push(`            foreignKeyName: "${rel.foreign_key_name}";`);
        lines.push(`            columns: [${rel.columns.map((c) => `"${c}"`).join(', ')}];`);
        lines.push(`            referencedRelation: "${rel.referenced_relation}";`);
        lines.push(`            referencedColumns: [${rel.referenced_columns.map((c) => `"${c}"`).join(', ')}];`);
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
  for (const en of enums) {
    lines.push(`      ${formatKey(en.name)}: ${en.enums.map((v) => `'${v}'`).join(' | ')};`);
  }
  lines.push('    };');
  lines.push('    CompositeTypes: {');
  lines.push('      [_ in never]: never;');
  lines.push('    };');
  lines.push('  };');
  lines.push('}');

  const outPath = path.join(__dirname, '..', 'src', 'types', 'supabase.ts');
  fs.writeFileSync(outPath, lines.join('\n') + '\n');
})();
