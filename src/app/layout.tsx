import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import './globals.css'
import AppHeader from '@/components/AppHeader'
import BottomNavigation from '@/components/BottomNavigation'
import { ChakraProvider } from '@chakra-ui/react'
import { Analytics } from '@vercel/analytics/react'

export const metadata: Metadata = {
  title: 'MyGurukul - Spiritual Q&A',
  description: 'Your spiritual journey starts here. Ask questions, find wisdom, and grow with the MyGurukul community.',
  keywords: 'spiritual, Q&A, wisdom, meditation, mindfulness, gurukul',
  authors: [{ name: 'MyGurukul Team' }],
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
            <Suspense fallback={<div className="h-32 bg-white/80 border-b border-amber-200"></div>}>
              <AppHeader />
            </Suspense>
            <main className="flex-1 pb-20">
              {children}
            </main>
            <Suspense fallback={<div className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t"></div>}>
              <BottomNavigation />
            </Suspense>
          </div>
        </ChakraProvider>
        <Analytics />
      </body>
    </html>
  )
}
