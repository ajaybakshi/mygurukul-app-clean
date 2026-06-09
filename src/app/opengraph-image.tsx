import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'MyGurukul - AI-Powered Ancient Sanskrit Wisdom';
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

// Load the Devanagari font so Satori can render the Om (ॐ) glyph.
// next/og's default font has no Devanagari coverage; without this the
// render throws mid-stream and emits a 0-byte PNG (broken social card).
async function loadOmFont(): Promise<ArrayBuffer | null> {
  try {
    return await fetch(
      new URL('./NotoSansDevanagari.ttf', import.meta.url)
    ).then((res) => (res.ok ? res.arrayBuffer() : null));
  } catch {
    return null;
  }
}

export default async function OGImage() {
  const omFont = await loadOmFont();

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

        {/* Om Symbol — only rendered if the Devanagari font loaded */}
        {omFont && (
          <div
            style={{
              fontSize: 100,
              marginBottom: 20,
              fontFamily: 'Noto Sans Devanagari',
              color: '#D4AF37',
            }}
          >
            ॐ
          </div>
        )}

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
      fonts: omFont
        ? [
            {
              name: 'Noto Sans Devanagari',
              data: omFont,
              style: 'normal' as const,
              weight: 400 as const,
            },
          ]
        : undefined,
    }
  );
}
