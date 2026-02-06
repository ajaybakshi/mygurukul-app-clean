'use client';

import React from 'react';

interface SkeletonProps {
  className?: string;
}

/** Base shimmer skeleton block with amber spiritual theme */
export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div
    className={`rounded-lg bg-gradient-to-r from-amber-100 via-amber-50 to-amber-100 animate-pulse ${className}`}
  />
);

/** Skeleton mimicking the Sacred Reading scripture card layout */
export const WisdomSkeleton: React.FC = () => (
  <div className="max-w-4xl mx-auto pt-6 sm:pt-8 pb-6 px-6 space-y-8">
    {/* Source badge */}
    <div className="flex justify-center">
      <Skeleton className="h-8 w-48" />
    </div>
    {/* Tab toggle */}
    <div className="flex justify-center">
      <Skeleton className="h-10 w-64 rounded-full" />
    </div>
    {/* Main card */}
    <div className="bg-white/80 rounded-2xl border border-amber-200 p-8 space-y-6 shadow-lg">
      {/* Title line */}
      <Skeleton className="h-6 w-3/4 mx-auto" />
      {/* Sanskrit text block */}
      <div className="space-y-3 py-4">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-5/6" />
        <Skeleton className="h-5 w-4/5" />
      </div>
      {/* Divider */}
      <Skeleton className="h-px w-full bg-amber-200" />
      {/* Translation block */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      {/* Reference badge */}
      <div className="flex justify-center pt-2">
        <Skeleton className="h-7 w-40 rounded-full" />
      </div>
    </div>
  </div>
);

/** Skeleton mimicking an AI chat typing indicator */
export const ChatTypingSkeleton: React.FC = () => (
  <div className="flex justify-start mb-4">
    <div className="max-w-[80%] bg-gradient-to-r from-white to-blue-50 border border-blue-100 rounded-r-lg rounded-tl-lg p-4">
      <div className="text-xs font-medium text-blue-600 mb-3 flex items-center gap-2">
        <span>🕉️</span>
        <span>Spiritual Guide</span>
      </div>
      <div className="space-y-2.5">
        <Skeleton className="h-3.5 w-72 !bg-gradient-to-r !from-blue-100 !via-blue-50 !to-blue-100" />
        <Skeleton className="h-3.5 w-56 !bg-gradient-to-r !from-blue-100 !via-blue-50 !to-blue-100" />
        <Skeleton className="h-3.5 w-64 !bg-gradient-to-r !from-blue-100 !via-blue-50 !to-blue-100" />
      </div>
      <div className="flex items-center gap-1.5 mt-4">
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  </div>
);

/** Skeleton mimicking library accordion items */
export const LibrarySkeleton: React.FC = () => (
  <div className="space-y-4">
    {[1, 2, 3, 4].map((i) => (
      <div
        key={i}
        className="bg-white/80 border border-amber-200 rounded-xl p-6 shadow-lg"
      >
        <div className="flex items-center space-x-3 mb-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-6 w-48" />
        </div>
        <Skeleton className="h-4 w-3/4 mb-3" />
        <div className="flex items-center space-x-4">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-28 rounded-full" />
        </div>
      </div>
    ))}
  </div>
);
