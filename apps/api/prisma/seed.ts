import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Company
  const company = await prisma.company.upsert({
    where: { cnpj: '00.000.000/0001-00' },
    update: {},
    create: {
      name: 'SC Office Ltda',
      tradeName: 'SC Office',
      cnpj: '00.000.000/0001-00',
      email: 'contato@scoffice.com',
      phone: '(48) 3333-0000',
      street: 'Rua das Flores',
      number: '100',
      neighborhood: 'Centro',
      city: 'Florianópolis',
      state: 'SC',
      zipCode: '88010-000',
    },
  });

  // Admin user
  const adminPassword = await bcrypt.hash('Admin@12345', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@scoffice.com' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@scoffice.com',
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  // RH user
  const rhPassword = await bcrypt.hash('Rh@12345', 12);
  await prisma.user.upsert({
    where: { email: 'rh@scoffice.com' },
    update: {},
    create: {
      name: 'Gestora de RH',
      email: 'rh@scoffice.com',
      passwordHash: rhPassword,
      role: UserRole.RH,
      status: UserStatus.ACTIVE,
    },
  });

  // Departments
  const depts = [
    { name: 'Diretoria', code: 'DIR', order: 1 },
    { name: 'Recursos Humanos', code: 'RH', order: 2 },
    { name: 'Financeiro', code: 'FIN', order: 3 },
    { name: 'Comercial', code: 'COM', order: 4 },
    { name: 'Operacional', code: 'OPR', order: 5 },
    { name: 'Tecnologia da Informação', code: 'TI', order: 6 },
  ];

  const createdDepts: Record<string, any> = {};
  for (const dept of depts) {
    createdDepts[dept.code] = await prisma.department.upsert({
      where: { code: dept.code },
      update: {},
      create: dept,
    });
  }

  // Positions
  const positions = [
    { title: 'Diretor Executivo', code: 'CEO', departmentId: createdDepts['DIR'].id, level: 1 },
    { title: 'Analista de RH', code: 'ANA-RH', departmentId: createdDepts['RH'].id, level: 3 },
    { title: 'Assistente de RH', code: 'ASS-RH', departmentId: createdDepts['RH'].id, level: 4 },
    { title: 'Analista Financeiro', code: 'ANA-FIN', departmentId: createdDepts['FIN'].id, level: 3 },
    { title: 'Desenvolvedor Full Stack', code: 'DEV-FS', departmentId: createdDepts['TI'].id, level: 3 },
    { title: 'Vendedor', code: 'VEN', departmentId: createdDepts['COM'].id, level: 4 },
    { title: 'Operador', code: 'OPE', departmentId: createdDepts['OPR'].id, level: 5 },
  ];

  const createdPositions: Record<string, any> = {};
  for (const pos of positions) {
    createdPositions[pos.code] = await prisma.position.upsert({
      where: { code: pos.code },
      update: {},
      create: pos,
    });
  }

  // Sample employee
  const employee = await prisma.employee.upsert({
    where: { cpf: '000.000.000-00' },
    update: {},
    create: {
      matricula: '240001',
      fullName: 'João da Silva Santos',
      cpf: '000.000.000-00',
      rg: '00.000.000-0',
      birthDate: new Date('1990-06-15'),
      gender: 'MASCULINO',
      maritalStatus: 'CASADO',
      nationality: 'Brasileiro(a)',
      email: 'joao.silva@scoffice.com',
      cellphone: '(48) 99999-8888',
      zipCode: '88010-000',
      street: 'Rua das Acácias',
      number: '200',
      neighborhood: 'Trindade',
      city: 'Florianópolis',
      state: 'SC',
      departmentId: createdDepts['TI'].id,
      positionId: createdPositions['DEV-FS'].id,
      admissionDate: new Date('2024-01-15'),
    },
  });

  // Default dossier folders for sample employee
  const folderCount = await prisma.dossierFolder.count({ where: { employeeId: employee.id } });
  if (folderCount === 0) {
    const defaultFolders = [
      { name: 'Contratos', order: 1 },
      { name: 'Documentos Pessoais', order: 2 },
      { name: 'Advertências', order: 3 },
      { name: 'Férias', order: 4 },
      { name: 'Treinamentos', order: 5 },
      { name: 'Certificados', order: 6 },
      { name: 'Rescisão', order: 7 },
      { name: 'Histórico', order: 8 },
    ];

    await prisma.dossierFolder.createMany({
      data: defaultFolders.map((f) => ({
        ...f,
        employeeId: employee.id,
        type: 'SYSTEM',
        isSystem: true,
      })),
    });
  }

  // System config
  await prisma.systemConfig.upsert({
    where: { key: 'initialized' },
    update: {},
    create: {
      key: 'initialized',
      value: { at: new Date().toISOString(), version: '1.0.0' },
      description: 'Timestamp da inicialização do sistema',
    },
  });

  console.log('✅ Seed concluído!');
  console.log('');
  console.log('👤 Usuários criados:');
  console.log('   admin@scoffice.com / Admin@12345  (ADMIN)');
  console.log('   rh@scoffice.com / Rh@12345        (RH)');
  console.log('');
  console.log(`🏢 Empresa: ${company.name}`);
  console.log(`👨 Funcionário exemplo: ${employee.fullName} (${employee.matricula})`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
