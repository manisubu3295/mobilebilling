#!/usr/bin/env bash
# Production deploy: pull, build all three apps, migrate every database, then
# reload the PM2 processes. Stops at the first failure, before anything is
# reloaded, so a failed build or migration leaves the running site untouched.
#
# Usage (on the server, from the repo root):
#   ./deploy.sh                 # deploys the h2o-billing branch
#   ./deploy.sh main            # or another branch
#   SKIP_WEBSITE=1 ./deploy.sh  # skip the H2O shop website
set -euo pipefail

BRANCH="${1:-h2o-billing}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

step() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

for f in backend/.env frontend/.env.local; do
  [ -f "$f" ] || { echo "Missing $f — create it before deploying (see the *.example files)."; exit 1; }
done
if [ -z "${SKIP_WEBSITE:-}" ] && [ ! -f h2o-website/.env.local ]; then
  echo "Missing h2o-website/.env.local (or run with SKIP_WEBSITE=1)."; exit 1
fi

step "Pulling $BRANCH"
git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
git log -1 --oneline

step "Backend: install + build"
cd "$ROOT/backend"
npm ci
npm run build

step "Database: master, then every client database"
npm run prisma:migrate:master:deploy
npm run prisma:migrate:tenants

step "Billing app: install + build"
cd "$ROOT/frontend"
npm ci
npm run build

if [ -z "${SKIP_WEBSITE:-}" ]; then
  step "Shop website: install + build"
  cd "$ROOT/h2o-website"
  npm ci
  npm run build
fi

step "Reloading PM2"
cd "$ROOT"
if [ -n "${SKIP_WEBSITE:-}" ]; then
  pm2 startOrReload ecosystem.config.js --only billing-api,billing-web --update-env
else
  pm2 startOrReload ecosystem.config.js --update-env
fi
pm2 save

step "Done"
pm2 status
