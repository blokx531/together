import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useHousehold } from '@/features/household';
import { Avatar } from '@/shared/ui/Avatar';
import { isActivePath, NAV_ITEMS } from './navigation';

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { me, householdName } = useHousehold();

  return (
    <div className="min-h-dvh lg:flex">
      <a
        href="#main"
        className="sr-only z-50 rounded-control bg-surface px-4 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-5 lg:flex">
        <p className="px-3 text-sm font-semibold tracking-wide text-accent uppercase">Together</p>
        <p className="mb-6 truncate px-3 text-sm text-ink-muted">{householdName}</p>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = isActivePath(item.href, location);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-control px-3 font-medium transition-colors ${isActive ? 'bg-accent-soft text-accent-strong' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'}`}
              >
                <item.icon className="size-5" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/settings"
          aria-current={location === '/settings' ? 'page' : undefined}
          className="mt-auto flex min-h-11 items-center gap-3 rounded-control px-3 text-ink-muted hover:bg-surface-2"
        >
          <Avatar name={me.displayName} tone="me" size="sm" decorative />
          <span className="truncate">Settings</span>
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="pt-safe sticky top-0 z-30 border-b border-line/70 bg-bg/90 backdrop-blur lg:hidden">
          <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
            <span className="text-sm font-semibold tracking-wide text-accent uppercase">
              Together
            </span>
            <Link href="/settings" aria-label="Settings" className="rounded-full p-1">
              <Avatar name={me.displayName} tone="me" size="sm" decorative />
            </Link>
          </div>
        </header>

        <main
          id="main"
          className="mx-auto w-full max-w-2xl flex-1 px-4 pt-5 pb-28 lg:px-8 lg:pt-8 lg:pb-12"
        >
          {children}
        </main>

        {/* Mobile bottom navigation */}
        {NAV_ITEMS.length > 1 ? (
          <nav
            aria-label="Main"
            className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
          >
            <ul className="mx-auto flex max-w-2xl">
              {NAV_ITEMS.map((item) => {
                const isActive = isActivePath(item.href, location);
                return (
                  <li key={item.href} className="flex-1">
                    <Link
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium ${isActive ? 'text-accent' : 'text-ink-muted'}`}
                    >
                      <item.icon
                        className="size-[1.375rem]"
                        aria-hidden
                        strokeWidth={isActive ? 2.25 : 1.75}
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : null}
      </div>
    </div>
  );
}
