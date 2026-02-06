'use client';

import React from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';

export default function AppHeader() {
  return (
    <div className="sticky top-0 z-50 bg-white/95 border-b border-amber-200 shadow-sm backdrop-blur-md app-header">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 sm:py-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-lg sm:text-xl font-bold hover:opacity-80 transition-opacity" style={{ color: '#D4AF37' }}>
            🕉️ My Gurukul
          </Link>

          <a
            href="mailto:mygurukul.ai@gmail.com"
            className="inline-flex items-center gap-1.5 text-amber-600 hover:text-amber-800 font-medium text-xs sm:text-sm transition-colors"
            style={{ color: '#D4AF37' }}
            title="Contact Us - mygurukul.ai@gmail.com"
          >
            <Mail className="w-4 h-4" />
            <span className="hidden sm:inline">Contact Us</span>
          </a>
        </div>
      </div>
    </div>
  );
}
