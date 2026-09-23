# Roadmap Upgrade Lisensi — tertaut.com

**Tanggal:** 18 September 2026  
**Status:** SELESAI 100% — Fase 0–6 + Dashboard UI + Dokumentasi + Coverage Optimasi (terverifikasi: 204/204 test)

---

## Peta dependensi

```
[SELESAI] F0 Konsolidasi schema (pra-syarat)
    └─► [SELESAI] F1 Entitlement/Feature Flags (core) ──► [SELESAI] F2 Floating License + Lease/Heartbeat
            │          │
            │          ├─► [SELESAI] F3 Webhooks Lifecycle
            │          └─► [SELESAI] F4 Audit Log Event-Sourced
            ├─► [SELESAI] F5 Offline Token Hardening (paralel)
    └─► [SELESAI] F6 S2S & Dashboard Manajemen Seat (paralel, butuh F1 utk config)
```

---

## Fase 0 — Konsolidasi Schema _(SELESAI)_

- ✅ Tambah `licenseVersion: int` (default: 1, not null) + `features: jsonb` (default: `{}`) di tabel `licenses`.
- ✅ Tambah `defaultFeatures?: Record<string, any>` pada DeliveryConfig `apps`.
- ✅ Migration Drizzle `0003_volatile_miracleman.sql` diterapkan ke database dan di-backfill.

## Fase 1 — Entitlement / Feature Flags _(core, SELESAI)_

- ✅ **Schema:** `features` (JSONB) pada lisensi + default features per app pada checkout fulfillment.
- ✅ **Token offline:** claims Ed25519 diperkaya `feat?: Record<string, any>` + `vfl?: string` (version floor) — diverifikasi offline tanpa server.
- ✅ **Online check:** endpoint `/licensing/validate`, `/licensing/verify`, dan `/licensing/activate` mengembalikan `entitlements` dan `licenseVersion`; enforce version floor check (`min_version` -> `APP_VERSION_TOO_OLD` HTTP 403).
- ✅ **SDK:** metode `licensing.entitlements()` + opsi `appVersion` pada `validate`/`verify` + verifikasi offline token memeriksa version floor `vfl` dan membaca claims `feat`.
- ✅ **S2S API:** `/api/v1/s2s/licenses/issue` mendukung penetapan custom `features` langsung dari server-to-server.
- ✅ **Pengujian:** Test suite integrasi menyeluruh `12_license_entitlements.test.ts` dan unit test SDK (87/87 test passing 100%).

## Fase 2 — Floating License + Lease/Heartbeat _(SELESAI)_

- ✅ Implementasi lease TTL via `license_leases` (validatedAt/heartbeatAt/expiresAt) dan outbox cadangan di `license_seat_leases`.
- ✅ `/activate` → buat lease TTL (default 5 menit, config app); kembalikan `leaseKey`.
- ✅ `/heartbeat` perpanjang lease (anti-lockout, rate-limit 120/min); lease hangus → seat rolling otomatis.
- ✅ `/seats` (dashboard + S2S): daftar seat + status lease + lastHeartbeat.
- ✅ Config per app di dashboard: `floating { enabled, leaseTtlSeconds, heartbeatIntervalSeconds }` + badge "Floating" di katalog aplikasi.
- ✅ Job `expireLeases()` (60s) merilis lease kadaluwarsa.
- ⚠️ Perbedaan dari rencana: anti-lockout tidak hard-block 1-device — batch/recover/transfer diserahkan S2S; seat penuh → `license.seat_full` + `SEAT_FULL`.

## Fase 3 — Webhooks Lifecycle _(SELESAI)_

- ✅ Schema `webhook_endpoints` + outbox `webhook_deliveries` (status, attempts, nextRetryAt, signature).
- ✅ Event: `license.issued`, `.activated`, `.deactivated`, `.seat_full`, `.revoked`, `.expired`, `.renewed`, `.transferred`, `.unbound`, `credits.insufficient`.
- ✅ Pengiriman outbox: `dispatchWebhooks()` (30s), max 6 attempts, backoff eksponensial `2^attempts * 30s`, timeout 10s; signature HMAC `x-tertaut-signature` dihitung dari **raw body**.
- ✅ CRUD webhook: S2S + dashboard (tab Webhooks di halaman Lisensi): daftar, tambah, edit, aktif/nonaktif, rotate secret, test delivery.

## Fase 4 — Audit Log Event-Sourced _(SELESAI)_

