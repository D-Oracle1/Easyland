/**
 * Installed-app launch colours.
 *
 * Android 12+ always shows its own launch screen (it can't be turned off): the
 * maskable app icon, cropped to a 160dp circle, on the manifest background_color.
 * Our in-app splash starts with exactly that picture — a MASKABLE_BG circle on
 * LAUNCH_BG — so the hand-over is invisible and the two read as one splash.
 */
export const LAUNCH_BG = '#ffffff';
/** Solid background of the maskable icon = the circle Android draws. */
export const MASKABLE_BG = '#166534';
/** Android's launch-screen icon geometry (dp ≈ CSS px): 240 icon, 160 visible circle. */
export const LAUNCH_ICON_PX = 240;
export const LAUNCH_CIRCLE_PX = 160;
/** Versioned so browsers and Android refetch icons when they change. */
export const ICON_VERSION = 6;
