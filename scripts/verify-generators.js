import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/verify-generators.ts"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    TMPDIR: "/tmp",
    TMP: "/tmp",
    TEMP: "/tmp",
    XDG_CACHE_HOME: "/tmp"
  },
  encoding: "utf8",
  stdio: "inherit"
});

process.exit(result.status ?? 1);
