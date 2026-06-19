import { Metadata } from 'next';
import { DepartmentsClient } from '../../../components/departments/departments-client';

export const metadata: Metadata = { title: 'Departamentos' };

export default function DepartmentsPage() {
  return <DepartmentsClient />;
}
