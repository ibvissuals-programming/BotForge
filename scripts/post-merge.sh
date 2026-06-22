#!/bin/bash
set -e

# Install dependencies only.
# This project uses raw pg queries with auto-migrations on server boot
# (see artifacts/api-server/src/lib/db-migrate.ts).
# Drizzle is intentionally disabled — do NOT run drizzle-kit push here.
pnpm install --frozen-lockfile
