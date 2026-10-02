/**
 * True when the site is running as the installed app (from the home screen),
 * in any display mode the manifest may resolve to — the app requests
 * `fullscreen`, and browsers fall back to `standalone` / `minimal-ui`.
 * iOS Safari exposes `navigator.standalone` instead of display-mode.
 */
export function isInstalledApp(): boolean {
  if (typeof window === 'undefined') return false;
  const mq = (mode: string) => window.matchMedia?.(`(display-mode: ${mode})`).matches;
  return (
    mq('fullscreen') ||
    mq('standalone') ||
    mq('minimal-ui') ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}
