/**
 * Whether `pathname` is `href` itself or a path nested under it, matched on
 * a segment boundary - `/bills` and `/bills/archive` both count, but
 * `/bills-archive` doesn't. A raw `pathname.startsWith(href)` would give
 * the nav two different definitions of "active" (this one, and the exact
 * check the root "/" link needs) that could silently diverge the first
 * time a route is added next to one of these - this is deliberately the
 * one definition every nav item uses, `/` included.
 */
export function isRouteActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}
