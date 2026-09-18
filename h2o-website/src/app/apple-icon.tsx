import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: '#0B1F6E',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="120" height="120" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="14" fill="#29C4E8" opacity="0.2" />
          <path
            d="M16 6C16 6 8 16 8 20.5C8 24.9 11.6 28 16 28C20.4 28 24 24.9 24 20.5C24 16 16 6 16 6Z"
            fill="#29C4E8"
          />
          <path
            d="M12.5 21.5C12.5 23.5 14 24.8 16 24.8"
            stroke="#F4FAFC"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
