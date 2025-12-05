'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Home, MessageCircle, BookOpen, User } from 'lucide-react'

export default function BottomNavigation() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const navItems = [
    {
      href: '/',
      icon: Home,
      label: 'Home',
      id: 'home'
    },
    {
      href: '/?tab=ask',
      icon: MessageCircle,
      label: 'Ask Sevak',
      id: 'ask'
    },
    {
      href: '/library',
      icon: BookOpen,
      label: 'Library',
      id: 'library'
    },
    // SPRINT 1: UI Restructuring - Profile tab hidden (not deleted)
    // {
    //   href: '/profile',
    //   icon: User,
    //   label: 'Profile'
    // }
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bottom-nav z-50">
      <div className="flex items-center justify-around px-4 py-2">
        {navItems.map((item) => {
          const Icon = item.icon
          
          // Determine active state based on route and query params
          let isActive = false;
          if (item.id === 'ask') {
            // For Ask Sevak, check if tab=ask is in URL or pathname is /submit
            isActive = searchParams.get('tab') === 'ask' || pathname === '/submit';
          } else if (item.id === 'library') {
            // For Library, check if pathname starts with /library
            isActive = pathname === '/library' || pathname.startsWith('/library/');
          } else {
            // For Home, check if pathname is exactly /
            isActive = pathname === '/' && searchParams.get('tab') !== 'ask';
          }
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center py-2 px-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-spiritual-600 bg-spiritual-50'
                  : 'text-spiritual-400 hover:text-spiritual-600 hover:bg-spiritual-25'
              }`}
            >
              <Icon className={`w-6 h-6 mb-1 ${isActive ? 'text-spiritual-600' : 'text-spiritual-400'}`} />
              <span className={`text-xs font-medium ${isActive ? 'text-spiritual-600' : 'text-spiritual-400'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
