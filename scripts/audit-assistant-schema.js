const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SCHEMA_DIR = path.join(PROJECT_ROOT, "supabase", "schema");
const FUNCTIONS_DIR = path.join(PROJECT_ROOT, "supabase", "functions");
const ASSISTANT_CLIENT_DIRS = [
  path.join(PROJECT_ROOT, "src", "modules", "assistant"),
  path.join(PROJECT_ROOT, "src", "modules", "settings", "admin"),
];
const REPORT_PATH = path.join(PROJECT_ROOT, "scripts", "audit-assistant-schema.report.json");

function listSchemaFiles() {
  return fs
    .readdirSync(SCHEMA_DIR)
    .filter((file) => file.startsWith("schema_full_") && file.endsWith(".sql"))
    .sort();
}

function parseSchema(schemaPath) {
  const content = fs.readFileSync(schemaPath, "utf8");
  const lines = content.split(/\r?\n/);
  const tables = new Map();
  const enums = new Map();
  const functions = new Map();

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();

    if (line.startsWith("CREATE TYPE") && line.includes("ENUM")) {
      const match = line.match(/CREATE TYPE\s+([^\s]+)\s+AS ENUM/i);
      if (match) {
        const enumName = normalizeIdentifier(match[1]);
        const enumValuesLine = line.includes("(") ? line : lines[i + 1]?.trim() ?? "";
        const enumValuesMatch = enumValuesLine.match(/\(([^)]+)\)/);
        if (enumValuesMatch) {
          const values = enumValuesMatch[1]
            .split(",")
            .map((value) => value.trim().replace(/^'/, "").replace(/'$/, ""))
            .filter(Boolean);
          enums.set(enumName, new Set(values));
        } else {
          enums.set(enumName, new Set());
        }
      }
    }

    if (line.startsWith("CREATE TABLE")) {
      const match = line.match(/CREATE TABLE\s+([^\s(]+)\s*\(/i);
      if (!match) continue;
      const { schema, table } = parseQualifiedName(match[1]);
      const tableName = `${schema}.${table}`;
      const columns = new Set();
      let j = i + 1;
      for (; j < lines.length; j += 1) {
        const columnLine = lines[j].trim();
        if (columnLine.startsWith(")")) break;
        if (columnLine.startsWith("CONSTRAINT") || columnLine.startsWith("PRIMARY") || columnLine.startsWith("UNIQUE")) {
          continue;
        }
        const columnMatch = columnLine.match(/^"?([a-zA-Z0-9_]+)"?\s+/);
        if (columnMatch) {
          columns.add(columnMatch[1]);
        }
      }
      tables.set(tableName, columns);
      i = j;
      continue;
    }

    if (line.startsWith("CREATE FUNCTION") || line.startsWith("CREATE OR REPLACE FUNCTION")) {
      const nameMatch = line.match(/FUNCTION\s+([^\s(]+)\s*\(/i);
      if (!nameMatch) continue;
      const { schema, table: fn } = parseQualifiedName(nameMatch[1]);
      let signature = line.slice(line.indexOf("(") + 1);
      while (!signature.includes(")") && i < lines.length - 1) {
        i += 1;
        signature += lines[i];
      }
      signature = signature.slice(0, signature.indexOf(")"));
      const argNames = signature
        .split(",")
        .map((arg) => arg.trim())
        .filter(Boolean)
        .map((arg) => {
          const parts = arg.split(/\s+/);
          return parts[0].replace(/"/g, "");
        })
        .filter(Boolean);
      const argSet = new Set(argNames);
      const qualified = `${schema}.${fn}`;
      functions.set(qualified, argSet);
      if (schema === "public") {
        functions.set(fn, argSet);
      }
    }
  }

  return { tables, enums, functions };
}

function normalizeIdentifier(name) {
  return name.replace(/"/g, "");
}

function parseQualifiedName(name) {
  const cleaned = normalizeIdentifier(name);
  const parts = cleaned.split(".");
  if (parts.length >= 2) {
    return { schema: parts[parts.length - 2], table: parts[parts.length - 1] };
  }
  return { schema: "public", table: cleaned };
}

function getTableColumns(schema, table) {
  const cleaned = normalizeIdentifier(table);
  if (cleaned.includes(".")) {
    return schema.tables.get(cleaned);
  }
  return schema.tables.get(`public.${cleaned}`) ?? null;
}

function listFiles(dir, extensions) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(entryPath, extensions));
    } else if (extensions.includes(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }
  return files;
}

function splitSelectColumns(select) {
  const cols = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < select.length; i += 1) {
    const char = select[i];
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      cols.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) cols.push(current.trim());
  return cols;
}

function extractSelectColumns(select, baseTable) {
  const columnsByTable = [];
  const parts = splitSelectColumns(select);
  for (const part of parts) {
    if (!part || part === "*") continue;
    const joinMatch = part.match(/([a-zA-Z0-9_]+)!.*\((.+)\)/);
    if (joinMatch) {
      const joinTable = joinMatch[1];
      const joinColumns = splitSelectColumns(joinMatch[2]).map((col) => normalizeColumnName(col));
      columnsByTable.push({ table: joinTable, columns: joinColumns });
      continue;
    }
    const column = normalizeColumnName(part);
    if (column) {
      columnsByTable.push({ table: baseTable, columns: [column] });
    }
  }
  return columnsByTable;
}

function normalizeColumnName(raw) {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "*") return null;
  if (trimmed.includes("(")) return null;
  if (trimmed.includes("->")) return null;
  const withoutCast = trimmed.split("::")[0];
  const withoutAlias = withoutCast.split(/\s+as\s+/i)[0];
  const colonParts = withoutAlias.split(":");
  const last = colonParts[colonParts.length - 1];
  const dotParts = last.split(".");
  return dotParts[dotParts.length - 1].trim();
}

