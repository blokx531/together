import { House, type LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Primary destinations, in bottom-bar order. Each feature adds itself here when it ships. */
export const NAV_ITEMS: readonly NavItem[] = [{ href: '/', label: 'Home', icon: House }];

export function isActivePath(itemHref: string, currentPath: string): boolean {
  if (itemHref === '/') return currentPath === '/';
  return currentPath === itemHref || currentPath.startsWith(`${itemHref}/`);
}
