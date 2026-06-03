import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class ExpirationSchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ExpirationSchedulerService.name);

  constructor(
    @InjectQueue('expiration-check') private readonly queue: Queue,
  ) {}

  async onApplicationBootstrap() {
    // Remove existing repeatable jobs to avoid duplicates on restart
    const repeatableJobs = await this.queue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await this.queue.removeRepeatableByKey(job.key);
    }

    // Schedule daily at 00:05 AM
    await this.queue.add(
      'daily-check',
      {},
      {
        repeat: { cron: '5 0 * * *' },
        jobId: 'daily-expiration-check',
        removeOnComplete: 10,
        removeOnFail: 5,
      },
    );

    this.logger.log('Expiration check scheduled: daily at 00:05 AM');
  }

  // Manual trigger for testing / admin use
  async triggerNow() {
    const job = await this.queue.add('daily-check', {}, {
      removeOnComplete: true,
      priority: 1,
    });
    this.logger.log(`Manual expiration check triggered: job ${job.id}`);
    return { jobId: job.id };
  }
}
