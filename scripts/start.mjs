#!/usr/bin/env node
/**
 * Production entrypoint: Next.js only. Ready to Contract is served from this
 * process at /guided-selling and /api/contract.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = process.env.PORT ?? "3000";
const nextBin = path.join(root, "node_modules", ".bin", "next");
const child = spawn(nextBin, ["start", "--port", PORT, "--hostname", "0.0.0.0"], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});
const shutdown = () => {
  if (!child.killed) child.kill("SIGTERM");
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
child.on("exit", (code) => process.exit(code ?? 0));
