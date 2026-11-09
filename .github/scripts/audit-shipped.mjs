// Fails on high/critical advisories in packages that actually ship to players:
// the API server bundle, the web game, and the shared libs they import.
// The Expo mobile app's build tooling (expo-cli etc.) runs only on build
// machines, so its advisories are reported but don't block a deploy.
//
// Usage (repo root): node .github/scripts/audit-shipped.mjs
import { execSync } from "node:child_process";

const SHIPPED = /^(artifacts__api-server|artifacts__game-lobby|lib__db|lib__api-zod)>/;
const BLOCKING = new Set(["high", "critical"]);

// Reviewed and accepted. Each entry says why it can't be exploited here.
const ACCEPTED = {
  // Zod memory exhaustion on oversized collections. The server only uses zod to
  // shape its own health response, and the web app only for its own forms, so
  // no untrusted large collection ever reaches zod. Fix needs zod 4 + a form
  // library upgrade; revisit when doing that.
  "GHSA-mrhx-c7xc-m3w5": "zod: never validates untrusted collections",
};

const pnpm = process.env.PNPM ?? "pnpm";
let raw;
try {
  raw = execSync(`${pnpm} audit --prod --json`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
} catch (err) {
  // pnpm audit exits non-zero when it finds anything; the JSON is still on stdout.
  raw = err.stdout;
}
if (!raw) {
  console.error("pnpm audit produced no output (registry unreachable?)");
  process.exit(2);
}

const report = JSON.parse(raw);
const blocking = [];
const info = [];
for (const adv of Object.values(report.advisories ?? {})) {
  const paths = (adv.findings ?? []).flatMap((f) => f.paths);
  const shippedPaths = paths.filter((p) => SHIPPED.test(p));
  const line = `${adv.severity.padEnd(8)} ${adv.module_name}@${adv.vulnerable_versions} (fix: ${adv.patched_versions}) ${adv.github_advisory_id} ${adv.title}`;
  if (!shippedPaths.length) {
    info.push(line);
    continue;
  }
  if (ACCEPTED[adv.github_advisory_id]) {
    console.log(`accepted ${line}\n         reason: ${ACCEPTED[adv.github_advisory_id]}`);
    continue;
  }
  if (BLOCKING.has(adv.severity)) blocking.push(`${line}\n         via ${shippedPaths[0]}`);
  else console.log(`warn     ${line}`);
}

if (info.length) console.log(`\n${info.length} advisories in build-only tooling (not shipped):\n  ${info.join("\n  ")}`);

if (blocking.length) {
  console.error(`\n${blocking.length} high/critical advisories in shipped code:\n${blocking.join("\n")}`);
  console.error("\nUpgrade the package (or add a pnpm override in pnpm-workspace.yaml) before deploying.");
  process.exit(1);
}
console.log("\nOK: no high/critical advisories in shipped code.");
