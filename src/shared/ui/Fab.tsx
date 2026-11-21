import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface FabProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
}

/** Floating primary action, kept clear of the mobile bottom navigation and safe area. */
export function Fab({ label, icon, className = '', type = 'button', ...rest }: FabProps) {
  return (
    <button
      type={type}
      className={`fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 inline-flex min-h-14 items-center gap-2 rounded-full bg-accent px-5 font-semibold text-on-accent shadow-raised transition-colors hover:bg-accent-strong lg:right-8 lg:bottom-8 ${className}`}
      {...rest}
    >
      {icon}
      {label}
    </button>
  );
}
