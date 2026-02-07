#!/usr/bin/env bash
#
# PostgreSQL backup script for poc-demo
# Usage: ./backup.sh [backup_dir]
#
# Creates a gzip-compressed SQL dump via docker exec,
# named backup-YYYYMMDD-HHMMSS.sql.gz.
# Automatically removes backups older than 7 days.

set -euo pipefail

BACKUP_DIR="${1:-./backups}"
CONTAINER_NAME="poc-demo-postgres-1"
PG_USER="${POSTGRES_USER:-poc}"
PG_DB="${POSTGRES_DB:-poc_demo}"
RETAIN_DAYS=7

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup-${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[backup] Starting PostgreSQL backup..."
echo "[backup] Container: ${CONTAINER_NAME}"
echo "[backup] Database: ${PG_DB}"
echo "[backup] Output: ${BACKUP_FILE}"

docker exec "$CONTAINER_NAME" pg_dump -U "$PG_USER" "$PG_DB" | gzip > "$BACKUP_FILE"

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[backup] Done — ${BACKUP_FILE} (${SIZE})"

# Clean up old backups
DELETED=$(find "$BACKUP_DIR" -name "backup-*.sql.gz" -mtime +"$RETAIN_DAYS" -print -delete | wc -l)
if [ "$DELETED" -gt 0 ]; then
    echo "[backup] Cleaned up ${DELETED} backup(s) older than ${RETAIN_DAYS} days"
fi
