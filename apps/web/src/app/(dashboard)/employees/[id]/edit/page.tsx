import { Metadata } from 'next';
import { EmployeeForm } from '../../../../../components/employees/employee-form';

export const metadata: Metadata = { title: 'Editar Funcionário' };

export default function EditEmployeePage({ params }: { params: { id: string } }) {
  return <EmployeeForm employeeId={params.id} />;
}
