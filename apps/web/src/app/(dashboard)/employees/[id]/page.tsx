import { Metadata } from 'next';
import { EmployeeDetail } from '../../../../components/employees/employee-detail';

export const metadata: Metadata = { title: 'Funcionário' };

export default function EmployeeDetailPage({ params }: { params: { id: string } }) {
  return <EmployeeDetail employeeId={params.id} />;
}
