import type { BotConfig } from "@workspace/api-client-react";

export function encodeConfig(cfg: BotConfig): string {
  return btoa(encodeURIComponent(JSON.stringify(cfg)));
}

export function decodeConfig(encoded: string): BotConfig | null {
  try {
    return JSON.parse(decodeURIComponent(atob(encoded)));
  } catch {
    return null;
  }
}

export function getConfigFromUrl(): BotConfig | null {
  const hash = window.location.hash;
  const match = hash.match(/[#&]?c=([^&]*)/);
  if (match && match[1]) return decodeConfig(match[1]);
  return null;
}

export function buildShareableUrl(cfg: BotConfig): string {
  return `${window.location.origin}${window.location.pathname.replace(/\/admin\/?$/, "")}#c=${encodeConfig(cfg)}`;
}

export function buildSlugUrl(slug: string): string {
  return `${window.location.origin}/${slug}`;
}

export function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
