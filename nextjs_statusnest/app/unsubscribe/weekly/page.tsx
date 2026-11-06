import type { Metadata } from 'next';
import UnsubscribeWeekly from './UnsubscribeWeekly';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Weekly email preferences | StatusNest', robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default async function Page({ searchParams }: { searchParams: Promise<{ userId?: string; token?: string }> }) {
  const { userId, token } = await searchParams;
  return <UnsubscribeWeekly userId={typeof userId === 'string' ? userId : ''} token={typeof token === 'string' ? token : ''} />;
}
