#!/usr/bin/env node
/**
 * Local development: the whole Sales Engine is this Next.js app.
 * Ready to Contract lives at /guided-selling and /api/contract.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...process.env };
for (const file of [".env", ".env.local"]) {
  const p = path.join(root, file);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m || line.trim().startsWith("#")) continue;
    if (!(m[1] in process.env)) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(npx, ["next", "dev"], { cwd: root, env, stdio: "inherit" });
const shutdown = () => {
  if (!child.killed) child.kill("SIGTERM");
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
child.on("exit", (code) => process.exit(code ?? 0));
