import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { createId } from '@paralleldrive/cuid2';
import * as crypto from 'crypto';
import * as dns from 'dns/promises';

export interface UploadResult {
  bucket: string;
  key: string;
  etag: string;
  url?: string;
}

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private client: Minio.Client;
  private buckets: Record<string, string>;
  private region = 'us-east-1';

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const config = this.configService.get('storage.minio');
    this.buckets = this.configService.get('storage.buckets')!;
    this.region = config.region || 'us-east-1';

    // MinIO SDK validates hostnames with RFC-1123 — underscores are rejected.
    // Resolve to IP first when the configured endpoint contains underscores.
    let endPoint: string = config.endPoint;
    if (endPoint.includes('_')) {
      try {
        const [ip] = await dns.resolve4(endPoint);
        this.logger.log(`MinIO: ${endPoint} → ${ip}`);
        endPoint = ip;
      } catch (err: any) {
        this.logger.warn(`MinIO: nao foi possivel resolver ${endPoint}: ${err?.message}`);
      }
    }

    this.client = new Minio.Client({
      endPoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      region: this.region,
    });

    try {
      await this.initializeBuckets();
    } catch (err: any) {
      this.logger.warn(`MinIO: inicializacao de buckets falhou (a aplicacao continua): ${err?.message || err}`);
    }
  }

  private async initializeBuckets() {
    for (const [, bucketName] of Object.entries(this.buckets)) {
      const name = bucketName as string;

      let exists = false;
      try {
        exists = await this.client.bucketExists(name);
      } catch {
        exists = false;
      }
      if (exists) continue;

      try {
        await this.client.makeBucket(name, this.region);
        this.logger.log(`Bucket criado: ${name}`);
      } catch (err: any) {
        const code = err?.code || '';
        if (code === 'BucketAlreadyOwnedByYou' || code === 'BucketAlreadyExists') {
          // bucket ja existe
        } else {
          this.logger.warn(`MinIO: nao foi possivel criar o bucket ${name}: ${err?.message || code || err}`);
        }
      }
    }
  }

  async uploadFile(
    bucket: string,
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    folder?: string,
  ): Promise<UploadResult> {
    const ext = originalName.split('.').pop() || '';
    const key = folder
      ? `${folder}/${createId()}.${ext}`
      : `${createId()}.${ext}`;

    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    await this.client.putObject(bucket, key, buffer, buffer.length, {
      'Content-Type': mimeType,
      'x-amz-checksum-sha256': checksum,
    });

    return { bucket, key, etag: checksum };
  }

  async getPresignedUrl(bucket: string, key: string, expirySeconds = 3600): Promise<string> {
    return this.client.presignedGetObject(bucket, key, expirySeconds);
  }

  async getObject(bucket: string, key: string): Promise<Buffer> {
    const stream = await this.client.getObject(bucket, key);
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    await this.client.removeObject(bucket, key);
  }

  async copyObject(sourceBucket: string, sourceKey: string, destBucket: string, destKey: string): Promise<void> {
    const conds = new Minio.CopyConditions();
    await this.client.copyObject(destBucket, destKey, `/${sourceBucket}/${sourceKey}`, conds);
  }

  getBucketName(type: keyof typeof this.buckets): string {
    return this.buckets[type];
  }
}
