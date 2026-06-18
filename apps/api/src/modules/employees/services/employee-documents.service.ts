import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DocumentType, ValidityStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { MinioService } from '../../../infrastructure/minio/minio.service';

const BUCKET = 'sc-employees';

const ALLOWED_MIME = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

@Injectable()
export class EmployeeDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
  ) {}

  async list(employeeId: string) {
    return this.prisma.employeeDocument.findMany({
      where: { employeeId },
      include: {
        fileStorage: { select: { originalName: true, mimeType: true, size: true } },
        documentValidity: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async upload(
    employeeId: string,
    file: Express.Multer.File,
    type: DocumentType,
    name: string,
    userId: string,
    issuedAt?: string,
    expiresAt?: string,
    description?: string,
  ) {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException('Formato de arquivo não suportado. Use PDF, imagem ou Word.');
    }
    if (file.size > 20 * 1024 * 1024) {
      throw new BadRequestException('Arquivo muito grande. Limite: 20MB.');
    }

    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException('Funcionário não encontrado');

    const folder = `${employeeId}/docs`;
    const { key: storedKey, etag: checksum } = await this.minio.uploadFile(
      BUCKET,
      file.buffer,
      file.originalname,
      file.mimetype,
      folder,
    );

    const fileStorage = await this.prisma.fileStorage.create({
      data: {
        bucket: BUCKET,
        key: storedKey,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        checksum,
        uploadedBy: userId,
      },
    });

    const doc = await this.prisma.employeeDocument.create({
      data: {
        employeeId,
        type,
        name,
        description,
        fileStorageId: fileStorage.id,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      },
      include: {
        fileStorage: { select: { originalName: true, mimeType: true, size: true } },
      },
    });

    if (issuedAt || expiresAt) {
      const expDate = expiresAt ? new Date(expiresAt) : null;
      const status = this.computeStatus(expDate);
      await this.prisma.documentValidity.create({
        data: {
          employeeId,
          employeeDocumentId: doc.id,
          documentType: type,
          issueDate: issuedAt ? new Date(issuedAt) : null,
          expirationDate: expDate,
          status,
        },
      });
    }

    return doc;
  }

  async download(employeeId: string, docId: string) {
    const doc = await this.prisma.employeeDocument.findFirst({
      where: { id: docId, employeeId },
      include: { fileStorage: true },
    });
    if (!doc) throw new NotFoundException('Documento não encontrado');

    const buffer = await this.minio.getObject(doc.fileStorage.bucket, doc.fileStorage.key);
    return {
      buffer,
      mimeType: doc.fileStorage.mimeType,
      filename: doc.fileStorage.originalName,
    };
  }

  async remove(employeeId: string, docId: string) {
    const doc = await this.prisma.employeeDocument.findFirst({
      where: { id: docId, employeeId },
      include: { fileStorage: true },
    });
    if (!doc) throw new NotFoundException('Documento não encontrado');

    await this.minio.deleteObject(doc.fileStorage.bucket, doc.fileStorage.key);
    await this.prisma.employeeDocument.update({ where: { id: docId }, data: { deletedAt: new Date() } });
    return { message: 'Documento removido' };
  }

  async verify(employeeId: string, docId: string, userId: string) {
    const doc = await this.prisma.employeeDocument.findFirst({ where: { id: docId, employeeId } });
    if (!doc) throw new NotFoundException('Documento não encontrado');

    return this.prisma.employeeDocument.update({
      where: { id: docId },
      data: { verified: true, verifiedAt: new Date(), verifiedBy: userId },
    });
  }

  private computeStatus(expirationDate: Date | null): ValidityStatus {
    if (!expirationDate) return ValidityStatus.NOT_APPLICABLE;
    const now = new Date();
    const diff = Math.floor((expirationDate.getTime() - now.getTime()) / 86400000);
    if (diff < 0) return ValidityStatus.EXPIRED;
    if (diff <= 7) return ValidityStatus.CRITICAL;
    if (diff <= 30) return ValidityStatus.EXPIRING_SOON;
    return ValidityStatus.VALID;
  }
}
