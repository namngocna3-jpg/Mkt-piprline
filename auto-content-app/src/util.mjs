// Tien ich dung chung: chay tien trinh con (CLI), timeout, log.
import { spawn } from "node:child_process";

export const log = (...a) => console.log(`[${new Date().toISOString()}]`, ...a);

/** Chay 1 lenh CLI, tra ve {stdout, stderr}. Reject neu exit code != 0 hoac timeout. */
export function run(cmd, args, { cwd, env, timeoutMs = 0, input } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env } });
    let stdout = "";
    let stderr = "";
    let timer;
    if (timeoutMs) {
      timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`Timeout ${timeoutMs}ms: ${cmd} ${args.join(" ")}`));
      }, timeoutMs);
    }
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (e) => {
      if (timer) clearTimeout(timer);
      reject(new Error(`Khong chay duoc '${cmd}': ${e.message} (da cai chua? co trong PATH chua?)`));
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr, code });
      else reject(new Error(`${cmd} thoat code ${code}: ${(stderr || stdout).slice(0, 500)}`));
    });
    if (input) child.stdin.end(input);
  });
}

/** Boc 1 promise voi timeout. */
export function withTimeout(promise, ms, label = "op") {
  if (!ms) return promise;
  let timer;
  const t = new Promise((_, rej) => {
    timer = setTimeout(() => rej(new Error(`${label} timeout ${ms}ms`)), ms);
  });
  return Promise.race([promise.finally(() => clearTimeout(timer)), t]);
}

/** Tim 1 id (uuid hoac chuoi dai) trong output CLI. Best-effort, chinh lai theo version neu can. */
export function parseId(text) {
  const uuid = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuid) return uuid[0];
  const labeled = text.match(/(?:notebook|artifact|id)[^\w]{0,3}([\w-]{8,})/i);
  return labeled ? labeled[1] : null;
}
