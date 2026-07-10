'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { BarChart3, ClipboardList, FlaskConical, Home, LogOut, PackageCheck, Printer, Settings, UserPlus, UsersRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Role, SessionUser } from '@/lib/types';

type NavItem = {
  label: string;
  href: string;
  roles: Role[];
  icon: LucideIcon;
};

const nav: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', roles: ['admin', 'hub', 'lab', 'spoke'], icon: Home },
  { label: 'Register / Find', href: '/register', roles: ['admin', 'hub', 'spoke'], icon: UserPlus },
  { label: 'Samples', href: '/samples', roles: ['admin', 'hub', 'lab', 'spoke'], icon: Printer },
  { label: 'Dispatch', href: '/batches', roles: ['admin', 'hub', 'spoke'], icon: ClipboardList },
  { label: 'Hub Receive', href: '/hub', roles: ['admin', 'hub'], icon: PackageCheck },
  { label: 'Lab', href: '/lab', roles: ['admin', 'lab'], icon: FlaskConical },
  { label: 'Referrals', href: '/referrals', roles: ['admin', 'hub', 'spoke'], icon: UsersRound },
  { label: 'Reports', href: '/reports', roles: ['admin', 'hub', 'lab', 'spoke'], icon: BarChart3 },
  { label: 'Admin', href: '/admin', roles: ['admin'], icon: Settings }
];

function labelForRole(role?: Role) {
  if (role === 'admin') return 'Admin';
  if (role === 'hub') return 'Hub';
  if (role === 'lab') return 'Lab';
  if (role === 'spoke') return 'Spoke';
  return 'User';
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((data) => {
      if (!data.user && pathname !== '/login') router.replace('/login');
      setUser(data.user);
    });
  }, [pathname, router]);

  const visibleNav = useMemo(() => nav.filter((item) => user?.role && item.roles.includes(user.role)), [user?.role]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  }

  if (pathname === '/login') return <>{children}</>;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">HPV</div>
          <div>
            <h1>Screening Backbone</h1>
            <p>IOG hub and spokes</p>
          </div>
        </div>
        <nav className="nav">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} className={pathname === item.href ? 'active' : ''} href={item.href}>
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <strong>{user?.centerName || 'Loading center...'}</strong>
          <span>{user?.fullName || 'Authorised user'} / {labelForRole(user?.role)}</span>
          <button className="btn secondary icon-btn" onClick={logout} aria-label="Logout">
            <LogOut size={16} aria-hidden="true" />
            Logout
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
