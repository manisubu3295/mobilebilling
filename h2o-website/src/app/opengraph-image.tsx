import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'H2O Water Care — Kumbakonam';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #0B1F6E 0%, #0F2A8C 55%, #29C4E8 130%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 36,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: 'rgba(255,255,255,0.14)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
            }}
          >
            💧
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#fff', letterSpacing: -1 }}>
            H2O Water Care
          </div>
        </div>
        <div style={{ fontSize: 58, fontWeight: 800, color: '#fff', lineHeight: 1.08, maxWidth: 920 }}>
          Kumbakonam&apos;s water, engineered pure.
        </div>
        <div style={{ fontSize: 26, color: 'rgba(255,255,255,0.85)', marginTop: 26, maxWidth: 800 }}>
          RO, UV, UF & softener sales and service — free on-site water test.
        </div>
      </div>
    ),
    { ...size }
  );
}
