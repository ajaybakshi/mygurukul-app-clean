import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'MyGurukul - AI-Powered Ancient Sanskrit Wisdom';
export const size = {
  width: 1200,
  height: 600,
};

export const contentType = 'image/png';

export default async function TwitterImage() {
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
            top: 16,
            left: 16,
            right: 16,
            bottom: 16,
            border: '3px solid #D4AF37',
            borderRadius: 12,
          }}
        />

        {/* Om Symbol */}
        <div
          style={{
            fontSize: 80,
            marginBottom: 16,
          }}
        >
          <span style={{ color: '#D4AF37' }}>ॐ</span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 'bold',
            color: '#D4AF37',
            marginBottom: 12,
            fontFamily: 'serif',
          }}
        >
          MyGurukul
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 28,
            color: '#92400E',
            marginBottom: 32,
            textAlign: 'center',
            maxWidth: 800,
            fontFamily: 'serif',
          }}
        >
          Discover Ancient Sanskrit Wisdom with AI
        </div>

        {/* Features */}
        <div
          style={{
            display: 'flex',
            gap: 32,
            fontSize: 20,
            color: '#78350F',
          }}
        >
          <span>79+ Sacred Texts</span>
          <span style={{ color: '#D4AF37' }}>|</span>
          <span>Daily Wisdom</span>
          <span style={{ color: '#D4AF37' }}>|</span>
          <span>Spiritual Guidance</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
