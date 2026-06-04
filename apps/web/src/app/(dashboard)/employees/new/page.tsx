import { Metadata } from 'next';
import { EmployeeForm } from '../../../../components/employees/employee-form';

export const metadata: Metadata = { title: 'Novo Funcionário' };

export default function NewEmployeePage() {
  return <EmployeeForm />;
}
