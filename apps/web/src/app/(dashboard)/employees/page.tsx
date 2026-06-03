import { Metadata } from 'next';
import { EmployeesClient } from '../../../components/employees/employees-client';

export const metadata: Metadata = { title: 'Funcionários' };

export default function EmployeesPage() {
  return <EmployeesClient />;
}
