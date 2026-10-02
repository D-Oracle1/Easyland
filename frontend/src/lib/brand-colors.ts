/**
 * Installed-app launch look.
 *
 * Android 12+ always shows its own launch screen first: the largest manifest
 * icon (our 512px "splash" variant) centred on background_color. That variant
 * is the small rounded-square app tile on white, so the launch screen shows the
 * same small square logo as our in-app splash, which then takes over seamlessly.
 */
export const LAUNCH_BG = '#ffffff';
/** Solid background of the home-screen (maskable 192px) icon. */
export const MASKABLE_BG = '#166534';
/** Android draws the launch icon at 240dp; the tile fills a third of it ≈ 80dp. */
export const LAUNCH_ICON_DP = 240;
export const LAUNCH_TILE_PX = 80;
export const LAUNCH_TILE_RATIO = LAUNCH_TILE_PX / LAUNCH_ICON_DP;
/** Versioned so browsers and Android refetch icons when they change. */
export const ICON_VERSION = 7;
