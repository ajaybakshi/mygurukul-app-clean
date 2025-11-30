'use client';

import React from 'react';
import { UserMessageBubble } from './UserMessageBubble';
import { GuideMessageBubble } from './GuideMessageBubble';

interface Message {
  id: number;
  sender: 'user' | 'ai';
  text: string;
  citations?: Array<any>;
  references?: Array<any>;
  timestamp: Date | string;
}

interface ChatMessageListProps {
  messages: Message[];
  isLoading?: boolean;
  error?: string | null;
}

export const ChatMessageList: React.FC<ChatMessageListProps> = ({ messages, isLoading, error }) => {
  if (messages.length === 0 && !isLoading && !error) {
    return (
      <div className="text-center py-12 text-amber-600">
        <span className="text-4xl mb-3 block">🕉️</span>
        <p className="font-serif text-lg">Your spiritual conversation will appear here</p>
        <p className="text-sm mt-2 text-amber-500">Ask a question to begin your journey of wisdom</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-start mb-4">
        <div className="max-w-[80%] bg-red-50 border border-red-200 rounded-r-lg rounded-tl-lg p-4">
          <div className="text-red-700 text-sm">
            <strong>Unable to get answer:</strong> {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {messages.map((message) => {
        if (message.sender === 'user') {
          return (
            <UserMessageBubble
              key={message.id}
              text={message.text}
              timestamp={message.timestamp}
            />
          );
        } else {
          return (
            <GuideMessageBubble
              key={message.id}
              answerText={message.text}
              citations={message.citations}
              references={message.references}
              timestamp={message.timestamp}
            />
          );
        }
      })}
      {isLoading && (
        <div className="flex justify-start mb-4">
          <div className="max-w-[80%] bg-gradient-to-r from-white to-blue-50 border border-blue-100 rounded-r-lg rounded-tl-lg p-4">
            <div className="flex items-center gap-2 text-blue-600">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Seeking wisdom...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

