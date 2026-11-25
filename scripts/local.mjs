// One command for local development: npm run local
// 1. Creates or completes server/.env (never overwrites values).
// 2. Starts MongoDB on port 27018 as replica set rs0 (data in .local/mongo) unless it is running.
// 3. Starts the API (port 3001) and the website (port 5173). Ctrl+C stops everything it started.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { createConnection } from "node:net";
import { networkInterfaces } from "node:os";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const PORT = 27018;
const children = [];
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

const open = (port) =>
  new Promise((done) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => (socket.end(), done(true)));
    socket.once("error", () => done(false));
  });
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

function findMongod() {
  if (process.env.MONGOD_PATH && existsSync(process.env.MONGOD_PATH))
    return process.env.MONGOD_PATH;
  const base = "C:\\Program Files\\MongoDB\\Server";
  if (process.platform === "win32" && existsSync(base)) {
    const versions = readdirSync(base).sort((a, b) => parseFloat(b) - parseFloat(a));
    for (const v of versions) {
      const exe = join(base, v, "bin", "mongod.exe");
      if (existsSync(exe)) return exe;
    }
  }
  return "mongod"; // on PATH
}

function run(name, command, args, options = {}) {
  // stdin is ignored: `tsx watch` waits on an open stdin pipe and never starts.
  // Windows runs npm through cmd, so its fixed arguments are joined into one command line.
  const viaShell = process.platform === "win32" && command.endsWith(".cmd");
  const child = viaShell
    ? spawn([command, ...args].join(" "), {
        cwd: root,
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
        ...options,
      })
    : spawn(command, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"], ...options });
  const prefix = `[${name}] `;
  for (const stream of [child.stdout, child.stderr])
    stream?.on("data", (chunk) =>
      process.stdout.write(
        chunk
          .toString()
          .split(/\r?\n/)
          .filter(Boolean)
          .map((line) => prefix + line + "\n")
          .join(""),
      ),
    );
  child.on("exit", (code) => {
    if (!stopping) {
      console.log(`${prefix}stopped (exit ${code}). Stopping the rest.`);
      stop(code ?? 1);
    }
  });
  children.push(child);
  return child;
}

let stopping = false;
function stop(code = 0) {
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    if (process.platform === "win32")
      spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    else child.kill("SIGINT");
  }
  process.exit(code);
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

async function ensureReplicaSet() {
  const require = createRequire(join(root, "server", "package.json"));
  const mongoose = require("mongoose");
  const client = await mongoose
    .createConnection(`mongodb://127.0.0.1:${PORT}/?directConnection=true`, {
      serverSelectionTimeoutMS: 5000,
    })
    .asPromise();
  try {
    const admin = client.db.admin();
    const hello = await admin.command({ hello: 1 });
    if (!hello.setName) {
      console.log("[setup] Creating replica set rs0 (first run only)");
      await admin.command({
        replSetInitiate: { _id: "rs0", members: [{ _id: 0, host: `localhost:${PORT}` }] },
      });
    }
    for (let i = 0; i < 30; i++) {
      if ((await admin.command({ hello: 1 })).isWritablePrimary) return;
      await wait(1000);
    }
    throw new Error("MongoDB did not become ready");
  } finally {
    await client.close();
  }
}

// 1. Environment
spawnSync(process.execPath, [join(root, "server", "scripts", "setup-env.mjs")], {
  stdio: "inherit",
});

// 2. Database
if (await open(PORT)) console.log(`[setup] MongoDB already running on port ${PORT}`);
else {
  const data = join(root, ".local", "mongo");
  mkdirSync(data, { recursive: true });
  run("db", findMongod(), [
    "--dbpath",
    data,
    "--replSet",
    "rs0",
    "--bind_ip",
    "localhost",
    "--port",
    String(PORT),
    "--quiet",
  ]);
  for (let i = 0; i < 30 && !(await open(PORT)); i++) await wait(1000);
  if (!(await open(PORT))) {
    console.error("[setup] MongoDB did not start. Install MongoDB 8 or set MONGOD_PATH.");
    stop(1);
  }
}
await ensureReplicaSet();

// 3. API and website
for (const [name, port] of [
  ["api", 3001],
  ["web", 5173],
])
  if (await open(port)) {
    console.error(`[setup] Port ${port} is already in use. Close the other ${name} window first.`);
    stop(1);
  }
// --lan: let phones on the same Wi-Fi open the site. Only the website listens on the network;
// the API and database stay on this computer and are reached through the website's /api proxy.
// The API's trusted origin becomes the network address, so use that address on this PC too.
const lanIp = process.argv.includes("--lan") ? findLanAddress() : undefined;
if (process.argv.includes("--lan") && !lanIp) {
  console.error("[setup] No Wi-Fi or Ethernet address found. Connect to a network first.");
  stop(1);
}
const site = lanIp ? `http://${lanIp}:5173` : "http://127.0.0.1:5173";
run(
  "api",
  npm,
  ["--prefix", "server", "run", "dev"],
  // The PC itself can keep using 127.0.0.1 or localhost alongside the Wi-Fi address.
  lanIp
    ? {
        env: {
          ...process.env,
          CLIENT_URL: site,
          EXTRA_CLIENT_ORIGINS: "http://127.0.0.1:5173,http://localhost:5173",
        },
      }
    : {},
);
run("web", npm, lanIp ? ["run", "dev", "--", "--host", "0.0.0.0"] : ["run", "dev"]);
for (let i = 0; i < 60 && !((await open(3001)) && (await open(5173))); i++) await wait(1000);
console.log("\n  Finchbound is running: " + site);
if (lanIp) {
  console.log("  Phones on the same Wi-Fi: open " + site + " or scan a book's QR code.");
  console.log("  On this PC, http://127.0.0.1:5173 works too.");
  console.log("  If phones can't connect, allow Node.js on Private networks in Windows Firewall.");
}
console.log("  Press Ctrl+C to stop.\n");

// Set LAN_IP to choose an address yourself. Otherwise prefer Wi-Fi, then wired Ethernet, and skip
// virtual adapters (VirtualBox uses 192.168.56.x, which phones cannot reach).
function findLanAddress() {
  if (process.env.LAN_IP) return process.env.LAN_IP;
  const candidates = Object.entries(networkInterfaces())
    .filter(([name]) => !/vethernet|virtual|vmware|vbox|wsl|docker|loopback|bluetooth/i.test(name))
    .flatMap(([name, list]) =>
      (list ?? [])
        .filter((a) => a.family === "IPv4" && !a.internal && !a.address.startsWith("192.168.56."))
        .map((a) => ({ name, ip: a.address })),
    );
  const rank = ({ name, ip }) =>
    (/wi-?fi|wlan|wireless/i.test(name) ? 0 : /ethernet|^eth|^en/i.test(name) ? 1 : 2) * 10 +
    (/^192\.168\./.test(ip) ? 0 : /^10\./.test(ip) ? 1 : 2);
  return candidates.sort((a, b) => rank(a) - rank(b))[0]?.ip;
}
