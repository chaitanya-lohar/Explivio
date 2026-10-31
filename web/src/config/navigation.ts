import { Film, House, Settings, SquarePlay, type LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Extra path prefixes that should also mark this item active. */
  matches?: readonly string[];
}

export const primaryNavigation: readonly NavItem[] = [
  { label: "Home", href: "/", icon: House },
  { label: "Create Video", href: "/create", icon: SquarePlay, matches: ["/configure", "/generating"] },
  { label: "My Videos", href: "/videos", icon: Film },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  const prefixes = [item.href, ...(item.matches ?? [])];
  return prefixes.some((prefix) => (prefix === "/" ? pathname === "/" : pathname === prefix || pathname.startsWith(`${prefix}/`)));
}
