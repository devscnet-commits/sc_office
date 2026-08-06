import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  EmployeeFilterDto,
} from '../dto/create-employee.dto';
import { createId } from '@paralleldrive/cuid2';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateEmployeeDto, userId: string) {
    const existing = await this.prisma.employee.findFirst({
      where: { cpf: dto.cpf },
    });

    if (existing) {
      throw new ConflictException('CPF já cadastrado no sistema');
    }

    const matricula = await this.generateMatricula();

    const employee = await this.prisma.employee.create({
      data: {
        matricula,
        fullName: dto.fullName,
        socialName: dto.socialName,
        cpf: dto.cpf,
        rg: dto.rg,
        rgIssuingBody: dto.rgIssuingBody,
        rgState: dto.rgState,
        birthDate: new Date(dto.birthDate),
        gender: dto.gender,
        maritalStatus: dto.maritalStatus,
        nationality: dto.nationality || 'Brasileiro(a)',
        birthCity: dto.birthCity,
        birthState: dto.birthState,
        email: dto.email,
        phone: dto.phone,
        cellphone: dto.cellphone,
        emergencyContact: dto.emergencyContact,
        emergencyPhone: dto.emergencyPhone,
        zipCode: dto.zipCode,
        street: dto.street,
        number: dto.number,
        complement: dto.complement,
        neighborhood: dto.neighborhood,
        city: dto.city,
        state: dto.state,
        departmentId: dto.departmentId,
        positionId: dto.positionId,
        admissionDate: new Date(dto.admissionDate),
        salary: dto.salary ? parseFloat(dto.salary) : undefined,
        workSchedule: dto.workSchedule,
        observations: dto.observations,
        bankName: dto.bankName,
        bankAgency: dto.bankAgency,
        bankAccount: dto.bankAccount,
        bankPix: dto.bankPix,
        pis: dto.pis,
        ctps: dto.ctps,
        ctpsSerie: dto.ctpsSerie,
        ctpsState: dto.ctpsState,
        educationLevel: dto.educationLevel,
        race: dto.race,
        bloodType: dto.bloodType,
        children: dto.children,
        uniformShirt: dto.uniformShirt,
        uniformTShirt: dto.uniformTShirt,
        uniformPants: dto.uniformPants,
        uniformJacket: dto.uniformJacket,
        uniformCoat: dto.uniformCoat,
        bootSize: dto.bootSize,
      },
      include: {
        department: { select: { id: true, name: true } },
        position: { select: { id: true, title: true } },
      },
    });

    // Create default dossier folders
    await this.createDefaultDossierFolders(employee.id);

    await this.auditService.log({
      userId,
      action: 'CREATE',
      module: 'employees',
      entityType: 'employee',
      entityId: employee.id,
      newValues: { matricula: employee.matricula, name: employee.fullName },
    });

    return employee;
  }

  async findAll(filter: EmployeeFilterDto) {
    const { search, status, departmentId, positionId, page = 1, limit = 20, sortBy = 'fullName', sortOrder = 'asc' } = filter;

    const where: any = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { cpf: { contains: search } },
        { matricula: { contains: search } },
      ];
    }

    if (status) where.status = status;
    if (departmentId) where.departmentId = departmentId;
    if (positionId) where.positionId = positionId;

    const [total, employees] = await Promise.all([
      this.prisma.employee.count({ where }),
      this.prisma.employee.findMany({
        where,
        include: {
          department: { select: { id: true, name: true } },
          position: { select: { id: true, title: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: employees,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        department: true,
        position: true,
        employeeDocuments: {
          include: { fileStorage: true },
          orderBy: { createdAt: 'desc' },
        },
        dossierFolders: {
          where: { parentId: null },
          include: { children: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!employee) throw new NotFoundException('Funcionário não encontrado');

    return employee;
  }

  async update(id: string, dto: UpdateEmployeeDto, userId: string) {
    const existing = await this.findOne(id);

    if (dto.cpf && dto.cpf !== existing.cpf) {
      const cpfExists = await this.prisma.employee.findFirst({
        where: { cpf: dto.cpf },
      });
      if (cpfExists) throw new ConflictException('CPF já cadastrado para outro funcionário');
    }

    const updated = await this.prisma.employee.update({
      where: { id },
      data: {
        ...dto,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        admissionDate: dto.admissionDate ? new Date(dto.admissionDate) : undefined,
        terminationDate: dto.terminationDate ? new Date(dto.terminationDate) : undefined,
        salary: dto.salary ? parseFloat(dto.salary) : undefined,
      },
      include: {
        department: { select: { id: true, name: true } },
        position: { select: { id: true, title: true } },
      },
    });

    await this.auditService.log({
      userId,
      action: 'UPDATE',
      module: 'employees',
      entityType: 'employee',
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: dto.status },
    });

    return updated;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);

    await this.prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log({
      userId,
      action: 'DELETE',
      module: 'employees',
      entityType: 'employee',
      entityId: id,
    });

    return { message: 'Funcionário removido com sucesso' };
  }

  async getVariables(id: string) {
    const employee = await this.findOne(id);

    return {
      'funcionario.nome': employee.fullName,
      'funcionario.nome_social': employee.socialName || employee.fullName,
      'funcionario.cpf': employee.cpf,
      'funcionario.rg': employee.rg || '',
      'funcionario.email': employee.email || '',
      'funcionario.telefone': employee.phone || '',
      'funcionario.celular': employee.cellphone || '',
      'funcionario.data_nascimento': employee.birthDate
        ? new Date(employee.birthDate).toLocaleDateString('pt-BR')
        : '',
      'funcionario.genero': employee.gender || '',
      'funcionario.estado_civil': employee.maritalStatus || '',
      'funcionario.nacionalidade': employee.nationality || '',
      'funcionario.matricula': employee.matricula,
      'funcionario.cargo': employee.position?.title ?? '',
      'funcionario.setor': employee.department?.name ?? '',
      'funcionario.data_admissao': employee.admissionDate
        ? new Date(employee.admissionDate).toLocaleDateString('pt-BR')
        : '',
      'funcionario.data_demissao': employee.terminationDate
        ? new Date(employee.terminationDate).toLocaleDateString('pt-BR')
        : '',
      'funcionario.endereco': this.buildAddress(employee),
      'funcionario.cep': employee.zipCode || '',
      'funcionario.rua': employee.street || '',
      'funcionario.numero': employee.number || '',
      'funcionario.complemento': employee.complement || '',
      'funcionario.bairro': employee.neighborhood || '',
      'funcionario.cidade': employee.city || '',
      'funcionario.estado': employee.state || '',
      'funcionario.banco': employee.bankName || '',
      'funcionario.agencia': employee.bankAgency || '',
      'funcionario.conta': employee.bankAccount || '',
      'funcionario.pix': employee.bankPix || '',
      'funcionario.pis': employee.pis || '',
      'funcionario.ctps': employee.ctps || '',
      'funcionario.ctps_serie': employee.ctpsSerie || '',
      'funcionario.ctps_estado': employee.ctpsState || '',
      'funcionario.orgao_emissor': employee.rgIssuingBody || '',
      'funcionario.rg_estado': employee.rgState || '',
      'funcionario.raca': employee.race || '',
      'funcionario.grau_instrucao': employee.educationLevel || '',
      'funcionario.tipo_sanguineo': employee.bloodType || '',
      'funcionario.filhos': employee.children || '',
      'funcionario.contato_emergencia': employee.emergencyContact || '',
      'funcionario.telefone_emergencia': employee.emergencyPhone || '',
      'funcionario.uniforme_camisa': employee.uniformShirt || '',
      'funcionario.uniforme_camiseta': employee.uniformTShirt || '',
      'funcionario.uniforme_calca': employee.uniformPants || '',
      'funcionario.uniforme_jaqueta': employee.uniformJacket || '',
      'funcionario.uniforme_casaco': employee.uniformCoat || '',
      'funcionario.uniforme_botina': employee.bootSize || '',
    };
  }

  private buildAddress(employee: any): string {
    const parts = [
      employee.street,
      employee.number ? `nº ${employee.number}` : '',
      employee.complement,
      employee.neighborhood,
      employee.city,
      employee.state,
      employee.zipCode ? `CEP: ${employee.zipCode}` : '',
    ].filter(Boolean);
    return parts.join(', ');
  }

  private async generateMatricula(): Promise<string> {
    const year = new Date().getFullYear().toString().slice(-2);
    const last = await this.prisma.employee.findFirst({
      where: { matricula: { startsWith: year } },
      orderBy: { matricula: 'desc' },
    });

    const seq = last
      ? parseInt(last.matricula.slice(2), 10) + 1
      : 1;

    return `${year}${seq.toString().padStart(5, '0')}`;
  }

  private async createDefaultDossierFolders(employeeId: string) {
    const folders = [
      { name: 'Contratos', order: 1 },
      { name: 'Documentos Pessoais', order: 2 },
      { name: 'Advertências', order: 3 },
      { name: 'Férias', order: 4 },
      { name: 'Treinamentos', order: 5 },
      { name: 'Certificados', order: 6 },
      { name: 'Rescisão', order: 7 },
      { name: 'Histórico', order: 8 },
    ];

    try {
      await this.prisma.dossierFolder.createMany({
        data: folders.map((f) => ({
          ...f,
          employeeId,
          type: 'SYSTEM',
          isSystem: true,
        })),
      });
    } catch {
      // dossier table may not exist yet — skip
    }
  }
}
