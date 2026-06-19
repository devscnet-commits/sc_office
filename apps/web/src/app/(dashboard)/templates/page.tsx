import { Metadata } from 'next';
import { TemplatesClient } from '../../../components/templates/templates-client';

export const metadata: Metadata = { title: 'Templates' };

export default function TemplatesPage() {
  return <TemplatesClient />;
}
