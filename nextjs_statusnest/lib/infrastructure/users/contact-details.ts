import { getSystemDatabase } from '../database/connection';
import type { AlertRecipients } from '@/types';

export interface StoredContactDetails {
  /** Account (login) email. */
  email: string;
  /** E.164 phone number for calls and SMS, or null if not set. */
  phoneNumber: string | null;
  /** Explicit alert email, or null to use the account email. */
  notificationEmail: string | null;
}

interface ContactRow {
  email: string;
  phone_number: string | null;
  notification_email: string | null;
}

/**
 * Phone number / alert email live in the system database next to the user
 * row (like the password hash) — they are account settings, not domain
 * state, so they are not part of the read model. Changes are also recorded
 * in the user's event stream as ContactDetailsUpdatedEvent.
 */
export class ContactDetailsService {
  static getForUser(userId: string): StoredContactDetails | null {
    const db = getSystemDatabase();
    try {
      const row = db.prepare(
        'SELECT email, phone_number, notification_email FROM users WHERE id = ?'
      ).get(userId) as ContactRow | undefined;
      if (!row) return null;
      return {
        email: row.email,
        phoneNumber: row.phone_number,
        notificationEmail: row.notification_email
      };
    } finally {
      db.close();
    }
  }
  
  static update(
    userId: string,
    details: { phoneNumber: string | null; notificationEmail: string | null }
  ): void {
    const db = getSystemDatabase();
    try {
      db.prepare(
        'UPDATE users SET phone_number = ?, notification_email = ? WHERE id = ?'
      ).run(details.phoneNumber, details.notificationEmail, userId);
    } finally {
      db.close();
    }
  }
  
  /**
   * Who to reach when one of this user's domains goes offline: the phone
   * number if set, and the alert email (falling back to the account email so
   * there is always at least one channel).
   */
  static getAlertRecipients(userId: string): AlertRecipients {
    const details = ContactDetailsService.getForUser(userId);
    return {
      phoneNumber: details?.phoneNumber ?? null,
      email: details?.notificationEmail || details?.email || null
    };
  }
}