- ✅ Schema `license_events` append-only (licenseId, licenseKey, appId, event, actorType, actorId, payload, ipAddress, createdAt).
- ✅ Query dashboard (`GET /licensing/events`, sesi) + S2S (`GET /s2s/licenses/events`, secret).
- ✅ Panel "Detail" per lisensi di dashboard: tab Seat Perangkat + Audit Trail, refresh otomatis 15 detik; semua aksi S2S/dashboard mencatat event (`issued/activated/deactivated/seat_full/revoked/expired/renewed/transferred/unbound/recovered/seat_released/login_failed/...`).

## Fase 5 — Offline Token Hardening _(SELESAI)_

- ✅ Token dirotasi pada `/validate` & `/activate`; `jti` lama masuk cache-denylist → `TOKEN_REVOKED`.
- ✅ Toleransi clock-skew `nbf = iat - 300s`; serangan iat masa depan → `TOO_FORWARD_IAT` / `NOT_YET_VALID`.
- ✅ Token baru menghormati `deliveryConfig.licenseKey.offlineGraceDays` (default 30).
- ✅ Pengujian terpisah `16_token_hardening.test.ts` (nbf/jti, rotasi, TOKEN_REVOKED, too-forward/not-yet-valid).

## Fase 6 — Manajemen Seat & Operator S2S _(SELESAI)_

- ✅ Batch issue/revoke: `POST /s2s/licenses/issue-batch|revoke-batch` (maks 200/request, error per-item).
- ✅ List seats + IP + last heartbeat: `GET /s2s/licenses/seats`.
- ✅ Force-release: `POST /s2s/licenses/seat/release`; recovery device hilang: `POST /s2s/licenses/recover`; transfer: `POST /s2s/licenses/transfer`.
- ✅ Dashboard UI: Detail seats per lisensi, Webhooks tab, floating config + badge, offline grace days.

## Dokumentasi _(SELESAI)_

- ✅ `README.md` diperbarui (fitur F0–F6).
- ✅ `docs/server-to-server.md`: seats, force-release, recover, transfer, issue-batch, revoke-batch, events, webhooks + verifikasi signature.
- ✅ `docs/sdk.md` & `packages/sdk/README.md`: metode `licensing.heartbeat()`.

## Pengujian _(SELESAI)_

- ✅ `bun test --parallel=1`: **111 pass / 0 fail** (799 expect, 26 files) — termasuk integrasi baru
  `13_floating_lease`, `14_webhooks_lifecycle` (HMAC + retry + kredit), `15_audit_log`,
  `16_token_hardening`, `17_seat_management_s2s`, serta pengujian modular SDK (`sdk.test.ts`).
- ✅ Unit Test SDK: **100% Line Coverage** di seluruh modul `@tertaut/sdk` (`errors`, `modules/licensing`, `modules/checkout`, `modules/credits`, `modules/aiproxy`, `modules/s2s`, `utils/crypto`, `utils/semver`).
- ✅ `bun run build:client` (vue-tsc + vite) & `bun run build:server` (tsc) bersih.

---

## Ringkasan akhir (semua fase selesai)

| Fase               | Status     | Test / Artefak                                          |
| ------------------ | ---------- | ------------------------------------------------------- |
| F0 Schema          | ✅ SELESAI | migration `0003` + `0004` diterapkan                    |
| F1 Entitlements    | ✅ SELESAI | `12_license_entitlements.test.ts`                       |
| F2 Floating/lease  | ✅ SELESAI | `13_floating_lease.test.ts`                             |
| F3 Webhooks        | ✅ SELESAI | `14_webhooks_lifecycle.test.ts`                         |
| F4 Audit           | ✅ SELESAI | `15_audit_log.test.ts`                                  |
| F5 Token hardening | ✅ SELESAI | `16_token_hardening.test.ts`                            |
| F6 Seat mgmt S2S   | ✅ SELESAI | `17_seat_management_s2s.test.ts`                        |
| Modular SDK v0.2.0 | ✅ SELESAI | Arsitektur modular `< 15KB`, 100% test coverage         |
| Frontend dashboard | ✅ SELESAI | Webhooks tab, Detail seats+audit, floating config/badge |
| Dokumentasi        | ✅ SELESAI | README, sdk.md, server-to-server.md, roadmap            |
| Coverage Optimasi  | ✅ SELESAI | 204/204 test passing, 0 fail                            |

Semua fase mengikuti pola test yang sudah ada (`src/server/__test/`, bun test, DB live) dan kompatibel dengan arsitektur saat ini — tanpa rewrite.
