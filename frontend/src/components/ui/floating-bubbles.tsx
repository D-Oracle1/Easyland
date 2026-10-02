import { cn } from '@/lib/utils';

/**
 * Soft glassy bubbles that drift up through a hero background.
 *
 * Pure CSS (keyframes in globals.css: bubble-rise / bubble-sway) so it costs
 * nothing at runtime and renders identically on server and client. Each bubble
 * sits at the top of a full-height "lane" that is translated from below the
 * section to above it, so the travel distance always matches the hero height.
 * Respects prefers-reduced-motion (bubbles then stay still).
 */
const BUBBLES: { left: string; size: number; duration: number; delay: number; sway: number; tint: 'green' | 'lime' | 'amber' | 'white' }[] = [
  { left: '4%', size: 34, duration: 19, delay: -2, sway: 7, tint: 'green' },
  { left: '11%', size: 90, duration: 27, delay: -14, sway: 11, tint: 'white' },
  { left: '19%', size: 18, duration: 15, delay: -6, sway: 6, tint: 'lime' },
  { left: '27%', size: 56, duration: 23, delay: -19, sway: 9, tint: 'green' },
  { left: '36%', size: 24, duration: 17, delay: -1, sway: 8, tint: 'amber' },
  { left: '45%', size: 120, duration: 32, delay: -9, sway: 13, tint: 'white' },
  { left: '54%', size: 30, duration: 18, delay: -12, sway: 7, tint: 'lime' },
  { left: '62%', size: 66, duration: 25, delay: -4, sway: 10, tint: 'green' },
  { left: '70%', size: 20, duration: 14, delay: -9, sway: 6, tint: 'amber' },
  { left: '77%', size: 100, duration: 30, delay: -21, sway: 12, tint: 'white' },
  { left: '85%', size: 40, duration: 21, delay: -7, sway: 8, tint: 'lime' },
  { left: '93%', size: 26, duration: 16, delay: -11, sway: 7, tint: 'green' },
];

const TINTS = {
  green: 'rgba(52, 211, 153, 0.22)',
  lime: 'rgba(190, 242, 100, 0.20)',
  amber: 'rgba(252, 211, 77, 0.18)',
  white: 'rgba(255, 255, 255, 0.10)',
};

export function FloatingBubbles({ className, density = 'normal' }: { className?: string; density?: 'normal' | 'light' }) {
  const bubbles = density === 'light' ? BUBBLES.filter((_, i) => i % 2 === 0) : BUBBLES;
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {bubbles.map((b, i) => (
        <div
          key={i}
          className="bubble-lane absolute inset-y-0"
          style={{ left: b.left, width: b.size, animationDuration: `${b.duration}s`, animationDelay: `${b.delay}s` }}
        >
          <span
            className="bubble block rounded-full"
            style={{
              width: b.size,
              height: b.size,
              animationDuration: `${b.sway}s`,
              animationDelay: `${b.delay}s`,
              background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.55) 0%, ${TINTS[b.tint]} 38%, rgba(255,255,255,0.03) 72%)`,
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14), 0 8px 30px rgba(0,0,0,0.12)',
            }}
          />
        </div>
      ))}
    </div>
  );
}
