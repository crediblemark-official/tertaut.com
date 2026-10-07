/**
 * Dynamic Open Graph Card Generator (SVG format)
 * Menghasilkan banner social preview (1200x630) tajam & ringan
 * Cocok untuk WhatsApp, X (Twitter), LinkedIn, Telegram, Discord.
 */

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text: string, maxCharsPerLine: number = 38): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + " " + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + " " + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
    if (lines.length >= 3) break; // maksimal 3 baris
  }
  if (currentLine && lines.length < 3) {
    lines.push(currentLine);
  }
  return lines;
}

export interface OgCardOptions {
  title?: string;
  description?: string;
  badge?: string;
  price?: string;
}

export function generateOgSvg(opts: OgCardOptions): string {
  const title = (opts.title || "Tertaut — Developer Infrastructure").slice(0, 90);
  const desc = (
    opts.description || "Merchant of Record Indonesia, Ed25519 Offline Licensing & AI Proxy Shield"
  ).slice(0, 160);
  const badge = (opts.badge || "MERCHANT OF RECORD & UNIVERSAL LICENSING").toUpperCase();
  const price = opts.price ? escapeXml(opts.price) : "";

  const titleLines = wrapText(title, 36);
  const descLines = wrapText(desc, 56);

  const titleSvg = titleLines
    .map((line, idx) => {
      const y = 250 + idx * 56;
      return `<text x="80" y="${y}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="46" font-weight="800" fill="#F8FAFC" letter-spacing="-0.02em">${escapeXml(line)}</text>`;
    })
    .join("\n");

  const startDescY = 270 + titleLines.length * 56;
  const descSvg = descLines
    .map((line, idx) => {
      const y = startDescY + idx * 30;
      return `<text x="80" y="${y}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="22" font-weight="400" fill="#94A3B8" letter-spacing="-0.01em">${escapeXml(line)}</text>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" fill="none">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#030712"/>
      <stop offset="50%" stop-color="#0B0F19"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>

    <!-- Glowing Radial Blurs -->
    <radialGradient id="glow-emerald" cx="20%" cy="15%" r="45%">
      <stop offset="0%" stop-color="#059669" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#059669" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow-cyan" cx="85%" cy="30%" r="50%">
      <stop offset="0%" stop-color="#0284C7" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#0284C7" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow-purple" cx="60%" cy="85%" r="40%">
      <stop offset="0%" stop-color="#6366F1" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#6366F1" stop-opacity="0"/>
    </radialGradient>

    <!-- Grid Pattern -->
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1E293B" stroke-width="0.75" stroke-opacity="0.4"/>
    </pattern>

    <linearGradient id="brand-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#10B981"/>
      <stop offset="100%" stop-color="#38BDF8"/>
    </linearGradient>
  </defs>

  <!-- Background Base -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>

  <!-- Ambient Glows -->
  <rect width="1200" height="630" fill="url(#glow-emerald)"/>
  <rect width="1200" height="630" fill="url(#glow-cyan)"/>
  <rect width="1200" height="630" fill="url(#glow-purple)"/>

  <!-- Top Border Accent Line -->
  <rect x="0" y="0" width="1200" height="4" fill="url(#brand-grad)"/>

  <!-- Brand Header -->
  <g transform="translate(80, 70)">
    <!-- Logo Symbol -->
    <rect width="44" height="44" rx="10" fill="#10B981" fill-opacity="0.15" stroke="#10B981" stroke-width="1.5"/>
    <path d="M 14 22 L 20 28 L 30 16" fill="none" stroke="#34D399" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    
    <!-- Logo Text -->
    <text x="56" y="30" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="900" fill="#FFFFFF" letter-spacing="-0.03em">tertaut<tspan fill="#34D399">.com</tspan></text>

    <!-- Pill Badge -->
    <rect x="240" y="6" width="360" height="32" rx="16" fill="#1E293B" fill-opacity="0.8" stroke="#334155" stroke-width="1"/>
    <circle cx="256" cy="22" r="4" fill="#10B981"/>
    <text x="270" y="27" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#E2E8F0" letter-spacing="0.08em">${escapeXml(badge)}</text>
  </g>

  <!-- Dynamic Title -->
  ${titleSvg}

  <!-- Dynamic Description -->
  ${descSvg}

  <!-- Optional Price Tag -->
  ${
    price
      ? `<g transform="translate(80, 480)">
    <rect width="200" height="46" rx="8" fill="#10B981" fill-opacity="0.12" stroke="#10B981" stroke-width="1.5"/>
    <text x="20" y="30" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="800" fill="#34D399">${price}</text>
  </g>`
      : ""
  }

  <!-- Bottom Feature Tags / Trust Badges -->
  <g transform="translate(80, 545)">
    <!-- Feature 1: Licensing -->
    <g transform="translate(0, 0)">
      <rect width="250" height="36" rx="8" fill="#0F172A" fill-opacity="0.9" stroke="#334155" stroke-width="1"/>
      <circle cx="18" cy="18" r="4" fill="#34D399"/>
      <text x="32" y="23" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600" fill="#CBD5E1">Ed25519 Offline Licensing</text>
    </g>

    <!-- Feature 2: Payments -->
    <g transform="translate(265, 0)">
      <rect width="230" height="36" rx="8" fill="#0F172A" fill-opacity="0.9" stroke="#334155" stroke-width="1"/>
      <circle cx="18" cy="18" r="4" fill="#38BDF8"/>
      <text x="32" y="23" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600" fill="#CBD5E1">QRIS &amp; PPN 11% Otomatis</text>
    </g>

    <!-- Feature 3: MoR Fee -->
    <g transform="translate(510, 0)">
      <rect width="210" height="36" rx="8" fill="#0F172A" fill-opacity="0.9" stroke="#334155" stroke-width="1"/>
      <circle cx="18" cy="18" r="4" fill="#FBBF24"/>
      <text x="32" y="23" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600" fill="#CBD5E1">Flat 5% MoR Fee (0% Sub)</text>
    </g>

    <!-- Feature 4: AI Shield -->
    <g transform="translate(735, 0)">
      <rect width="200" height="36" rx="8" fill="#0F172A" fill-opacity="0.9" stroke="#334155" stroke-width="1"/>
      <circle cx="18" cy="18" r="4" fill="#A855F7"/>
      <text x="32" y="23" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600" fill="#CBD5E1">AI Proxy Shield Vault</text>
    </g>
  </g>
</svg>`;
}
