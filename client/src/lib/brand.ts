// ============================================================
// Brand layer — one config object per business.
// To add PFANZ / ETB later: add a new Brand object below and
// switch BRAND (e.g. by hostname or env). Single source of truth
// for product name, tagline, logo and palette.
// ============================================================

export interface Brand {
  id: "pfft" | "pfanz" | "etb";
  /** Shown in the header + browser tab */
  productName: string;
  /** Sub-line under the product name */
  tagline: string;
  /** Logo path under client/public (relative — base is applied at use site) */
  logoSrc: string;
  /** Primary brand colour (header, active tabs, totals) */
  navy: string;
  /** Accent brand colour (highlights, CTAs) */
  gold: string;
}

export const PFFT_BRAND: Brand = {
  id: "pfft",
  productName: "Katie's Cashflow Creation",
  tagline: "2-year monthly projection · All data saved automatically",
  logoSrc: "brand/pfft-logo.png",
  navy: "#1D4E79",
  gold: "#F5B944",
};

// Neutral house skin - ETB blue, no gold. Katie's call 2026-08-07: every
// calculator wears one colour so they read as one family of internal tools.
export const NEUTRAL_BRAND: Brand = {
  id: "etb",
  productName: "Katie's Cashflow Creation",
  tagline: "2-year monthly projection \u00b7 All data saved automatically",
  logoSrc: "brand/pfft-logo.png",
  navy: "#1F3D6E",
  gold: "#2c5290",
};

// Active brand for this deployment.
export const BRAND: Brand = NEUTRAL_BRAND;
