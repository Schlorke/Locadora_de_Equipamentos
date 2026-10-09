/**
 * Private reads whose contract refuses a sibling or foreign browser Origin even on GET (administrative badges and
 * WhatsApp reads, waves 45 and 49 of docs/features/shared-api-host.md; Zoho, entry 285 of known-issues; wave 131).
 * Since wave 132 (finding 144) the common private principal of both hosts applies the same rule to every private
 * read, after the membership and before the data; the route-level calls stay as the earlier, explicit contract of
 * those reads, and Zoho also runs it before its own state and provider steps. Wave 133 (finding 149) extends it to the
 * account reads outside the principal: /api/auth/organizations, /current and the selection GET (after the session) and
 * the GET reads of both identity engines, Better Auth and NextAuth, except their cross-site navigations
 * (modules/identity/engine-read-origin.ts, applied by runtime.ts and by withSignInAvailability).
 *
 * The rule lives with the central same-origin guard (modules/identity/same-origin-mutation): without an Origin
 * header (native app, server-to-server, top-level navigation) the request continues; with one, it is classified as
 * a headers-only request and compared with the origin the trusted edge computed for the host (or the configured
 * public origin), exactly as the mutation guard does.
 */
export { rejectExplicitCrossOrigin } from '../modules/identity/same-origin-mutation'
