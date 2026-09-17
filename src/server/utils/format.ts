export function formatIdr(value: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(value);
}

export function generateId(prefix: string, length: number = 8): string {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  crypto.getRandomValues(bytes);
  return prefix + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").substring(0, length);
}

export function nowISO(): string {
  return new Date().toISOString();
}
