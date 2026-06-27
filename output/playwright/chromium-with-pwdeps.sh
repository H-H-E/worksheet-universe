#!/usr/bin/env bash
set -euo pipefail

export LD_LIBRARY_PATH="/tmp/pwdeps/root/usr/lib/x86_64-linux-gnu:${LD_LIBRARY_PATH:-}"
exec /home/codexdev/.cache/ms-playwright/chromium-1226/chrome-linux64/chrome "$@"
