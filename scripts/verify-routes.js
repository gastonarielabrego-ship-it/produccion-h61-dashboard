#!/usr/bin/env node
/**
 * verify-routes.js — Guardián de integridad de rutas API
 * ─────────────────────────────────────────────────────────
 * Problema que previene: una ruta API referenciada por la UI se borra del
 * repo (ej. /api/admin/upload borrada accidentalmente en commit 50ee55c) y
 * el botón de carga queda muerto en producción con un 404 silencioso.
 *
 * Qué hace:
 *   1. Escanea todo src/ buscando literales "/api/..." en fetch, constantes
 *      y template strings.
 *   2. Resuelve cada literal contra el filesystem de src/app/api soportando
 *      segmentos dinámicos [x] y catch-all [...x].
 *   3. Falla (exit 1) si alguna ruta referenciada no existe → el build se
 *      corta ANTES de deployar un botón roto.
 *
 * Uso: node scripts/verify-routes.js   (integrado como parte de `npm run build`)
 */

const fs = require("fs");
const path = require("path");

const SRC_DIR = path.join(__dirname, "..", "src");
const API_DIR = path.join(SRC_DIR, "app", "api");

// ─── 1. Recolectar archivos .ts/.tsx de src/ ───
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

// ─── 2. Extraer literales /api/... del código fuente ───
// Captura la parte literal de: fetch("/api/x"), fetch(`/api/x${var}`),
// const API = "/api/production", useProductionFilters("/api/clarkistas"), etc.
function extractApiPaths(files) {
  const paths = new Map(); // path -> [archivo:linea]
  const RE = /["'`](\/api\/[A-Za-z0-9_\-\/]+)/g;
  for (const file of files) {
    const rel = path.relative(path.join(__dirname, ".."), file);
    // No escanear las propias rutas (route.ts) ni node_modules
    if (file.endsWith("route.ts")) continue;
    const text = fs.readFileSync(file, "utf8");
    let m;
    while ((m = RE.exec(text)) !== null) {
      const clean = m[1].replace(/\/+$/, "") || "/api";
      if (!paths.has(clean)) paths.set(clean, []);
      paths.get(clean).push(`${rel}:${text.slice(0, m.index).split("\n").length}`);
    }
  }
  return paths;
}

// ─── 3. Resolver un path contra el árbol src/app/api ───
function routeExistsAt(dir) {
  return fs.existsSync(path.join(dir, "route.ts"));
}

function hasChildRoutes(dir) {
  if (!fs.existsSync(dir)) return false;
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .some(
      (e) =>
        e.isDirectory() &&
        (routeExistsAt(path.join(dir, e.name)) ||
          hasChildRoutes(path.join(dir, e.name)))
    );
}

function resolveApiPath(apiPath) {
  const segments = apiPath.split("/").filter(Boolean).slice(1); // quita "api"
  let dir = API_DIR;

  // /api raíz tiene route.ts propio
  if (segments.length === 0) return routeExistsAt(dir) ? { ok: true, kind: "exact" } : { ok: false };

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!fs.existsSync(dir)) return { ok: false };
    const children = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory());

    // catch-all [...slug] consume el resto
    const catchAll = children.find((c) => /^\[\.\.\..+\]$/.test(c.name));
    if (catchAll) {
      return routeExistsAt(path.join(dir, catchAll.name))
        ? { ok: true, kind: "catch-all" }
        : { ok: false };
    }

    const exact = children.find((c) => c.name === seg);
    if (exact) {
      dir = path.join(dir, exact.name);
      continue;
    }
    const dynamic = children.find((c) => /^\[\w+\]$/.test(c.name));
    if (dynamic) {
      dir = path.join(dir, dynamic.name);
      continue;
    }
    return { ok: false };
  }

  if (routeExistsAt(dir)) return { ok: true, kind: "exact" };
  // Es una base (ej. /api/production, /api/clarkistas): tiene sub-rutas
  if (hasChildRoutes(dir)) return { ok: true, kind: "base" };
  return { ok: false };
}

// ─── 4. Main ───
const files = walk(SRC_DIR);
const refs = extractApiPaths(files);
const missing = [];
const found = [];

for (const [apiPath, locations] of [...refs].sort()) {
  const res = resolveApiPath(apiPath);
  if (res.ok) {
    found.push({ apiPath, kind: res.kind, locations });
  } else {
    missing.push({ apiPath, locations });
  }
}

console.log("\n🔍 Verificación de rutas API (frontend → src/app/api)\n");
for (const f of found) {
  console.log(
    `  ✅ ${f.apiPath.padEnd(45)} (${f.kind}) — ${f.locations.length} ref.`
  );
}
if (missing.length > 0) {
  console.log("\n──────────────────────────────────────────────");
  console.log("❌ RUTAS FALTANTES — el build se detiene:\n");
  for (const m of missing) {
    console.log(`  ❌ ${m.apiPath}`);
    for (const loc of m.locations.slice(0, 5)) console.log(`       ↳ usado en ${loc}`);
  }
  console.log(
    "\n  Los botones que apuntan a estas rutas devolverían 404 en producción.\n" +
      "  Restaurá la ruta o corregí la URL en el frontend antes de deployar.\n"
  );
  process.exit(1);
}
console.log(
  `\n✅ ${found.length} rutas verificadas — todas existen. Los botones de carga no quedarán huérfanos.\n`
);
