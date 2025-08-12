/**
 * brute‑force timing helper for Ruuvi Gateway – RANDOM BEARER EDITION
 *
 * Usage (Node ≥ 18):
 *   export RUUVI_IP=192.168.0.10            # gateway IP  (or --ip)
 *   node en18031_gateway_aum6.js --runners=10 --attempts=100
 *
 * Options:
 *   --ip=<addr>       – gateway IP / host name   (required or env RUUVI_IP)
 *   --runners=<n>     – parallel “threads”       (default 10)
 *   --attempts=<n>    – requests per runner      (default 100)
 *   --body=<file>     – JSON body file           (default ruuvi.json)
 */

import { readFile } from "node:fs/promises";
import { argv, env } from "node:process";
import { performance } from "node:perf_hooks";
import { randomBytes } from "node:crypto";
import http from "node:http";

// Create agents that don't reuse sockets (forces concurrency)
const agent = new http.Agent({ keepAlive: false });

// ---------- CLI helper ----------
function parseArgs() {
  const cfg = {
    ip: env.RUUVI_IP ?? "",
    runners: 10,
    attempts: 100,
    bodyFile: "en18031_gateway_aum6.json",
  };
  for (let i = 2; i < argv.length; i++) {
    const [flag, value] = argv[i].split("=");
    switch (flag) {
      case "--ip":
        cfg.ip = value;
        break;
      case "--runners":
        cfg.runners = Number(value);
        break;
      case "--attempts":
        cfg.attempts = Number(value);
        break;
      case "--body":
        cfg.bodyFile = value;
        break;
      default:
        console.error(`Unknown flag ${flag}`);
        process.exit(1);
    }
  }
  if (!cfg.ip) {
    console.error("❌  IP/hostname is required (set env RUUVI_IP or --ip).");
    process.exit(1);
  }
  return cfg;
}

// ---------- random bearer generator ----------
const randomBearer = () => randomBytes(32).toString("base64"); // ~43‑char base64

// ---------- main work ----------
const { ip, runners: RUNNERS, attempts: ATTEMPTS, bodyFile } = parseArgs();
const requestBody = await readFile(new URL(`./${bodyFile}`, import.meta.url), "utf8");

async function singleAttempt() {
  const res = await fetch(`http://${ip}/ruuvi.json`, {
    method: "POST",
    agent: agent,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${randomBearer()}`,
    },
    body: requestBody,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

async function runner(id) {
  for (let i = 0; i < ATTEMPTS; i++) {
    try {
      await singleAttempt();
    } catch (e) {
      console.warn(`[${new Date().toISOString()}] Runner ${id} attempt ${i} failed: ${e.message}`);
    }
  }
}

(async () => {
  console.log(
    `Brute‑force test: ${RUNNERS} runners × ${ATTEMPTS} req = ${
      RUNNERS * ATTEMPTS
    } random tokens…`
  );
  const t0 = performance.now();
  await Promise.all(Array.from({ length: RUNNERS }, (_, i) => runner(i)));
  const secs = ((performance.now() - t0) / 1000).toFixed(3);
  console.log(`✅  Finished in ${secs}s`);
})();
