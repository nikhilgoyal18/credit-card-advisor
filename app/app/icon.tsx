import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: '#6366f1',
          borderRadius: 96,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        <div style={{ color: 'white', fontSize: 200, fontWeight: 900, lineHeight: 1 }}>
          CA
        </div>
      </div>
    ),
    { ...size }
  );
}
