import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'MyGurukul - AI-Powered Ancient Sanskrit Wisdom';
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #FEF3C7 0%, #FFFBEB 50%, #FEF3C7 100%)',
          position: 'relative',
        }}
      >
        {/* Decorative border */}
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            right: 20,
            bottom: 20,
            border: '3px solid #D4AF37',
            borderRadius: 16,
          }}
        />

        {/* Om Symbol */}
        <div
          style={{
            fontSize: 100,
            marginBottom: 20,
          }}
        >
          <span style={{ color: '#D4AF37' }}>ॐ</span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 'bold',
            color: '#D4AF37',
            marginBottom: 16,
            fontFamily: 'serif',
          }}
        >
          MyGurukul
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 32,
            color: '#92400E',
            marginBottom: 40,
            textAlign: 'center',
            maxWidth: 800,
            fontFamily: 'serif',
          }}
        >
          AI-Powered Ancient Sanskrit Wisdom
        </div>

        {/* Features */}
        <div
          style={{
            display: 'flex',
            gap: 40,
            fontSize: 24,
            color: '#78350F',
          }}
        >
          <span>79+ Sacred Texts</span>
          <span style={{ color: '#D4AF37' }}>|</span>
          <span>Vedic Wisdom</span>
          <span style={{ color: '#D4AF37' }}>|</span>
          <span>Spiritual Guidance</span>
        </div>

        {/* URL */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            fontSize: 20,
            color: '#B45309',
          }}
        >
          www.mygurukul.org
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
