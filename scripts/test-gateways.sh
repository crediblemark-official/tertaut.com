#!/usr/bin/env bash
#
# Matriks kesiapan payment gateway: jalankan full test suite dengan tiap gateway
# dipilih satu per satu lewat TERTAUT_TEST_GATEWAY.
#
# Dipakai saat sedang mendaftarkan beberapa PG sekaligus dan belum tahu mana
# yang akan dipakai: hasilnya menunjukkan gateway mana yang benar-benar siap
# produksi (lolos penuh) vs mana yang masih perlu dikerjakan.
#
# Env: sama seperti .github/workflows/ci.yml (lihat README bagian test).
# Usage: bash scripts/test-gateways.sh
set -uo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL belum di-set." >&2
  exit 1
fi

GATEWAYS=("dana" "xendit" "xenithpay")

printf '%-12s %-10s %s\n' "GATEWAY" "STATUS" "DETAIL"
printf '%-12s %-10s %s\n' "-------" "------" "------"

for gw in "${GATEWAYS[@]}"; do
  export TERTAUT_TEST_GATEWAY="$gw"

  bun -e '
import postgres from "postgres";
const u = new URL(process.env.ADMIN_DATABASE_URL);
const sql = postgres(`postgresql://${u.username}:${u.password}@${u.hostname}:${u.port}/postgres`, { max: 1 });
const name = process.env.ADMIN_DATABASE_URL.split("/").pop();
await sql`drop database if exists ${sql(name)} with (force)`;
await sql`create database ${sql(name)}`;
await sql.end();
' >/dev/null 2>&1
  bun run db:push --force >/dev/null 2>&1
  bun run db:seed >/dev/null 2>&1

  out=$(bun test --parallel=1 2>&1)
  pass=$(grep -oE '[0-9]+ pass' <<<"$out" | tail -1 | cut -d' ' -f1)
  fail=$(grep -oE '[0-9]+ fail' <<<"$out" | tail -1 | cut -d' ' -f1)
  pass=${pass:-0}
  fail=${fail:-0}

  if [ "$fail" = "0" ]; then
    printf '%-12s %-10s %s\n' "$gw" "SIAP" "${pass} test lulus"
  else
    failed=$(grep -oE '^\(fail\) .*' <<<"$out" | sed 's/ \[.*//' | head -6)
    printf '%-12s %-10s %s\n' "$gw" "GAGAL" "${fail} gagal / ${pass} lulus"
    while IFS= read -r line; do
      [ -n "$line" ] && printf '%-12s %-10s   %s\n' "" "" "$line"
    done <<<"$failed"
  fi
done

unset TERTAUT_TEST_GATEWAY
echo
echo "Hapus DB test bila tidak lagi dipakai:"
echo "  bun -e 'import postgres from \"postgres\";const s=postgres(process.env.DATABASE_URL.replace(/\\/[^/]*$/, \"/postgres\"));await s\`drop database if exists tertaut_test with (force)\`;await s.end();'"
