import { ImageResponse } from 'next/og';

export const alt = 'StatusNest — website uptime monitoring and outage alerts';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%', padding: '64px 72px', background: '#eff6ff', color: '#111827' }}>
      <div style={{ display: 'flex', alignItems: 'center', fontSize: 36, fontWeight: 700, color: '#2563eb' }}>StatusNest</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', fontSize: 70, fontWeight: 700, lineHeight: 1.1 }}>Know when your website goes down.</div>
        <div style={{ display: 'flex', fontSize: 30, color: '#4b5563' }}>Uptime monitoring · Outage alerts · Weekly reports</div>
      </div>
      <div style={{ display: 'flex', fontSize: 25, color: '#2563eb' }}>statusnest.com</div>
    </div>, size
  );
}
