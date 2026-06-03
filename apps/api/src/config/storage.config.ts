import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  minio: {
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    region: process.env.MINIO_REGION || 'us-east-1',
  },
  buckets: {
    templates: process.env.MINIO_BUCKET_TEMPLATES || 'sc-templates',
    documents: process.env.MINIO_BUCKET_DOCUMENTS || 'sc-documents',
    employees: process.env.MINIO_BUCKET_EMPLOYEES || 'sc-employees',
    dossier: process.env.MINIO_BUCKET_DOSSIER || 'sc-dossier',
    company: process.env.MINIO_BUCKET_COMPANY || 'sc-company',
    temp: process.env.MINIO_BUCKET_TEMP || 'sc-temp',
  },
}));
