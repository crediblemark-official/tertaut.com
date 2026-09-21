import { randomBytes } from "crypto";
import { db } from "../db";
import { licenseLeases } from "../db/schema";
import { eq, and, inArray, gt, lt } from "drizzle-orm";
import { LicenseService } from "./license";
import type { App } from "../db/schema/apps";

export interface ResolvedFloatingConfig {
  enabled: boolean;
  leaseTtlSeconds: number;
  heartbeatIntervalSeconds: number;
}

export const DEFAULT_LEASE_TTL_SECONDS = 300;
export const DEFAULT_HEARTBEAT_INTERVAL_SECONDS = 60;

/** Ambil konfigurasi floating license dari deliveryConfig aplikasi. */
export function resolveFloatingConfig(app?: App | null): ResolvedFloatingConfig {
  const floating = app?.deliveryConfig?.licenseKey?.floating;
  const ttl = Number(floating?.leaseTtlSeconds) || DEFAULT_LEASE_TTL_SECONDS;
  return {
    enabled: Boolean(floating?.enabled),
    leaseTtlSeconds: Math.min(Math.max(ttl, 30), 86_400),
    heartbeatIntervalSeconds:
      Number(floating?.heartbeatIntervalSeconds) || DEFAULT_HEARTBEAT_INTERVAL_SECONDS,
  };
}

export class LicenseLeaseService {
  private static newLeaseKey(): string {
    return `lk_${randomBytes(24).toString("hex")}`;
  }

  /**
   * Buat lease baru (activation floating) atau perbarui lease device yang sudah ada.
   * Mengembalikan `{ lease, isNew, ttlSeconds }`.
   */
  static async acquire(
    licenseId: string,
    hwidHash: string,
    options: {
      deviceName?: string;
      ipAddress?: string | null;
      ttlSeconds?: number;
      executor?: any;
      /** Kandidat hash untuk lookup (salted + legacy). Default: [hwidHash]. */
      lookupHashes?: string[];
    } = {}
  ): Promise<{ lease: typeof licenseLeases.$inferSelect; isNew: boolean }> {
    const query = options.executor || db;
    const ttlSeconds = options.ttlSeconds || DEFAULT_LEASE_TTL_SECONDS;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    // Fix: lookup juga hash legacy (tanpa salt) agar device yang aktivasi pertama
    // terjadi sebelum migrasi salted tidak dibuatkan lease kedua (seat terhitung dobel).
    const lookupHashes = options.lookupHashes ?? [hwidHash];
    const existing = await query.query.licenseLeases.findFirst({
      where: and(
        eq(licenseLeases.licenseId, licenseId),
        inArray(licenseLeases.hwidHash, lookupHashes)
      ),
    });

    if (existing) {
      const [updated] = await query
        .update(licenseLeases)
        .set({
          hwidHash,
          deviceName: options.deviceName || existing.deviceName,
          ipAddress: options.ipAddress || existing.ipAddress,
          lastHeartbeatAt: now,
          expiresAt,
        })
        .where(eq(licenseLeases.id, existing.id))
        .returning();
      return { lease: updated!, isNew: false };
    }

    const [lease] = await query
      .insert(licenseLeases)
      .values({
        id: `lsl_${randomBytes(8).toString("hex")}`,
        licenseId,
        hwidHash,
        deviceName: options.deviceName || "Unknown Device",
        leaseKey: this.newLeaseKey(),
        ipAddress: options.ipAddress || null,
        lastHeartbeatAt: now,
        expiresAt,
      })
      .returning();

    return { lease: lease!, isNew: true };
  }

  /** Jumlah lease yang masih hidup (expiresAt > now) untuk lisensi. */
  static async countLive(licenseId: string, executor: any = db): Promise<number> {
    const now = new Date();
    const rows = await executor
      .select({ id: licenseLeases.id })
      .from(licenseLeases)
      .where(
        and(eq(licenseLeases.licenseId, licenseId), gt(licenseLeases.expiresAt, now))
      );
    return rows.length;
  }

  /**
   * Heartbeat: verifikasi leaseKey cocok untuk (license, hwid) lalu perpanjang TTL.
   * Mengembalikan null bila lease tidak ditemukan / leaseKey tidak valid.
   */
  static async heartbeat(
    licenseId: string,
    hwid: string,
    leaseKey: string,
    options: { ipAddress?: string | null; deviceName?: string; ttlSeconds?: number } = {}
  ): Promise<typeof licenseLeases.$inferSelect | null> {
    const lookupHashes = LicenseService.hwidLookupHashes(hwid);
    const existing = await db.query.licenseLeases.findFirst({
      where: and(
        eq(licenseLeases.licenseId, licenseId),
        inArray(licenseLeases.hwidHash, lookupHashes)
      ),
    });

    if (!existing || existing.leaseKey !== leaseKey) return null;

    const now = new Date();
    const ttl = options.ttlSeconds || DEFAULT_LEASE_TTL_SECONDS;
    const expiresAt = new Date(now.getTime() + ttl * 1000);

    const [updated] = await db
      .update(licenseLeases)
      .set({
        hwidHash: existing.hwidHash,
        deviceName: options.deviceName || existing.deviceName,
        ipAddress: options.ipAddress || existing.ipAddress,
        lastHeartbeatAt: now,
        expiresAt,
      })
      .where(eq(licenseLeases.id, existing.id))
      .returning();

    return updated!;
  }

  /** Daftar seluruh lease (termasuk yang kedaluwarsa) milik lisensi. */
  static async listForLicense(licenseId: string) {
    return db.query.licenseLeases.findMany({
      where: eq(licenseLeases.licenseId, licenseId),
      orderBy: (lease, { desc }) => [desc(lease.lastHeartbeatAt)],
    });
  }

  /** Hapus lease yang kedaluwarsa (slot seat kembali ke pool). */
  static async deleteExpired(): Promise<number> {
    const expired = await db
      .delete(licenseLeases)
      .where(lt(licenseLeases.expiresAt, new Date()))
      .returning({ id: licenseLeases.id });
    return expired.length;
  }

  /** Lepas seat secara eksplisit (deactivate / unbind device). */
  static async releaseSeat(licenseId: string, hwid: string): Promise<number> {
    const lookupHashes = LicenseService.hwidLookupHashes(hwid);
    const deleted = await db
      .delete(licenseLeases)
      .where(
        and(
          eq(licenseLeases.licenseId, licenseId),
          inArray(licenseLeases.hwidHash, lookupHashes)
        )
      )
      .returning({ id: licenseLeases.id });
    return deleted.length;
  }
}