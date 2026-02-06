import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import { Inter, Playfair_Display, Martel, Noto_Sans_Devanagari } from 'next/font/google'
import './globals.css'
import { seoConfig } from '@/lib/seoConfig'
import AppHeader from '@/components/AppHeader'
import BottomNavigation from '@/components/BottomNavigation'
import { Analytics } from '@vercel/analytics/react'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
  weight: ['400', '600', '700'],
})

const martel = Martel({
  subsets: ['latin', 'devanagari'],
  variable: '--font-martel',
  display: 'swap',
  weight: ['400', '600', '700'],
})

const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  variable: '--font-devanagari',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: seoConfig.title,
  description: seoConfig.description,
  keywords: seoConfig.keywords,
  authors: [{ name: seoConfig.author }],
  metadataBase: new URL('https://www.mygurukul.org'),
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    title: seoConfig.title,
    description: seoConfig.description,
    url: seoConfig.url,
    siteName: 'MyGurukul',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: seoConfig.title,
    description: seoConfig.description,
    creator: '@mygurukul',
    site: '@mygurukul',
  },
  verification: {
    google: 'O2_cqCi1Hsvodgl0uJuyz1ezFKVqEJlrf6ULF8rHIwc',
  },
  other: {
    'theme-color': '#D4AF37',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} ${martel.variable} ${notoDevanagari.variable}`}>
      <body className="min-h-screen bg-gradient-to-br from-spiritual-50 to-spiritual-100 font-sans">
        <div className="flex flex-col min-h-screen">
          <Suspense fallback={<div className="h-12 bg-white/80 border-b border-amber-200"></div>}>
            <AppHeader />
          </Suspense>
          <main className="flex-1 pb-20">
            {children}
          </main>
          <Suspense fallback={<div className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t"></div>}>
            <BottomNavigation />
          </Suspense>
        </div>
        <Analytics />
      </body>
    </html>
  )
}
