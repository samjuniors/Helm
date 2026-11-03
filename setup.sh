#!/bin/sh
command -v node >/dev/null 2>&1 || { echo "Node.js 18 or newer is required: https://nodejs.org"; exit 1; }
exec node "$(dirname "$0")/setup.mjs" "$@"
