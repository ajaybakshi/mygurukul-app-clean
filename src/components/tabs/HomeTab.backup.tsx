'use client';

import React, { useState } from 'react';

interface HomeTabProps {
  className?: string;
  onAsk?: (question: string) => void;
  onNavigate?: (tab: string) => void;
}

const HomeTab: React.FC<HomeTabProps> = ({ className = '', onAsk, onNavigate }) => {
  // Handle Ask Sevak submission
  const [questionText, setQuestionText] = useState('');
  
  const handleAskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (questionText.trim() && onAsk) {
      onAsk(questionText.trim());
      setQuestionText('');
    } else if (questionText.trim()) {
      console.log('Ask question:', questionText.trim());
      setQuestionText('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAskSubmit(e);
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-amber-50 via-white to-amber-50/50 ${className}`}>
      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
          
          {/* Section 1: Today's Wisdom (1 column) */}
          <div className="md:col-span-1">
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow duration-300 h-full">
              <h2 className="text-xl font-bold text-orange-800 mb-4">Today&apos;s Wisdom</h2>
              
              {/* Sanskrit Quote */}
              <div className="bg-white/60 rounded-lg p-4 border border-orange-200 mb-4">
                <p 
                  className="text-xl font-serif text-orange-900 mb-3 leading-relaxed" 
                  style={{ fontFamily: 'Noto Sans Devanagari, serif', lineHeight: '1.8' }}
                >
                  सत्यमेव जयते नानृतं
                </p>
                <p className="text-base text-orange-700 italic mb-2">
                  &quot;Satyameva Jayate Nanrtam&quot;
                </p>
                <p className="text-sm text-orange-600">
                  &quot;Truth alone triumphs; not falsehood.&quot;
                </p>
              </div>
              
              {/* Action Button */}
              <button
                onClick={() => {
                  if (onNavigate) {
                    onNavigate('wisdom');
                  } else {
                    console.log('Navigate to wisdom');
                  }
                }}
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 hover:shadow-lg"
              >
                Read Full Wisdom
              </button>
            </div>
          </div>

          {/* Section 2: Ask Sevak - Hero Action (2 columns) */}
          <div className="md:col-span-2">
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow duration-300 h-full flex flex-col">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Seek Guidance</h3>
              <form onSubmit={handleAskSubmit} className="flex-1 flex flex-col">
                <textarea
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="What seeks clarity in you today?"
                  className="w-full min-h-[100px] p-4 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200 resize-none text-gray-700 placeholder-gray-400 mb-4"
                />
                <button
                  type="submit"
                  disabled={!questionText.trim()}
                  className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 hover:shadow-lg disabled:hover:shadow-none"
                >
                  Ask Sevak
                </button>
              </form>
            </div>
          </div>

          {/* Section 3: Sacred Library Preview (1 column each) */}
          <div className="md:col-span-1">
            <button
              onClick={() => {
                if (onNavigate) {
                  onNavigate('library');
                } else {
                  console.log('Navigate to library');
                }
              }}
              className="w-full bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200 rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow duration-300 text-center"
            >
              <div className="text-4xl mb-2">📜</div>
              <h4 className="text-xl font-bold text-amber-800">Vedas</h4>
            </button>
          </div>

          <div className="md:col-span-1">
            <button
              onClick={() => {
                if (onNavigate) {
                  onNavigate('library');
                } else {
                  console.log('Navigate to library');
                }
              }}
              className="w-full bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200 rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow duration-300 text-center"
            >
              <div className="text-4xl mb-2">📖</div>
              <h4 className="text-xl font-bold text-amber-800">Upanishads</h4>
            </button>
          </div>

          <div className="md:col-span-1">
            <button
              onClick={() => {
                if (onNavigate) {
                  onNavigate('library');
                } else {
                  console.log('Navigate to library');
                }
              }}
              className="w-full bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200 rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow duration-300 text-center"
            >
              <div className="text-4xl mb-2">🕉️</div>
              <h4 className="text-xl font-bold text-amber-800">Gita</h4>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default HomeTab;

