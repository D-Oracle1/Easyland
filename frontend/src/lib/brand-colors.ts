/**
 * Installed-app launch look.
 *
 * Android uses the maskable icon both on the home screen and on its own launch
 * screen (which can't be disabled): the icon cropped to a 160dp circle (from a
 * 240dp canvas) on the manifest background_color. The maskable icon is a solid
 * green square, and background_color is that same green, so the launch screen
 * is plain green with just the logo. Our in-app splash starts on exactly that
 * frame, then shrinks the green into the small rounded-square tile.
 */
export const MASKABLE_BG = '#166534';
export const LAUNCH_BG = MASKABLE_BG;
/** Logo size inside the maskable icon (bold, within the launch circle). */
export const MASKABLE_LOGO_RATIO = 0.5;
/** Android draws the launch icon at 240dp ≈ CSS px. */
export const LAUNCH_ICON_DP = 240;
/** Logo size on Android's launch screen = where our splash animation starts. */
export const LAUNCH_LOGO_PX = Math.round(LAUNCH_ICON_DP * MASKABLE_LOGO_RATIO);
/** The small rounded-square tile the splash settles on. */
export const LAUNCH_TILE_PX = 80;
/** Versioned so browsers and Android refetch icons when they change. */
export const ICON_VERSION = 8;
