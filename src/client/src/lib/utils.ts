import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupiah(amount?: number | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(
  dateStr?: string | null | Date,
  options?: {
    fallback?: string;
    includeTime?: boolean;
    month?: "short" | "long" | "numeric" | "2-digit" | "narrow";
  }
): string {
  const fallback = options?.fallback ?? "-";
  if (!dateStr) return fallback;
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: options?.month ?? "short",
    year: "numeric",
    ...(options?.includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}
