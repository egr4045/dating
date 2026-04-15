import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(private readonly prisma: PrismaService) {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) {
      this.logger.error('VAPID_PUBLIC_KEY или VAPID_PRIVATE_KEY не заданы — Web Push отключён.');
      return;
    }
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:support@meetup.app',
      publicKey,
      privateKey,
    );
    this.logger.log('Web Push инициализирован.');
  }

  async sendToUser(userId: number, title: string, body: string, url?: string, icon?: string) {
    const subs = await this.prisma.pushSubscription.findMany({
      where: { userId }
    });

    if (subs.length === 0) return;

    const payload = JSON.stringify({
      title,
      body,
      url,
      icon: icon || '/logo.png', // Fallback icon
    });

    const results = await Promise.allSettled(
      subs.map((sub: any) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload
        )
      )
    );

    // Чистим невалидные подписки (410 Gone или 404)
    for (let i = 0; i < results.length; i++) {
        const res = results[i];
        if (res.status === 'rejected') {
            const error: any = res.reason;
            if (error.statusCode === 410 || error.statusCode === 404) {
                this.logger.log(`Removing expired subscription: ${subs[i].id}`);
                await this.prisma.pushSubscription.delete({ where: { id: subs[i].id } }).catch(() => {});
            } else {
                this.logger.error(`Push error for sub ${subs[i].id}:`, error);
            }
        }
    }
  }
}
