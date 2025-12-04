import type { Metadata, Viewport } from 'next'
import './globals.css'
import BottomNavigation from '@/components/BottomNavigation'
import { ChakraProvider } from '@chakra-ui/react'

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://mygurukul.org'

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'MyGurukul - Ancient Indian Wisdom & Sacred Scriptures',
    template: '%s | MyGurukul',
  },
  description: 'Explore authentic Sanskrit scriptures, Vedic wisdom, Upanishads, Bhagavad Gita, Ayurveda, Yoga texts, and ancient Indian spiritual literature. AI-powered spiritual guidance from original Sanskrit sources.',
  keywords: [
    'Sanskrit scriptures',
    'ancient Indian texts',
    'Vedic wisdom',
    'Upanishads',
    'Bhagavad Gita',
    'Bhagvad Gita',
    'Ayurveda',
    'Yoga texts',
    'Yoga Sutras',
    'Patanjali',
    'Ramayana',
    'Mahabharata',
    'Puranas',
    'Vedas',
    'Rig Veda',
    'Yajur Veda',
    'Sama Veda',
    'Atharva Veda',
    'Caraka Samhita',
    'Charaka Samhita',
    'Sushruta Samhita',
    'Manu Smriti',
    'Arthashastra',
    'Kama Sutra',
    'Natya Shastra',
    'spiritual wisdom',
    'dharma',
    'karma',
    'moksha',
    'ancient wisdom',
    'sacred texts',
    'Hindu scriptures',
    'Indian philosophy',
    'Vedanta',
    'Advaita',
    'spiritual guidance',
    'AI spiritual advisor',
  ],
  authors: [{ name: 'MyGurukul Team' }],
  creator: 'MyGurukul',
  publisher: 'MyGurukul',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: baseUrl,
    siteName: 'MyGurukul',
    title: 'MyGurukul - Ancient Indian Wisdom & Sacred Scriptures',
    description: 'Explore authentic Sanskrit scriptures, Vedic wisdom, Upanishads, Bhagavad Gita, Ayurveda, Yoga texts, and ancient Indian spiritual literature.',
    images: [
      {
        url: `${baseUrl}/og-image.jpg`,
        width: 1200,
        height: 630,
        alt: 'MyGurukul - Ancient Indian Wisdom & Sacred Scriptures',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MyGurukul - Ancient Indian Wisdom & Sacred Scriptures',
    description: 'Explore authentic Sanskrit scriptures, Vedic wisdom, Upanishads, Bhagavad Gita, Ayurveda, Yoga texts, and ancient Indian spiritual literature.',
    images: [`${baseUrl}/og-image.jpg`],
    creator: '@mygurukul',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || '',
  },
  alternates: {
    canonical: baseUrl,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-spiritual-50 to-spiritual-100">
        <ChakraProvider>
          <div className="flex flex-col min-h-screen">
            <main className="flex-1 pb-20">
              {children}
            </main>
            <BottomNavigation />
          </div>
        </ChakraProvider>
      </body>
    </html>
  )
}
