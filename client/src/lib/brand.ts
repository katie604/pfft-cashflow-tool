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
  /** Path under client/public */
  logoSrc: string;
  /** Primary brand colour (header, active tabs, totals) */
  navy: string;
  /** Accent brand colour (highlights, CTAs) */
  gold: string;
}

export const PFFT_BRAND: Brand = {
  id: "pfft",
  productName: "Profit First Cashflow Tool",
  tagline: "2-year monthly projection · All data saved automatically",
  logoSrc: "/brand/pfft-logo.png",
  navy: "#1D4E79",
  gold: "#F5B944",
};

// Active brand for this deployment.
export const BRAND: Brand = PFFT_BRAND;
