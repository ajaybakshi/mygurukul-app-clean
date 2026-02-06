'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { BookText, MessageCircle, BookOpen } from 'lucide-react'

export default function BottomNavigation() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const navItems = [
    {
      href: '/?view=wisdom',
      icon: BookText,
      label: 'Sacred Reading',
      id: 'reading'
    },
    {
      href: '/?tab=ask',
      icon: MessageCircle,
      label: 'Spiritual Guidance',
      id: 'ask'
    },
    {
      href: '/library',
      icon: BookOpen,
      label: 'Sacred Library',
      id: 'library'
    },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bottom-nav z-50">
      <div className="flex items-center justify-evenly px-2 py-2">
        {navItems.map((item) => {
          const Icon = item.icon

          let isActive = false;
          if (item.id === 'reading') {
            // Sacred Reading: home page without tab param, OR with view=wisdom
            isActive = pathname === '/' && (!searchParams.get('tab') || searchParams.get('view') === 'wisdom');
          } else if (item.id === 'ask') {
            isActive = (pathname === '/' && searchParams.get('tab') === 'ask') || pathname === '/submit';
          } else if (item.id === 'library') {
            isActive = pathname === '/library' || pathname.startsWith('/library/');
          }

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 py-2 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-spiritual-600 bg-spiritual-50'
                  : 'text-spiritual-400 hover:text-spiritual-600 hover:bg-spiritual-25'
              }`}
            >
              <Icon className={`w-6 h-6 mb-1 ${isActive ? 'text-spiritual-600' : 'text-spiritual-400'}`} />
              <span className={`text-xs font-medium text-center leading-tight ${isActive ? 'text-spiritual-600' : 'text-spiritual-400'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
