import nodemailer from 'nodemailer';
import type { EmailTask } from './api-client';

export interface EmailSender {
  send(task: EmailTask): Promise<void>;
}

export function createEmailSender(env = process.env): EmailSender | null {
  const user = env.GMAIL_USER;
  const pass = env.GMAIL_APP_PASSWORD?.replace(/\s/g, '');
  if (!user || !pass) return null;

  return {
    async send(task) {
      const transport = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 30_000,
        dnsTimeout: 10_000,
        disableFileAccess: true,
        disableUrlAccess: true
      });
      try {
        // Use SMTP's connection/socket timeouts. A Promise.race timeout would
        // leave an in-flight send running and could report failure before acceptance.
        const info = await transport.sendMail({
          from: { name: 'StatusNest', address: user },
          to: task.to,
          subject: task.subject,
          text: task.text,
          messageId: `<${task.notificationId}@notifications.statusnest.com>`
        });
        if (!info.accepted.some(address => String(address).toLowerCase() === task.to.toLowerCase())) {
          throw new Error('Email recipient was not accepted');
        }
      } finally {
        transport.close();
      }
    }
  };
}

/** SMTP errors can contain server responses. Persist codes, never credentials. */
export function emailFailureReason(error: unknown): string {
  const smtp = error as { code?: unknown; responseCode?: unknown } | null;
  const code = typeof smtp?.code === 'string' && /^[A-Z_]{1,30}$/.test(smtp.code) ? smtp.code : 'DELIVERY_FAILED';
  const response = typeof smtp?.responseCode === 'number' ? ` (${smtp.responseCode})` : '';
  return `Email delivery failed: ${code}${response}`;
}
