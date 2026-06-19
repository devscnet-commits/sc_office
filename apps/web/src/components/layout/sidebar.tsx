'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Users, FileText, FilePlus, FolderOpen, Building2,
  LayoutDashboard, Settings, Shield, BarChart3,
  ChevronRight, Briefcase, ShieldCheck, GitBranch,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { usePermissions } from '../../stores/auth.store';

const navItems = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['ADMIN', 'RH', 'GESTOR', 'CONSULTA'],
  },
  {
    title: 'Funcionários',
    href: '/employees',
    icon: Users,
    roles: ['ADMIN', 'RH', 'GESTOR', 'CONSULTA'],
  },
  {
    title: 'Departamentos',
    href: '/departments',
    icon: Building2,
    roles: ['ADMIN', 'RH'],
  },
  {
    title: 'Templates',
    href: '/templates',
    icon: FileText,
    roles: ['ADMIN', 'RH'],
  },
  {
    title: 'Gerar Documento',
    href: '/documents/generate',
    icon: FilePlus,
    roles: ['ADMIN', 'RH', 'GESTOR'],
  },
  {
    title: 'Documentos',
    href: '/documents',
    icon: FolderOpen,
    roles: ['ADMIN', 'RH', 'GESTOR', 'CONSULTA'],
  },
  {
    title: 'Compliance',
    href: '/compliance',
    icon: ShieldCheck,
    roles: ['ADMIN', 'RH'],
  },
  {
    title: 'Organograma',
    href: '/organograma',
    icon: GitBranch,
    roles: ['ADMIN', 'RH', 'GESTOR', 'CONSULTA'],
  },
  {
    title: 'Empresa',
    href: '/company',
    icon: Briefcase,
    roles: ['ADMIN'],
  },
  {
    title: 'Usuários',
    href: '/users',
    icon: Shield,
    roles: ['ADMIN'],
  },
  {
    title: 'Auditoria',
    href: '/audit',
    icon: BarChart3,
    roles: ['ADMIN'],
  },
  {
    title: 'Configurações',
    href: '/settings',
    icon: Settings,
    roles: ['ADMIN'],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { role } = usePermissions();

  const visibleItems = navItems.filter((item) =>
    item.roles.includes(role || 'CONSULTA')
  );

  return (
    <aside className="w-64 border-r bg-card flex flex-col h-full shrink-0">
      <div className="p-5 border-b bg-primary">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex items-center justify-center rounded-lg bg-white px-2 py-1">
            <span className="text-primary font-black text-sm tracking-tight leading-none">SC</span>
            <span className="text-primary font-black text-sm tracking-tight leading-none">NET</span>
          </div>
          <div>
            <p className="font-semibold text-sm text-white">SC Office</p>
            <p className="text-xs text-blue-200">Gestão de RH</p>

          </div>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                isActive
                  ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
                  : 'text-muted-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.title}</span>
              {isActive && <ChevronRight className="h-3 w-3" />}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t">
        <p className="text-xs text-muted-foreground text-center">
          SC Office v1.0.0
        </p>
      </div>
    </aside>
  );
}
