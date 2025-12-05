'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Home, MessageSquare, BookOpen } from 'lucide-react';

const tabs = [
  {
    id: 'home',
    name: 'Sacred Reading',
    icon: <Home className="w-5 h-5" />,
    href: '/',
    description: 'Begin with today\'s divine wisdom'
  },
  {
    id: 'ask',
    name: 'Spiritual Guidance',
    icon: <MessageSquare className="w-5 h-5" />,
    href: '/?tab=ask',
    description: 'Seek wisdom from ancient texts'
  },
  {
    id: 'library',
    name: 'Sacred Library',
    icon: <BookOpen className="w-5 h-5" />,
    href: '/library',
    description: 'Explore spiritual sources'
  },
];

export default function AppHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Determine active tab based on route
  let activeTab: string;
  let currentTabName: string;
  
  if (pathname === '/library' || pathname.startsWith('/library/')) {
    activeTab = 'library';
    currentTabName = 'Sacred Library';
  } else if (pathname === '/submit' || searchParams.get('tab') === 'ask') {
    activeTab = 'ask';
    currentTabName = 'Spiritual Guidance';
  } else {
    activeTab = 'home';
    currentTabName = 'Sacred Reading';
  }

  return (
    <div className="relative z-50 bg-white/80 backdrop-blur-md border-b border-amber-200 shadow-lg">
      <div className="max-w-6xl mx-auto px-6 py-4">
        {/* Top nav */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1"></div>
          
          <div className="text-center flex-1">
            <h1 className="text-2xl font-bold" style={{ color: '#D4AF37' }}>
              🕉️ MyGurukul - Spiritual Guidance
            </h1>
            <p className="text-amber-600 text-sm">
              Your journey to wisdom through ancient sacred texts
            </p>
          </div>
          
          <div className="text-amber-600 text-sm flex-1 text-right">
            Active: <span className="font-semibold">{currentTabName}</span>
          </div>
        </div>

        {/* Tab navigation with spiritual golden theme */}
        <div className="flex justify-center">
          <div className="bg-amber-100/50 backdrop-blur-sm border border-amber-200 rounded-xl p-2 shadow-md">
            <div className="flex space-x-2">
              {tabs.map((tab) => {
                const isActive = tab.id === activeTab;
                
                return (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    className={`group flex flex-col items-center space-y-1 px-4 py-3 rounded-lg transition-all duration-300 font-medium min-w-[100px] ${
                      isActive
                        ? 'bg-gradient-to-r from-amber-200 to-amber-100 text-amber-800 shadow-md transform scale-105'
                        : 'text-amber-600 hover:bg-amber-50/50 hover:text-amber-700'
                    }`}
                    style={isActive ? { color: '#D4AF37' } : {}}
                    title={tab.description}
                  >
                    <div className={`transition-all duration-300 ${
                      isActive ? 'transform scale-110' : 'group-hover:scale-105'
                    }`}>
                      {tab.icon}
                    </div>
                    <span className="text-xs text-center leading-tight">{tab.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
