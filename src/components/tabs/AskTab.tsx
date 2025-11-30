'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, RefreshCw, ArrowLeft } from 'lucide-react';
import {
  callWisdomEngine,
  DiscoveryEngineResponse,
  DiscoveryEngineError,
} from "@/lib/discoveryEngine";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { categoryService } from "@/lib/database/categoryService";
import { TopicCategory } from "@/types/categories";
import { useTabContext } from '@/contexts/TabContext';

// Initialize categories directly
const initialCategories = categoryService.getCategories();

interface AskTabProps {
  className?: string;
  initialQuestion?: string;
  onBack?: () => void;
}

const AskTab: React.FC<AskTabProps> = ({ className = '', initialQuestion, onBack }) => {
  // Use TabContext for state management
  const {
    question,
    category,
    isSubmitting,
    aiResponse,
    isLoadingAI,
    aiError,
    sessionId,
    showValidationError,
    messages,
    wisdomContext,
    setQuestion,
    setCategory,
    setIsSubmitting,
    setAiResponse,
    setIsLoadingAI,
    setAiError,
    setSessionId,
    setShowValidationError,
    addMessage,
    clearMessages,
    clearSession
  } = useTabContext();

  const [categories, setCategories] = useState<TopicCategory[]>(initialCategories);
  const [isClient, setIsClient] = useState(false);

  // Refs for chat container and messages
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageCount = useRef<number>(0);
  const lastAIMessageId = useRef<number | null>(null);

  // Scroll behavior: Only scroll when user sends a message
  // For AI responses, don't auto-scroll - let reader read from the top at their own pace
  useEffect(() => {
    const currentMessageCount = messages.length;
    const lastAIMessage = messages.filter(m => m.sender === 'ai').slice(-1)[0];
    
    // Only scroll if user just sent a new message (message count increased and last message is from user)
    if (currentMessageCount > lastMessageCount.current) {
      const lastMessage = messages[messages.length - 1];
      
      if (lastMessage.sender === 'user') {
        // User sent a new message - scroll to show it briefly, then allow natural reading
        if (chatContainerRef.current) {
          // Small delay to let message render, then scroll
          setTimeout(() => {
            if (chatContainerRef.current) {
              chatContainerRef.current.scrollTo({
                top: chatContainerRef.current.scrollHeight,
                behavior: "smooth"
              });
            }
          }, 100);
        }
      } else if (lastMessage.sender === 'ai' && lastMessage.id !== lastAIMessageId.current) {
        // New AI message added - don't auto-scroll, keep current position
        // This allows reader to see the answer from the top and scroll at their own pace
        lastAIMessageId.current = lastMessage.id;
        // Explicitly do NOT scroll - maintain current scroll position
      }
      
      lastMessageCount.current = currentMessageCount;
    }
  }, [messages]);

  // Fix hydration mismatch by ensuring client-side rendering
  useEffect(() => {
    setIsClient(true);
    
    // Handle initial question from HomeTab
    if (initialQuestion) {
      setQuestion(initialQuestion);
    } else if (wisdomContext) {
      // Handle wisdom context from HomeTab (prop drilling)
      const contextMessage = `I just read today's wisdom from ${wisdomContext.sourceName}: "${wisdomContext.rawText.substring(0, 100)}..." Can you help me understand how to apply this to my life?`;
      setQuestion(contextMessage);
    } else {
      // Fallback: Check for wisdom data in sessionStorage (backwards compatibility)
      const storedWisdom = sessionStorage.getItem('homeTabWisdom');
      if (storedWisdom) {
        try {
          const wisdomData = JSON.parse(storedWisdom);
          const contextMessage = `I just read today's wisdom from ${wisdomData.sourceName}: "${wisdomData.rawText.substring(0, 100)}..." Can you help me understand how to apply this to my life?`;
          setQuestion(contextMessage);
          sessionStorage.removeItem('homeTabWisdom'); // Clean up
        } catch (error) {
          console.error('Error parsing wisdom data:', error);
        }
      }
    }
  }, [initialQuestion, wisdomContext, setQuestion]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) {
      setShowValidationError(true);
      setTimeout(() => setShowValidationError(false), 3000);
      return;
    }

    setShowValidationError(false);
    setIsSubmitting(true);
    setIsLoadingAI(true);
    setAiError(null);
    setAiResponse(null);

    try {
      // Add user question to message history
      const userMessage = {
        id: Date.now(),
        sender: "user" as const,
        text: question,
        timestamp: new Date(),
      };
      addMessage(userMessage);

      // Extract last 4 messages (2 Q&A pairs) for conversation context
      const conversationHistory = messages
        .slice(-4)
        .map(m => ({ sender: m.sender, text: m.text }));

      if (process.env.NODE_ENV === 'development') {
        console.log("Sending request with sessionId:", sessionId, "and category:", category);
        console.log("Including conversation history:", conversationHistory.length, "messages");
      }
      
      const response = await callWisdomEngine(
        question,
        sessionId || undefined,
        category,
        conversationHistory
      );
      
      if (process.env.NODE_ENV === 'development') {
        console.log("Received response with sessionId:", response.sessionId);
      }
      
      setAiResponse(response);

      // Add AI response to message history with full response data
      if (response.answer && response.answer.answerText) {
        if (process.env.NODE_ENV === 'development') {
          console.log('📝 Creating AI message:', {
            hasAnswerText: !!response.answer.answerText,
            answerTextLength: response.answer.answerText.length,
            hasCitations: !!response.answer.citations,
            citationsCount: response.answer.citations?.length || 0,
            hasReferences: !!response.answer.references,
            referencesCount: response.answer.references?.length || 0
          });
        }
        
        const aiMessage = {
          id: Date.now() + 1,
          sender: "ai" as const,
          text: response.answer.answerText,
          citations: response.answer.citations,
          references: response.answer.references,
          timestamp: new Date(),
        };
        
        try {
          addMessage(aiMessage);
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ AI message added to history');
          }
        } catch (error) {
          console.error('❌ Error adding AI message:', error);
        }
      } else {
        console.warn('⚠️ Response missing answer or answerText:', {
          hasAnswer: !!response.answer,
          hasAnswerText: !!response.answer?.answerText
        });
      }

      // Extract and store session ID from response
      if (response.sessionId) {
        setSessionId(response.sessionId);
        if (process.env.NODE_ENV === 'development') {
          console.log("Updated sessionId from response:", response.sessionId);
        }
      }

      // Clear the question input after successful submission
      setQuestion("");
    } catch (error) {
      if (error instanceof DiscoveryEngineError) {
        setAiError(error.message);
        if (error.message.includes("session")) {
          setSessionId(null);
        }
      } else if (error instanceof Error) {
        setAiError(error.message);
      } else {
        setAiError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
      setIsLoadingAI(false);
    }
  };

  const handleNewConversation = () => {
    clearSession();
    setQuestion("");
  };

  // Enhanced Category Dropdown Component
  const CategoryDropdown = () => {
    const selectedCategory = categories.find((cat) => cat.id === category);

    return (
      <div className="relative">
        <label className="block text-lg font-semibold text-amber-800 mb-4">
          Spiritual Category
        </label>

        <div className="relative">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full p-4 sm:p-5 border border-amber-300 rounded-xl bg-gradient-to-r from-amber-50 to-white text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-base touch-manipulation transition-all duration-200 hover:border-amber-400 hover:shadow-md appearance-none cursor-pointer"
            style={{ color: '#D4AF37' }}
          >
            <option value="">Select a spiritual category...</option>
            {categories.map((cat) => (
              <option
                key={cat.id}
                value={cat.id}
                className="py-3 px-4 hover:bg-amber-50 transition-colors duration-200"
              >
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Selected category indicator */}
        {selectedCategory && (
          <div className="mt-3 flex items-center space-x-3">
            <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-amber-700 font-medium">
              Selected: {selectedCategory.name}
            </span>
            {selectedCategory.description && (
              <span className="text-xs text-amber-600">
                - {selectedCategory.description}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-amber-50 via-white to-amber-50/50 ${className}`}>
      {/* Sacred background pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div 
          className="w-full h-full"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 80%, rgba(212, 175, 55, 0.1) 0%, transparent 50%),
                             radial-gradient(circle at 80% 20%, rgba(212, 175, 55, 0.1) 0%, transparent 50%),
                             radial-gradient(circle at 40% 40%, rgba(212, 175, 55, 0.05) 0%, transparent 50%)`
          }}
        />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 60px)', minHeight: 0 }}>
        {/* Back Button - shown when onBack is provided */}
        {onBack && (
          <div className="flex-shrink-0 mb-2">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-amber-700 hover:text-amber-800 font-medium transition-colors"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              <ArrowLeft size={18} />
              <span>← Back to Home</span>
            </button>
          </div>
        )}

        {/* Header */}
        <div className="text-center py-2 flex-shrink-0">
          <div className="text-3xl mb-2">💬</div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: '#D4AF37' }}>
            Ask for Spiritual Guidance
          </h1>
          <p className="text-amber-600 text-sm">
            Seek wisdom from ancient spiritual texts and receive AI-powered guidance
          </p>

          {/* Wisdom Context Indicator */}
          {wisdomContext && (
            <div className="mt-6">
              <div className="inline-flex items-center bg-gradient-to-r from-blue-50 to-blue-100/50 px-4 py-2 rounded-full border border-blue-200/50 shadow-sm">
                <span className="text-lg mr-2">🕉️</span>
                <span className="text-base text-blue-700 font-medium">
                  Discussing today&apos;s wisdom from {wisdomContext.sourceName}
                </span>
              </div>
            </div>
          )}

          {/* Session Status Indicator */}
          {sessionId && (
            <div className="mt-4">
              <div className="inline-flex items-center bg-gradient-to-r from-amber-50 to-amber-100/50 px-4 py-2 rounded-full border border-amber-200/50 shadow-sm">
                <span className="w-3 h-3 bg-amber-500 rounded-full mr-3 animate-pulse"></span>
                <span className="text-base text-amber-700 font-medium">
                  Continuing conversation
                </span>
                <span className="ml-2 text-sm text-amber-600">
                  ({sessionId.length > 20 ? `${sessionId.substring(0, 8)}...` : sessionId})
                </span>
              </div>
            </div>
          )}

          {/* New Conversation Button */}
          {sessionId && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={handleNewConversation}
                className="inline-flex items-center bg-gradient-to-r from-amber-500 to-amber-600 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 hover:from-amber-600 hover:to-amber-700 hover:shadow-lg hover:scale-105 shadow-md"
                title="Start a new conversation"
              >
                <RefreshCw className="w-5 h-5 mr-2" />
                <span>New Conversation</span>
              </button>
            </div>
          )}
        </div>

        {/* Input Area - Above Chat */}
        <div className="bg-white/80 backdrop-blur-sm p-3 flex-shrink-0 border-b border-amber-200">
          <form onSubmit={handleSubmit} className="space-y-2">
            {/* Category Dropdown - Hidden for now */}
            {/* <CategoryDropdown /> */}

            <div className="border border-amber-200 rounded-lg p-2 shadow-sm">
              <label className="block text-sm font-semibold text-amber-800 mb-1">
                Your Spiritual Question
              </label>
              <textarea
                key="question-textarea"
                value={isClient ? question : ""}
                onChange={(e) => {
                  setQuestion(e.target.value);
                  setShowValidationError(false);
                }}
                placeholder="Share your spiritual question or concern..."
                className="w-full p-2 border border-amber-300 rounded-lg bg-gradient-to-r from-white to-amber-50/30 text-amber-900 placeholder-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none transition-all duration-200 hover:border-amber-400 text-sm leading-relaxed"
                rows={1}
                maxLength={500}
              />
              <div className="flex items-center justify-between mt-1">
                <div className="text-xs text-amber-600">
                  {question.length}/500
                </div>
                <button
                  key="submit-button"
                  type="submit"
                  disabled={isSubmitting || !isClient || !question.trim()}
                  className="bg-gradient-to-r from-amber-500 to-amber-600 text-white py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:from-amber-600 hover:to-amber-700 hover:shadow-md touch-manipulation text-sm font-semibold border border-amber-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-opacity-50 flex items-center gap-2"
                  aria-label="Submit spiritual question for AI guidance"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Seeking...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Ask</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Validation Error Message */}
            {showValidationError && (
              <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs text-center animate-pulse">
                Please enter your question before seeking guidance.
              </div>
            )}
          </form>
        </div>

        {/* Chat Area - Scrollable */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto px-4 py-6"
          style={{ 
            maxHeight: '100%',
            minHeight: 0 // Important for flex children to respect parent constraints
          }}
        >
          <ChatMessageList messages={messages} isLoading={isLoadingAI} error={aiError} />
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
};

export default AskTab;
