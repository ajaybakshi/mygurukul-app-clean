'use client';

import React from 'react';
import { ClientTimestamp } from './ClientTimestamp';

interface UserMessageBubbleProps {
  text: string;
  timestamp: Date | string;
}

export const UserMessageBubble: React.FC<UserMessageBubbleProps> = ({ text, timestamp }) => {
  return (
    <div className="flex justify-end mb-4">
      <div className="max-w-[80%] bg-gradient-to-r from-amber-100 to-amber-50 border border-amber-200 rounded-l-lg rounded-tr-lg p-4 shadow-sm">
        <div className="text-xs font-medium text-amber-700 text-right mb-2">You</div>
        <div className="text-amber-900 text-right leading-relaxed whitespace-pre-wrap">{text}</div>
        <div className="text-xs text-amber-600 text-right mt-3">
          <ClientTimestamp timestamp={timestamp} />
        </div>
      </div>
    </div>
  );
};


