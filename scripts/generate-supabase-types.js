#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

/**
 * Supabase types generator (offline, pg_dump-friendly).
 *
 * Why this version:
 * - Your schema file is a pg_dump "plain text" dump which may include psql meta commands
 *   and Postgres features that pg-mem can't parse (e.g. tsvector, generated columns, etc).
 * - Instead of loading SQL into an in-memory database, this script parses:
 *   - CREATE TYPE public.* AS ENUM (...)
 *   - CREATE TABLE public.* ( ... )
 *   - FK constraints inside those CREATE TABLE bodies
 *
 * Output:
 * - src/types/supabase.ts
 *
 * Notes:
 * - Views/Functions/CompositeTypes are left as never (same as before).
 * - Column types are mapped with a pragmatic Postgres->TS mapping.
 * - Insert optional fields are inferred from DEFAULT/IDENTITY/SERIAL/GENERATED or nullable.
 */

function resolveSchemaPath() {
  const repoRoot = path.join(__dirname, "..");

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
  const schemaDir = path.join(repoRoot, "supabase", "schema");
  if (fs.existsSync(schemaDir) && fs.statSync(schemaDir).isDirectory()) {
    const candidates = fs
      .readdirSync(schemaDir)
      .filter((f) => /^schema_full_\d{8}(?:_\d{6})?\.sql$/i.test(f))
      .map((filename) => {
        const fullPath = path.join(schemaDir, filename);
        const m = filename.match(/^schema_full_(\d{8})(?:_(\d{6}))?\.sql$/i);
        const scoreFromName = m ? Number(`${m[1]}${m[2] || "000000"}`) : 0;
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
  const legacy = path.join(repoRoot, "supabase", "schema.sql");
  if (fs.existsSync(legacy)) return legacy;

  console.error(
    [
      "No schema file found.",
      `Looked for newest: ${path.join("supabase", "schema", "schema_full_*.sql")}`,
      `Fallback path: ${path.join("supabase", "schema.sql")}`,
      "You can also set SUPABASE_SCHEMA_FILE to override.",
    ].join("\n"),
  );
  process.exit(1);
}

function isValidKey(key) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key);
}

function formatKey(key) {
  return isValidKey(key) ? key : JSON.stringify(key);
}

function stripQuotes(ident) {
  return ident.replace(/"/g, "");
}

function extractPublicEnums(rawSql) {
  const enumValues = new Map();

  const re = /CREATE TYPE\s+public\.([a-zA-Z0-9_]+)\s+AS ENUM\s*\(([\s\S]*?)\)\s*;/gi;
  let m;
  while ((m = re.exec(rawSql)) !== null) {
    const [, enumName, valuesRaw] = m;

    const values = valuesRaw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      // strip casts like 'x'::text
      .map((v) => v.replace(/::[a-zA-Z0-9_\.\"]+/g, ""))
      .map((v) => v.replace(/^'(.*)'$/, "$1"));

    enumValues.set(enumName, values);
  }

  return enumValues;
}

function extractPublicTables(rawSql) {
  /**
   * Supports patterns like:
   * - CREATE TABLE public.foo ( ... );
   * - CREATE TABLE ONLY public.foo ( ... );
   * - CREATE TABLE IF NOT EXISTS public.foo ( ... );
   */
  const tables = [];
  const tableBodies = new Map();

  const re =
    /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:ONLY\s+)?public\.([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\)\s*;/gim;

  let m;
  while ((m = re.exec(rawSql)) !== null) {
    const [, tableName, body] = m;
    tables.push(tableName);
    tableBodies.set(tableName, body);
  }

  // keep original order but unique
  const seen = new Set();
  const unique = [];
  for (const t of tables) {
    if (!seen.has(t)) {
      seen.add(t);
      unique.push(t);
    }
  }

  return { tableNames: unique, tableBodies };
}

function extractForeignKeysFromTableBody(tableName, body) {
  const fkDefs = [];
  const fkRegex =
    /CONSTRAINT\s+([a-zA-Z0-9_]+)\s+FOREIGN KEY\s*\(([^)]+)\)\s+REFERENCES\s+([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s*\(([^)]+)\)/gi;

  let fkMatch;
  while ((fkMatch = fkRegex.exec(body)) !== null) {
    const [, constraintName, cols, , refTable, refCols] = fkMatch;
    fkDefs.push({
      table: tableName,
      constraintName,
      columns: cols.split(",").map((c) => stripQuotes(c.trim())),
      referencedRelation: refTable,
      referencedColumns: refCols.split(",").map((c) => stripQuotes(c.trim())),
    });
  }

  return fkDefs;
}

function findBoundaryIndex(s) {
  // Find earliest boundary keyword outside parentheses.
  // Boundaries indicate start of constraints/defaults, end of the type portion.
  const boundaries = [
    " not null",
    " null",
    " default",
    " generated",
    " constraint",
    " references",
    " check",
    " collate",
    " primary key",
    " unique",
  ];

  const lower = s.toLowerCase();
  let paren = 0;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(") paren++;
    else if (ch === ")") paren = Math.max(0, paren - 1);

    if (paren !== 0) continue;

    // check each boundary at this position
    for (const b of boundaries) {
      if (lower.startsWith(b, i)) return i;
    }
  }

  return -1;
}

function parseColumnLine(lineRaw) {
  // Returns { name, typeText, isNullable, hasServerDefault } or null if not a column line.
  let line = lineRaw.trim();
  if (!line) return null;

  // Remove trailing comma
  line = line.replace(/,\s*$/, "");

  // Skip table constraints
  if (/^(CONSTRAINT|PRIMARY KEY|UNIQUE)\b/i.test(line)) return null;

  // Column name can be quoted or unquoted
  let name = "";
  let rest = "";

  if (line.startsWith('"')) {
    const end = line.indexOf('"', 1);
    if (end === -1) return null;
    name = line.slice(1, end);
    rest = line.slice(end + 1).trim();
  } else {
    const m = line.match(/^([a-zA-Z0-9_]+)\s+([\s\S]+)$/);
    if (!m) return null;
    name = m[1];
    rest = m[2].trim();
  }

  // Type portion ends before constraints/defaults outside parentheses
  const boundary = findBoundaryIndex(" " + rest); // prefix space to align boundary patterns
  const typePart = boundary === -1 ? rest : (" " + rest).slice(1, boundary).trim();
  const afterType = boundary === -1 ? "" : (" " + rest).slice(boundary).trim();

  // Nullable detection: explicit NOT NULL => not nullable; else nullable in Postgres
  const isNotNull = /\bNOT NULL\b/i.test(afterType) || /\bNOT NULL\b/i.test(rest);
  const isNullable = !isNotNull;

  // Server default: DEFAULT, IDENTITY, GENERATED, SERIAL types
  const hasDefault =
    /\bDEFAULT\b/i.test(rest) ||
    /\bGENERATED\b/i.test(rest) ||
    /\bIDENTITY\b/i.test(rest) ||
    /\bserial\b/i.test(typePart);

  return {
    name,
    typeText: typePart,
    isNullable,
    hasServerDefault: hasDefault,
  };
}

function normalizeTypeName(typeText) {
  // Normalize things like:
  // - character varying(255) -> character varying
  // - numeric(10,2) -> numeric
  // - public.my_enum -> my_enum
  // - timestamp with time zone -> timestamp with time zone (keep)
  const t = typeText.trim().replace(/\s{2,}/g, " ");

  // Remove length/precision parentheses if they are immediately after the base type
  const noParens = t.replace(/\([^\)]*\)/g, "");

  // Strip schema qualifier on types (public.enumname)
  return noParens.replace(/^public\./i, "").trim();
}

function mapBaseTypeToTs(baseLower, enumValues) {
  if (enumValues.has(baseLower)) {
    return `Database["public"]["Enums"]["${baseLower}"]`;
  }

  // Common Postgres/Supabase types
  if (
    baseLower === "text" ||
    baseLower === "varchar" ||
    baseLower === "character varying" ||
    baseLower === "character" ||
    baseLower === "bpchar" ||
    baseLower === "citext" ||
    baseLower === "uuid" ||
    baseLower === "date" ||
    baseLower === "time" ||
    baseLower === "timetz" ||
    baseLower === "timestamp" ||
    baseLower === "timestamp without time zone" ||
    baseLower === "timestamp with time zone" ||
    baseLower === "timestamptz" ||
    baseLower === "tsvector" ||
    baseLower === "inet"
  ) {
    return "string";
  }

  if (baseLower === "bool" || baseLower === "boolean") return "boolean";

  if (
    baseLower === "int2" ||
    baseLower === "smallint" ||
    baseLower === "int4" ||
    baseLower === "integer" ||
    baseLower === "int8" ||
    baseLower === "bigint" ||
    baseLower === "real" ||
    baseLower === "float4" ||
    baseLower === "double precision" ||
    baseLower === "float8" ||
    baseLower === "numeric" ||
    baseLower === "decimal" ||
    baseLower === "money"
  ) {
    return "number";
  }

  if (baseLower === "json" || baseLower === "jsonb") return "Json";

  if (baseLower === "bytea") return "string";

  // If it looks like an enum name but case differs, match case-insensitively
  for (const k of enumValues.keys()) {
    if (k.toLowerCase() === baseLower) return `Database["public"]["Enums"]["${k}"]`;
  }

  return "unknown";
}

function mapTypeTextToTs(typeText, enumValues) {
  // Handle arrays: integer[] , text[] , uuid[][] etc.
  let t = normalizeTypeName(typeText);
  let dims = 0;
  while (t.endsWith("[]")) {
    dims++;
    t = t.slice(0, -2).trim();
  }

  const baseLower = t.toLowerCase();
  let ts = mapBaseTypeToTs(baseLower, enumValues);

  for (let i = 0; i < dims; i++) ts = `${ts}[]`;
  return ts;
}

function parseTableColumns(tableBody, enumValues) {
  const columns = [];

  for (const rawLine of tableBody.split(/\r?\n/)) {
    const parsed = parseColumnLine(rawLine);
    if (!parsed) continue;

    columns.push({
      name: parsed.name,
      tsType: mapTypeTextToTs(parsed.typeText, enumValues),
      isNullable: parsed.isNullable,
      hasServerDefault: parsed.hasServerDefault,
    });
  }

  return columns;
}

(function main() {
  const schemaPath = resolveSchemaPath();
  const rawSchemaSql = fs.readFileSync(schemaPath, "utf8");

  const enumValues = extractPublicEnums(rawSchemaSql);
  const { tableNames, tableBodies } = extractPublicTables(rawSchemaSql);

  // Relationships
  const fkDefs = [];
  for (const t of tableNames) {
    const body = tableBodies.get(t) || "";
    fkDefs.push(...extractForeignKeysFromTableBody(t, body));
  }
  const relsByTableName = new Map();
  for (const rel of fkDefs) {
    const list = relsByTableName.get(rel.table) || [];
    list.push(rel);
    relsByTableName.set(rel.table, list);
  }

  // Generate TS
  const lines = [];
  lines.push(
    'export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];'
  );
  lines.push("");
  lines.push("export interface Database {");
  lines.push("  public: {");
  lines.push("    Tables: {");

  for (const tableName of tableNames) {
    const body = tableBodies.get(tableName);
    if (!body) continue;

    const cols = parseTableColumns(body, enumValues);
    const relsForTable = relsByTableName.get(tableName) || [];

    lines.push(`      ${formatKey(tableName)}: {`);

    // Row
    lines.push("        Row: {");
    for (const c of cols) {
      const t = c.isNullable ? `${c.tsType} | null` : c.tsType;
      lines.push(`          ${formatKey(c.name)}: ${t};`);
    }
    lines.push("        };");

    // Insert
    lines.push("        Insert: {");
    for (const c of cols) {
      const t = c.isNullable ? `${c.tsType} | null` : c.tsType;
      const optional = c.isNullable || c.hasServerDefault;
      lines.push(`          ${formatKey(c.name)}${optional ? "?:" : ":"} ${t};`);
    }
    lines.push("        };");

    // Update
    lines.push("        Update: {");
    for (const c of cols) {
      const t = c.isNullable ? `${c.tsType} | null` : c.tsType;
      lines.push(`          ${formatKey(c.name)}?: ${t};`);
    }
    lines.push("        };");

    // Relationships
    lines.push("        Relationships: [");
    if (relsForTable.length) {
      for (const rel of relsForTable) {
        lines.push("          {");
        lines.push(`            foreignKeyName: "${rel.constraintName}";`);
        lines.push(`            columns: [${rel.columns.map((x) => `"${x}"`).join(", ")}];`);
        lines.push(`            referencedRelation: "${rel.referencedRelation}";`);
        lines.push(
          `            referencedColumns: [${rel.referencedColumns.map((x) => `"${x}"`).join(", ")}];`
        );
        lines.push("          },");
      }
      // remove trailing comma from last relationship
      const last = lines.pop();
      lines.push(last ? last.replace(/,$/, "") : "");
    }
    lines.push("        ];");

    lines.push("      };");
  }

  lines.push("    };");
  lines.push("    Views: {");
  lines.push("      [_ in never]: never;");
  lines.push("    };");
  lines.push("    Functions: {");
  lines.push("      [_ in never]: never;");
  lines.push("    };");

  lines.push("    Enums: {");
  if (enumValues.size === 0) {
    lines.push("      [_ in never]: never;");
  } else {
    for (const [name, values] of enumValues.entries()) {
      lines.push(`      ${formatKey(name)}: ${values.map((v) => `'${v}'`).join(" | ")};`);
    }
  }
  lines.push("    };");

  lines.push("    CompositeTypes: {");
  lines.push("      [_ in never]: never;");
  lines.push("    };");
  lines.push("  };");
  lines.push("}");

  const outPath = path.join(__dirname, "..", "src", "types", "supabase.ts");
  fs.writeFileSync(outPath, `${lines.join("\n")}\n`);

  const relOut = path.relative(path.join(__dirname, ".."), outPath);
  const schemaRel = path.relative(path.join(__dirname, ".."), schemaPath);
  console.log(`✅ Generated Supabase types -> ${relOut}`);
  console.log(`📄 Schema used -> ${schemaRel}`);
})();
