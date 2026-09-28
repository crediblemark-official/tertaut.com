#!/usr/bin/env bash
#
# Verifikasi hermeticity test suite: setiap file harus lulus saat dijalankan
# sendirian terhadap database yang baru di-seed.
#
# Suite utama (`bun test`) berjalan `--parallel=1` sehingga urutan file
# deterministik. Tapi deterministik juga berarti file bisa diam-diam bergantung
# pada state yang ditinggalkan file sebelumnya. Test seperti
# `GET /payouts/account` (butuh profil builder milik user admin) dan
# `POST /payouts/trigger` (butuh gateway=DANA) hanya hijau di full run karena
# file lain kebetulan menyiapkan state itu lebih dulu.
#
# Script ini menangkap kelas bug tersebut: state di luar file dianggap bug.
#
# Env yang dibutuhkan: sama dengan .github/workflows/ci.yml
#   DATABASE_URL, JWT_SECRET, BETTER_AUTH_SECRET, VAULT_ENCRYPTION_KEY,
#   PAYMENT_GATEWAY, ACTIVE_PAYMENT_GATEWAY, DANA_*, NODE_ENV=test, PORT
#
# Usage:  bash scripts/test-isolated.sh
set -uo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL belum di-set. Export env test terlebih dahulu." >&2
  exit 1
fi

RESET_CMD='
import postgres from "postgres";
const u = new URL(process.env.ADMIN_DATABASE_URL);
const sql = postgres(`postgresql://${u.username}:${u.password}@${u.hostname}:${u.port}/postgres`, { max: 1 });
const name = process.env.ADMIN_DATABASE_URL.split("/").pop();
await sql`drop database if exists ${sql(name)} with (force)`;
await sql`create database ${sql(name)}`;
await sql.end();
'

export ADMIN_DATABASE_URL="${DATABASE_URL}"

mapfile -t FILES < <(find src/server/__test -name '*.test.ts' | sort)

failed=()
for f in "${FILES[@]}"; do
  printf '  %-58s ' "$f"
  if bun -e "$RESET_CMD" >/dev/null 2>&1; then
    bun run db:push --force >/dev/null 2>&1
    bun run db:seed >/dev/null 2>&1
  fi
  if out=$(bun test --parallel=1 "$f" 2>&1); then
    echo "OK   ($(grep -oE '^ [0-9]+ pass' <<<"$out" | tr -d ' ' | cut -d' ' -f1) test)"
  else
    echo "FAIL"
    failed+=("$f")
  fi
done

echo
if [ ${#failed[@]} -eq 0 ]; then
  echo "Semua ${#FILES[@]} file test lulus saat dijalankan sendirian."
  exit 0
fi

echo "${#failed[@]} dari ${#FILES[@]} file GAGAL saat dijalankan sendirian:"
printf '  - %s\n' "${failed[@]}"
exit 1
