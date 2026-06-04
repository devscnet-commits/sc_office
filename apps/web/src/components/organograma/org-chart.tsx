'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ChevronDown, Users, Briefcase, User } from 'lucide-react';
import { api } from '../../lib/api';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { Input } from '../ui/input';

interface Employee {
  id: string;
  fullName: string;
  matricula: string;
  position?: { title: string };
  status: string;
}

interface Department {
  id: string;
  name: string;
  description?: string;
  employees: Employee[];
  _count: { employees: number };
}

function EmployeeNode({ emp }: { emp: Employee }) {
  const initials = emp.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted transition-colors">
      <Avatar className="h-7 w-7 shrink-0">
        <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{emp.fullName}</p>
        <p className="text-xs text-muted-foreground truncate">{emp.position?.title || '—'}</p>
      </div>
      {emp.status !== 'ACTIVE' && (
        <Badge variant="secondary" className="text-xs ml-auto shrink-0">
          {emp.status === 'ON_LEAVE' ? 'Afastado' : emp.status === 'TERMINATED' ? 'Desligado' : 'Inativo'}
        </Badge>
      )}
    </div>
  );
}

function DepartmentNode({ dept, search }: { dept: Department; search: string }) {
  const [open, setOpen] = useState(true);

  const filtered = search
    ? dept.employees.filter(
        (e) =>
          e.fullName.toLowerCase().includes(search.toLowerCase()) ||
          e.position?.title?.toLowerCase().includes(search.toLowerCase()),
      )
    : dept.employees;

  if (search && filtered.length === 0) return null;

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Department header */}
      <button
        className="w-full flex items-center gap-3 p-3 bg-muted/50 hover:bg-muted transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        <Briefcase className="h-4 w-4 text-primary shrink-0" />
        <span className="font-semibold text-sm flex-1">{dept.name}</span>
        <Badge variant="secondary" className="text-xs">
          <Users className="h-3 w-3 mr-1" />
          {dept._count.employees}
        </Badge>
      </button>

      {/* Employees */}
      {open && (
        <div className="divide-y">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground px-4 py-3">Nenhum funcionário neste departamento</p>
          ) : (
            filtered.map((emp) => (
              <div key={emp.id} className="px-3">
                <EmployeeNode emp={emp} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function OrgChart() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['org-chart'],
    queryFn: async () => {
      const [depts, emps] = await Promise.all([
        api.get('/departments?limit=100') as any,
        api.get('/employees?limit=500&status=ACTIVE') as any,
      ]);

      const employees: Employee[] = emps?.data?.data ?? [];
      const departments: any[] = depts?.data?.data ?? depts?.data ?? [];

      // Attach employees to departments
      const deptMap = departments.map((d: any) => ({
        ...d,
        employees: employees.filter((e) => e['departmentId'] === d.id),
        _count: { employees: employees.filter((e) => e['departmentId'] === d.id).length },
      }));

      // Employees without department
      const noDept = employees.filter((e) => !departments.some((d) => d.id === e['departmentId']));

      return { departments: deptMap, noDept };
    },
    staleTime: 2 * 60 * 1000,
  });

  const totalActive = data?.departments.reduce((s, d) => s + d._count.employees, 0) ?? 0;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary + Search */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar funcionário ou cargo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="text-sm text-muted-foreground shrink-0">
          {totalActive} funcionário(s) ativo(s) · {data?.departments.length ?? 0} departamento(s)
        </div>
      </div>

      {/* Departments */}
      <div className="space-y-3">
        {data?.departments.map((dept) => (
          <DepartmentNode key={dept.id} dept={dept} search={search} />
        ))}

        {/* No department */}
        {(data?.noDept?.length ?? 0) > 0 && (
          <DepartmentNode
            dept={{
              id: '__none__',
              name: 'Sem Departamento',
              employees: data!.noDept,
              _count: { employees: data!.noDept.length },
            }}
            search={search}
          />
        )}

        {data?.departments.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
              <Users className="h-10 w-10" />
              <p>Nenhum departamento cadastrado</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