function extractObjectKeys(value) {
  const keys = new Set();
  let depth = 0;
  let inString = false;
  let stringChar = "";
  let current = "";
  const flush = () => {
    const match = current.match(/\b([a-zA-Z0-9_]+)\s*:\s*$/);
    if (match) keys.add(match[1]);
    current = "";
  };
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (inString) {
      if (char === stringChar && value[i - 1] !== "\\") {
        inString = false;
      }
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      inString = true;
      stringChar = char;
      continue;
    }
    if (char === "{") {
      if (depth === 0) {
        current = "";
      }
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        flush();
      }
      continue;
    }
    if (depth === 1) {
      current += char;
      if (char === ",") {
        flush();
      }
    }
  }
  flush();
  return Array.from(keys);
}

function scanFile(filePath, schema) {
  const content = fs.readFileSync(filePath, "utf8");
  const mismatches = [];

  const fromRegex = /\.from\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
  const fromMatches = [];
  let match;
  while ((match = fromRegex.exec(content))) {
    const table = match[1];
    fromMatches.push({ table, start: match.index, end: fromRegex.lastIndex });
    if (!getTableColumns(schema, table)) {
      mismatches.push({ type: "missing_table", table, file: filePath });
    }
  }

  for (let i = 0; i < fromMatches.length; i += 1) {
    const current = fromMatches[i];
    const next = fromMatches[i + 1];
    const segment = content.slice(current.end, next ? next.start : content.length);

    const selectRegex = /\.select\(\s*["'`]([^"'`]+)["'`]/g;
    let selectMatch;
    while ((selectMatch = selectRegex.exec(segment))) {
      const select = selectMatch[1];
      const columnsByTable = extractSelectColumns(select, current.table);
      for (const entry of columnsByTable) {
        const tableColumns = getTableColumns(schema, entry.table);
        if (!tableColumns) {
          mismatches.push({ type: "missing_table", table: entry.table, file: filePath, select });
          continue;
        }
        for (const column of entry.columns) {
          if (!tableColumns.has(column)) {
            mismatches.push({ type: "missing_column", table: entry.table, column, file: filePath, select });
          }
        }
      }
    }

    const writeRegex = /\.(insert|update|upsert)\(\s*(\{[\s\S]*?\})/g;
    let writeMatch;
    while ((writeMatch = writeRegex.exec(segment))) {
      const objectLiteral = writeMatch[2];
      const keys = extractObjectKeys(objectLiteral);
      const tableColumns = getTableColumns(schema, current.table);
      if (!tableColumns) {
        mismatches.push({ type: "missing_table", table: current.table, file: filePath, action: writeMatch[1] });
        continue;
      }
      for (const key of keys) {
        if (!tableColumns.has(key)) {
          mismatches.push({ type: "unknown_payload_key", table: current.table, column: key, file: filePath, action: writeMatch[1] });
        }
      }
    }
  }

  const rpcRegex = /\.rpc\(\s*["'`]([^"'`]+)["'`]\s*(?:,\s*\{([\s\S]*?)\})?/g;
  while ((match = rpcRegex.exec(content))) {
    const fn = match[1];
    const argsLiteral = match[2];
    const fnArgs = schema.functions.get(fn);
    if (!fnArgs) {
      mismatches.push({ type: "rpc_missing", function: fn, file: filePath });
      continue;
    }
    if (argsLiteral) {
      const argKeys = extractObjectKeys(`{${argsLiteral}}`);
      for (const arg of argKeys) {
        if (!fnArgs.has(arg)) {
          mismatches.push({ type: "rpc_args_mismatch", function: fn, arg, file: filePath });
        }
      }
    }
  }

  return mismatches;
}

function scanAssistantTools(schema) {
  const filePath = path.join(FUNCTIONS_DIR, "_shared", "assistantTools.ts");
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf8");
  const mismatches = [];
  const resourceRegex = /table:\s*["'`]([^"'`]+)["'`][\s\S]*?select:\s*["'`]([^"'`]+)["'`]/g;
  let match;
  while ((match = resourceRegex.exec(content))) {
    const table = match[1];
    const select = match[2];
    const columnsByTable = extractSelectColumns(select, table);
    for (const entry of columnsByTable) {
      const tableColumns = getTableColumns(schema, entry.table);
      if (!tableColumns) {
        mismatches.push({ type: "missing_table", table: entry.table, file: filePath, select });
        continue;
      }
      for (const column of entry.columns) {
        if (!tableColumns.has(column)) {
          mismatches.push({ type: "missing_column", table: entry.table, column, file: filePath, select });
        }
      }
    }
  }
  return mismatches;
}

function main() {
  const schemaFiles = listSchemaFiles();
  if (!schemaFiles.length) {
    console.error("No schema_full_*.sql files found.");
    process.exit(1);
  }
  const latestSchema = schemaFiles[schemaFiles.length - 1];
  const schemaPath = path.join(SCHEMA_DIR, latestSchema);
  const schema = parseSchema(schemaPath);

  const files = listFiles(FUNCTIONS_DIR, [".ts", ".tsx", ".js"]);
  for (const dir of ASSISTANT_CLIENT_DIRS) {
    if (fs.existsSync(dir)) {
      files.push(...listFiles(dir, [".ts", ".tsx", ".js"]));
    }
  }
  const mismatches = [];
  for (const file of files) {
    mismatches.push(...scanFile(file, schema));
  }
  mismatches.push(...scanAssistantTools(schema));

  const summary = mismatches.reduce((acc, issue) => {
    acc[issue.type] = (acc[issue.type] ?? 0) + 1;
    return acc;
  }, {});

  const report = {
    schema: latestSchema,
    mismatchCount: mismatches.length,
    summary,
    mismatches,
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  const summaryLines = Object.entries(summary)
    .map(([type, count]) => `- ${type}: ${count}`)
    .join("\n");
  console.log(`Schema: ${latestSchema}`);
  console.log(`Mismatches: ${mismatches.length}`);
  if (summaryLines) {
    console.log(summaryLines);
  }
  if (mismatches.length) {
    console.log(`Report written to ${path.relative(PROJECT_ROOT, REPORT_PATH)}`);
  }
}

main();
