'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/** Deep brand green used for the "dark" logo variant (CTA gradient end). */
const DARK_INK: [number, number, number] = [13, 43, 28];
const MAX_SIDE = 512;

const cache = new Map<string, string>();

/**
 * Returns a version of the logo with enough contrast for the given background.
 *  - on="light": near-white parts (e.g. a white letterform) are recoloured deep green
 *  - on="dark":  near-black parts are recoloured white
 * Coloured parts (the green leaf) are left untouched. Falls back to the original
 * image if it cannot be processed (e.g. no CORS) or nothing needed changing.
 */
function useContrastLogo(src: string | undefined, on: 'light' | 'dark') {
  const key = src ? `${on}|${src}` : '';
  const [url, setUrl] = useState<string | undefined>(() => (key && cache.get(key)) || undefined);
  const [ready, setReady] = useState<boolean>(() => !!(key && cache.has(key)));

  useEffect(() => {
    if (!src) return;
    if (cache.has(key)) {
      setUrl(cache.get(key));
      setReady(true);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h);
        const px = data.data;
        let changed = 0;
        for (let i = 0; i < px.length; i += 4) {
          if (px[i + 3] < 16) continue;
          const r = px[i], g = px[i + 1], b = px[i + 2];
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const neutral = max - min < 40;
          if (on === 'light' && neutral && min > 200) {
            // blend by how white the pixel is, so anti-aliased edges stay smooth
            const t = (min - 200) / 55;
            px[i] = Math.round(r + (DARK_INK[0] - r) * t);
            px[i + 1] = Math.round(g + (DARK_INK[1] - g) * t);
            px[i + 2] = Math.round(b + (DARK_INK[2] - b) * t);
            changed++;
          } else if (on === 'dark' && neutral && max < 70) {
            const t = (70 - max) / 70;
            px[i] = Math.round(r + (255 - r) * t);
            px[i + 1] = Math.round(g + (255 - g) * t);
            px[i + 2] = Math.round(b + (255 - b) * t);
            changed++;
          }
        }
        let out = src;
        if (changed > 0) {
          ctx.putImageData(data, 0, 0);
          out = canvas.toDataURL('image/png');
        }
        cache.set(key, out);
        setUrl(out);
      } catch {
        cache.set(key, src);
        setUrl(src);
      }
      setReady(true);
    };
    img.onerror = () => {
      if (cancelled) return;
      setUrl(src);
      setReady(true);
    };
    img.src = src;
    // Never keep the logo hidden for long if processing stalls
    const t = setTimeout(() => { if (!cancelled) { setUrl((u) => u ?? src); setReady(true); } }, 2500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [src, on, key]);

  return { url: url ?? src, ready };
}

export function BrandLogo({
  src,
  alt,
  on,
  className,
}: {
  src?: string;
  alt?: string;
  /** Background the logo sits on */
  on: 'light' | 'dark';
  className?: string;
}) {
  const { url, ready } = useContrastLogo(src, on);
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt ?? ''}
      className={cn('object-contain transition-opacity duration-200', ready ? 'opacity-100' : 'opacity-0', className)}
    />
  );
}
