/**
 * Access control for the Security Operations Center.
 *
 * The SOC is a private tool restricted to a single owner account. The email is
 * configurable via NEXT_PUBLIC_SOC_OWNER_EMAIL but defaults to the owner.
 *
 * NOTE: this is a client-side visibility/gate that matches the app's existing
 * client-auth model. The admin *control panel* additionally requires a
 * server-verified password (see /api/security/unlock), so the sensitive
 * controls are not protected by client checks alone.
 */
export const SOC_OWNER_EMAIL = (
  process.env.NEXT_PUBLIC_SOC_OWNER_EMAIL || 'effizydonjoe@gmail.com'
)
  .trim()
  .toLowerCase();

export function isSocOwner(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === SOC_OWNER_EMAIL;
}
