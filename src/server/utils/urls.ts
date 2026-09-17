import { config } from "../config";

export function buildUrl(path: string): string {
  return `${config.publicAppUrl}${path}`;
}

export function buildCheckoutUrl(identifier: string): string {
  return `${config.publicAppUrl}/checkout/dana/finish?orderId=${identifier}`;
}

export function buildPayUrl(slug: string): string {
  return `${config.publicAppUrl}/pay/${slug}`;
}
