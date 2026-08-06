import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as mammoth from 'mammoth';
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

      this.logger.log(`PDF gerado para documento ${documentId}`);
    } catch (error) {
      this.logger.error(`Falha ao gerar PDF para documento ${documentId}:`, error);
      throw error;
    }
  }

  private async convertDocxToHtml(bucket: string, key: string): Promise<string> {
    const buffer = await this.minio.getObject(bucket, key);

    const result = await mammoth.convertToHtml(
      { buffer },
      {
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Title'] => h1:fresh",
          "r[style-name='Strong'] => strong",
          "r[style-name='Emphasis'] => em",
        ],
        convertImage: mammoth.images.imgElement((image) =>
          image.read('base64').then((data) => ({
            src: `data:${image.contentType};base64,${data}`,
          }))
        ),
      },
    );

    if (result.messages.length > 0) {
      const warnings = result.messages
        .filter((m) => m.type === 'warning')
        .map((m) => m.message)
        .join('; ');
      if (warnings) this.logger.warn(`mammoth: ${warnings}`);
    }

    return result.value;
  }

  private async generatePdfFromHtml(html: string, title: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(this.wrapWithStyles(html, title), {
        waitUntil: 'networkidle0',
      });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '25mm', right: '20mm', bottom: '25mm', left: '25mm' },
        displayHeaderFooter: true,
        headerTemplate: `<div style="font-size:8px;width:100%;text-align:center;color:#999;font-family:Arial,sans-serif;padding:0 20mm">${title}</div>`,
        footerTemplate: `
          <div style="font-size:8px;width:100%;text-align:center;color:#999;font-family:Arial,sans-serif;padding:0 20mm">
            Página <span class="pageNumber"></span> de <span class="totalPages"></span>
          </div>`,
      });

      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private wrapWithStyles(html: string, title: string): string {
    if (html.includes('<html')) return html;

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Arial', 'Helvetica', sans-serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #222;
    }
    h1 { font-size: 16pt; margin: 16px 0 10px; }
    h2 { font-size: 14pt; margin: 14px 0 8px; }
    h3 { font-size: 12pt; margin: 12px 0 6px; }
    p { margin-bottom: 8px; text-align: justify; }
    strong { font-weight: bold; }
    em { font-style: italic; }
    u { text-decoration: underline; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 11pt;
    }
    th, td {
      border: 1px solid #aaa;
      padding: 6px 10px;
      text-align: left;
      vertical-align: top;
    }
    th { background: #f0f0f0; font-weight: bold; }
    ul, ol { margin: 8px 0 8px 24px; }
    li { margin-bottom: 4px; }
    img { max-width: 100%; height: auto; }
    .page-break { page-break-after: always; }
    .signature-block {
      margin-top: 48px;
      display: flex;
      justify-content: space-around;
    }
    .signature-line {
      border-top: 1px solid #333;
      width: 200px;
      padding-top: 6px;
      text-align: center;
      font-size: 10pt;
    }
  </style>
</head>
<body>${html}</body>
</html>`;
  }
}
