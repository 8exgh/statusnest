import assert from 'node:assert/strict';
import { test } from 'node:test';
import nodemailer from 'nodemailer';
import { EmailProcessor } from '../src/email-processor';
import { createEmailSender, emailFailureReason } from '../src/email-sender';
import type { EmailTask, EmailTaskResult } from '../src/api-client';

const task: EmailTask = {
  notificationId: 'test-notification', userId: 'test-user', to: 'sbennett@8examples.com',
  subject: 'StatusNest: new signup', text: 'Account email: new@example.com'
};

test('sends claimed tasks, skips conflicts, and reports SMTP failure without secrets', async () => {
  const receipts: EmailTaskResult[] = [];
  let sends = 0;
  const processor = new EmailProcessor({
    getPendingEmails: async () => [task, { ...task, notificationId: 'already-claimed' }],
    claimEmail: async task => task.notificationId !== 'already-claimed',
    recordEmailResult: async result => { receipts.push(result); return true; }
  }, { send: async () => { sends++; throw Object.assign(new Error('password=secret'), { code: 'EAUTH', responseCode: 535 }); } });
  await processor.process();
  assert.equal(sends, 1);
  assert.equal(receipts[0].action, 'failed');
  assert.equal(receipts[0].error, 'Email delivery failed: EAUTH (535)');
});

test('SMTP success followed by API failure retries only the receipt', async () => {
  let sends = 0;
  let acknowledgements = 0;
  let claimAttempts = 0;
  const receipts: EmailTaskResult[] = [];
  const processor = new EmailProcessor({
    getPendingEmails: async () => [task],
    claimEmail: async () => { claimAttempts++; return acknowledgements === 0; },
    recordEmailResult: async result => {
      receipts.push(result);
      acknowledgements++;
      if (acknowledgements <= 2) throw new Error('API unavailable');
      return true;
    }
  }, { send: async () => { sends++; } });
  await processor.process();
  await processor.process();
  assert.equal(claimAttempts, 1);
  await processor.process();
  assert.equal(sends, 1);
  assert.equal(receipts.length, 3);
  assert(receipts.every(result => result.action === 'sent' && result.attemptId === receipts[0].attemptId));
});

test('Gmail uses the configured account, fixed task recipient, and stable message ID', async t => {
  let options: any;
  const messages: any[] = [];
  t.mock.method(nodemailer, 'createTransport', (config: unknown) => {
    options = config;
    return { sendMail: async (message: unknown) => { messages.push(message); return { accepted: [task.to] }; }, close() {} };
  });
  assert.equal(createEmailSender({}), null);
  const sender = createEmailSender({ GMAIL_USER: 'sender@example.com', GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop' })!;
  await sender.send(task);
  await sender.send(task);
  assert.equal(options.service, 'gmail');
  assert.deepEqual(options.auth, { user: 'sender@example.com', pass: 'abcdefghijklmnop' });
  assert.equal(messages[0].from.address, 'sender@example.com');
  assert.equal(messages[0].to, 'sbennett@8examples.com');
  assert.equal(messages[0].text, task.text);
  assert.equal(messages[0].messageId, messages[1].messageId);
  assert.equal(emailFailureReason(new Error('credentials')), 'Email delivery failed: DELIVERY_FAILED');
});

test('SMTP acceptance is required before recording success', async t => {
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async () => ({ accepted: [] }), close() {} }));
  const sender = createEmailSender({ GMAIL_USER: 'sender@example.com', GMAIL_APP_PASSWORD: 'password' })!;
  await assert.rejects(sender.send(task), /not accepted/);
});
