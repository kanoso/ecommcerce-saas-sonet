#!/usr/bin/env node
// OpenBao launcher: loads the Agent-rendered private JSON, validates every key
// against an explicit allowlist mapping, and spawns the real process with the
// mapped variables inherited only by the child. Never prints values.
//
// Usage:
//   node openbao-launcher.mjs --mapping mappings/tiendi-api.json [--check-only] [--strict] -- <command> [args...]
//
// Fail-closed contract (guide section 6):
// - Rendered file missing / invalid JSON -> exit 2 (redacted error: file + reason only)
// - Any required key missing            -> exit 3 (lists KEY NAMES only)
// - Any rendered key not in the mapping -> exit 4 (unexpected secret must fail, not leak)
// - No silent fallback to .env: with --strict, a .env file in cwd aborts unless --allow-env-file

import { readFileSync, existsSync, statSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

function fail(code, msg) {
  console.error(`[openbao-launcher] ${msg}`);
  process.exit(code);
}

const argv = process.argv.slice(2);
const checkOnly = argv.includes("--check-only");
const strictNoEnv = argv.includes("--strict");
const mi = argv.indexOf("--mapping");
if (mi === -1 || !argv[mi + 1]) fail(2, "missing --mapping <file>");
const mappingPath = resolve(argv[mi + 1]);
const sepIdx = argv.indexOf("--");
const childCmd = checkOnly ? null : argv.slice(sepIdx + 1);
if (!checkOnly && (!childCmd || childCmd.length === 0)) fail(2, "missing child command after --");

let mapping;
try {
  mapping = JSON.parse(readFileSync(mappingPath, "utf8"));
} catch {
  fail(2, `mapping unreadable/invalid: ${mappingPath}`);
}

const app = mapping.app ?? "unknown-app";
// OPENBAO_RENDER_DIR (if set) always points to the PARENT renders directory;
// the launcher appends the app segment. mapping.renderDir overrides fully.
const renderBase = resolve(
  mapping.renderDir ??
    join(process.env.OPENBAO_RENDER_DIR ?? join(homedir(), ".openbao-dev", "render"), app),
);

function get(obj, dotted) {
  return dotted.split(".").reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
}

// Strict single-origin rule: in OpenBao mode an existing .env in the app cwd is
// an unauthorized second source unless explicitly allowed for the transition.
if (strictNoEnv && existsSync(join(process.cwd(), ".env")) && !argv.includes("--allow-env-file")) {
  fail(4, "strict mode: .env present in working directory (single-origin rule). Remove/rename it or pass --allow-env-file for the documented transition window.");
}

// Availability policy at startup (guide section 6): if OpenBao is down but the
// rendered file exists from a previous render, it must not be trusted forever.
// Freshness is measured against the agent's HEARTBEAT file (mapping.heartbeat):
// its content changes every render cycle, so its mtime proves the agent is
// still alive and fetching. Default maximum age 3600s (mapping.maxAgeSeconds or
// --max-age <seconds>; 0 disables the check).
const maxAge = (() => {
  const mai = argv.indexOf("--max-age");
  if (mai !== -1 && argv[mai + 1]) return Number(argv[mai + 1]);
  return mapping.maxAgeSeconds ?? 3600;
})();

// Load and validate rendered files.
const rendered = {};
for (const [name, file] of Object.entries(mapping.files ?? {})) {
  const p = join(renderBase, file);
  let raw;
  try {
    raw = readFileSync(p, "utf8");
  } catch {
    fail(2, `rendered secret file not found: ${p} (agent not rendering yet? OpenBao sealed?)`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail(2, `rendered file is not valid JSON: ${p}`);
  }
  rendered[name] = parsed;
}

// Freshness via agent heartbeat (its content changes every render cycle).
if (maxAge > 0 && mapping.heartbeat) {
  const hbPath = join(renderBase, mapping.heartbeat);
  let st;
  try {
    st = statSync(hbPath);
  } catch {
    fail(2, `agent heartbeat not found: ${hbPath} (agent running? OpenBao reachable?)`);
  }
  const ageSec = (Date.now() - st.mtimeMs) / 1000;
  if (ageSec > maxAge) {
    fail(2, `agent heartbeat is stale (${Math.round(ageSec)}s > ${maxAge}s): OpenBao unreachable or agent stopped`);
  }
}

// Resolve mapped env vars; collect missing and unexpected keys (names only).
// Optional keys (e.g. not-yet-enabled integrations) are tolerated when absent:
// the env var is simply not set and the app runs with that integration disabled.
const envVars = {};
const missing = [];
const unexpected = [];
const optional = new Set(mapping.optional ?? []);

for (const [envName, ref] of Object.entries(mapping.env ?? {})) {
  const value = get(rendered, ref.join("."));
  if (value === undefined || value === null || value === "") {
    if (optional.has(envName)) continue;
    missing.push(envName);
  } else {
    envVars[envName] = String(value);
  }
}

const mappedRefs = new Set(Object.values(mapping.env ?? {}).map((r) => r.join(".")));
for (const [file, obj] of Object.entries(rendered)) {
  const walk = (node, prefix) => {
    for (const [k, v] of Object.entries(node ?? {})) {
      const path = `${prefix}.${k}`;
      if (v && typeof v === "object") walk(v, path);
      else if (!mappedRefs.has(path) && !mapping.nonSecretKeys?.includes(path)) {
        unexpected.push(`${file}:${path}`);
      }
    }
  };
  walk(obj, file);
}

if (missing.length > 0) {
  fail(3, `missing required secrets (names only): ${missing.join(", ")}`);
}
if (unexpected.length > 0) {
  fail(4, `unexpected keys present in rendered file (fail-closed, names only): ${unexpected.join(", ")}`);
}
const missingRequired = (mapping.required ?? []).filter((k) => envVars[k] === undefined);
if (missingRequired.length > 0) {
  fail(3, `mapping-required env not present (names only): ${missingRequired.join(", ")}`);
}

if (checkOnly) {
  console.log(
    `[openbao-launcher] check-only OK for app=${app}: ${Object.keys(envVars).length} keys validated (values ${"[redacted]"}).`,
  );
  process.exit(0);
}

const child = spawn(childCmd[0], childCmd.slice(1), {
  env: { ...process.env, ...envVars },
  stdio: "inherit",
  shell: process.platform === "win32",
});

// Forward process-manager signals (PM2 stop/restart, Ctrl+C) to the child so
// no orphaned app process survives the launcher (secrets must not outlive it).
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) {
  process.on(sig, () => {
    if (!child.killed) child.kill(sig === "SIGBREAK" ? "SIGINT" : sig);
    process.exit(1);
  });
}

child.on("error", (err) => fail(2, `failed to start child process: ${err.message}`));
child.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});