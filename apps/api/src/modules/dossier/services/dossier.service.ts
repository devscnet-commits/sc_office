import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { MinioService } from '../../../infrastructure/minio/minio.service';
import { AuditService } from '../../audit/audit.service';
import { DocumentType } from '@prisma/client';

@Injectable()
export class DossierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
    private readonly audit: AuditService,
  ) {}

  async getFolderTree(employeeId: string) {
    const folders = await this.prisma.dossierFolder.findMany({
      where: { employeeId },
      include: {
        children: {
          include: {
            _count: { select: { files: true, generatedDocuments: true } },
          },
        },
        _count: { select: { files: true, generatedDocuments: true } },
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });

    return folders.filter((f) => !f.parentId);
  }

  async createFolder(employeeId: string, name: string, parentId?: string) {
    return this.prisma.dossierFolder.create({
      data: { employeeId, name, parentId },
    });
  }

  async renameFolder(id: string, name: string) {
    return this.prisma.dossierFolder.update({ where: { id }, data: { name } });
  }

  async deleteFolder(id: string) {
    const folder = await this.prisma.dossierFolder.findUnique({
      where: { id },
      include: { _count: { select: { files: true, children: true } } },
    });

    if (!folder) throw new NotFoundException('Pasta não encontrada');
    if (folder.isSystem) throw new Error('Não é possível excluir pasta do sistema');

    return this.prisma.dossierFolder.delete({ where: { id } });
  }

  async getFolderContents(folderId: string) {
    const [files, documents, subFolders] = await Promise.all([
      this.prisma.dossierFile.findMany({
        where: { folderId },
        include: { fileStorage: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.generatedDocument.findMany({
        where: { dossierFolderId: folderId },
        include: {
          template: { select: { id: true, name: true } },
          pdfStorage: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.dossierFolder.findMany({
        where: { parentId: folderId },
        include: { _count: { select: { files: true } } },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      }),
    ]);

    return { files, documents, subFolders };
  }

  async uploadFile(
    folderId: string,
    file: Express.Multer.File,
    type: DocumentType,
    userId: string,
  ) {
    const folder = await this.prisma.dossierFolder.findUnique({ where: { id: folderId } });
    if (!folder) throw new NotFoundException('Pasta não encontrada');

    const uploadResult = await this.minio.uploadFile(
      this.minio.getBucketName('dossier'),
      file.buffer,
      file.originalname,
      file.mimetype,
      `dossier/${folder.employeeId}`,
    );

    const fileStorage = await this.prisma.fileStorage.create({
      data: {
        bucket: uploadResult.bucket,
        key: uploadResult.key,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: BigInt(file.size),
        checksum: uploadResult.etag,
        uploadedBy: userId,
      },
    });

    return this.prisma.dossierFile.create({
      data: {
        name: file.originalname,
        folderId,
        fileStorageId: fileStorage.id,
        type,
        size: BigInt(file.size),
        mimeType: file.mimetype,
        uploadedBy: userId,
      },
    });
  }

  async downloadFile(fileId: string) {
    const file = await this.prisma.dossierFile.findUnique({
      where: { id: fileId },
      include: { fileStorage: true },
    });
    if (!file) throw new NotFoundException('Arquivo não encontrado');

    const buffer = await this.minio.getObject(
      file.fileStorage.bucket,
      file.fileStorage.key,
    );

    return {
      buffer,
      mimeType: file.mimeType,
      filename: file.name,
    };
  }

  async deleteFile(fileId: string) {
    const file = await this.prisma.dossierFile.findUnique({
      where: { id: fileId },
      include: { fileStorage: true },
    });
    if (!file) throw new NotFoundException('Arquivo não encontrado');

    await this.minio.deleteObject(file.fileStorage.bucket, file.fileStorage.key);
    return this.prisma.dossierFile.update({
      where: { id: fileId },
      data: { deletedAt: new Date() },
    });
  }

  async moveFile(fileId: string, targetFolderId: string) {
    return this.prisma.dossierFile.update({
      where: { id: fileId },
      data: { folderId: targetFolderId },
    });
  }
}
