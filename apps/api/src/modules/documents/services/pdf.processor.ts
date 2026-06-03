import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { MinioService } from '../../../infrastructure/minio/minio.service';
import { TemplateEngineService } from '../../templates/engines/template-engine.service';
import { TemplateFormat } from '@prisma/client';

@Processor('pdf-generation')
export class PdfProcessor {
  private readonly logger = new Logger(PdfProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
    private readonly engine: TemplateEngineService,
  ) {}

  @Process('generate-pdf')
  async handlePdfGeneration(job: Job) {
    const { documentId, format, fileStorageId, userId } = job.data;

    try {
      const document = await this.prisma.generatedDocument.findUnique({
        where: { id: documentId },
        include: { fileStorage: true, template: true },
      });

      if (!document) return;

      let htmlContent: string;

      if (format === TemplateFormat.HTML) {
        const fileBuffer = await this.minio.getObject(
          document.fileStorage!.bucket,
          document.fileStorage!.key,
        );
        htmlContent = fileBuffer.toString('utf-8');
      } else {
        // For DOCX, render to HTML first then PDF
        // In production, use LibreOffice or similar for DOCX->PDF
        htmlContent = await this.convertDocxToHtml(
          document.fileStorage!.bucket,
          document.fileStorage!.key,
        );
      }

      const pdfBuffer = await this.generatePdfFromHtml(htmlContent, document.name);

      const uploadResult = await this.minio.uploadFile(
        this.minio.getBucketName('documents'),
        pdfBuffer,
        `${document.name}.pdf`,
        'application/pdf',
        `pdf/${document.employeeId}`,
      );

      const pdfStorage = await this.prisma.fileStorage.create({
        data: {
          bucket: uploadResult.bucket,
          key: uploadResult.key,
          originalName: `${document.name}.pdf`,
          mimeType: 'application/pdf',
          size: BigInt(pdfBuffer.length),
          checksum: uploadResult.etag,
          uploadedBy: userId,
        },
      });

      await this.prisma.generatedDocument.update({
        where: { id: documentId },
        data: { pdfStorageId: pdfStorage.id },
      });

      this.logger.log(`PDF generated for document ${documentId}`);
    } catch (error) {
      this.logger.error(`Failed to generate PDF for document ${documentId}:`, error);
      throw error;
    }
  }

  private async generatePdfFromHtml(html: string, title: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(this.wrapWithStyles(html, title), {
        waitUntil: 'networkidle0',
      });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
        displayHeaderFooter: true,
        headerTemplate: `<div style="font-size:9px;width:100%;text-align:center;color:#666;">${title}</div>`,
        footerTemplate: `
          <div style="font-size:9px;width:100%;text-align:center;color:#666;">
            Página <span class="pageNumber"></span> de <span class="totalPages"></span>
          </div>`,
      });

      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private wrapWithStyles(html: string, title: string): string {
    // If html already has a full structure, return as-is
    if (html.includes('<html')) return html;

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Arial', sans-serif; font-size: 12pt; line-height: 1.6; color: #333; }
    h1 { font-size: 18pt; margin-bottom: 16px; }
    h2 { font-size: 14pt; margin-bottom: 12px; }
    p { margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f5f5f5; font-weight: bold; }
    .page-break { page-break-after: always; }
    .signature-line { border-top: 1px solid #333; margin-top: 40px; padding-top: 8px; text-align: center; }
  </style>
</head>
<body>${html}</body>
</html>`;
  }

  private async convertDocxToHtml(bucket: string, key: string): Promise<string> {
    // Simplified: in production use mammoth or LibreOffice
    const buffer = await this.minio.getObject(bucket, key);
    // Placeholder - integrate mammoth.js for real conversion
    return `<p>Documento gerado a partir de DOCX. Implementar conversão completa com mammoth.js.</p>`;
  }
}
