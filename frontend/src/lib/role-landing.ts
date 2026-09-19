// Each role lands somewhere actually useful to them after login/signup,
// rather than everyone getting dropped on the transactional Checkout screen
// regardless of job. Used by the login page, signup, and the root redirect.
export const ROLE_LANDING_PAGE: Record<string, string> = {
  SUPER_ADMIN: '/dashboard',
  STORE_MANAGER: '/dashboard',
  BILLING_CLERK: '/billing/checkout',
  INVENTORY_MANAGER: '/inventory',
  SERVICE_STAFF: '/service/my-jobs',
};

export function roleLandingPage(role?: string | null): string {
  return ROLE_LANDING_PAGE[role ?? ''] ?? '/billing/checkout';
}
