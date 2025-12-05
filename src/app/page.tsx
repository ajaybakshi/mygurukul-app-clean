'use client';

import React, { useState, useEffect, Suspense, ErrorInfo, Component } from 'react';
import { useSearchParams } from 'next/navigation';
import { Home, MessageSquare, BookOpen, User, AlertTriangle } from 'lucide-react';

// Import SEO components
import SEOHead from '@/components/SEOHead';
import SchemaMarkup from '@/components/SchemaMarkup';
import { seoConfig } from '@/lib/seoConfig';

// Import our tab components
import HomeTab from '@/components/tabs/HomeTab';
import AskTab from '@/components/tabs/AskTab';
import LibraryPage from '@/app/(app)/library/page';
import ProfileTab from '@/components/tabs/ProfileTab';

// Import TabContext
import { TabProvider, useTabContext } from '@/contexts/TabContext';

// Tab configuration with spiritual golden theme
interface TabConfig {
  id: string;
  name: string;
  icon: React.ReactNode;
  component: React.ComponentType<any>;
  description: string;
}

const tabs: TabConfig[] = [
  {
    id: 'home',
    name: 'Sacred Reading',
    icon: <Home className="w-5 h-5" />,
    component: HomeTab,
    description: 'Begin with today\'s divine wisdom'
  },
  {
    id: 'ask',
    name: 'Spiritual Guidance',
    icon: <MessageSquare className="w-5 h-5" />,
    component: AskTab,
    description: 'Seek wisdom from ancient texts'
  },
  {
    id: 'library',
    name: 'Sacred Library',
    icon: <BookOpen className="w-5 h-5" />,
    component: LibraryPage,
    description: 'Explore spiritual sources'
  },
  // SPRINT 1: UI Restructuring - Profile/Spiritual Path tab hidden (not deleted)
  // {
  //   id: 'profile',
  //   name: 'Spiritual Path',
  //   icon: <User className="w-5 h-5" />,
  //   component: ProfileTab,
  //   description: 'Your journey and preferences'
  // }
];

// Error Boundary for individual tab components
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  tabName?: string;
}

class TabErrorBoundary extends Component<
  { children: React.ReactNode; tabName: string },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; tabName: string }) {
    super(props);
    this.state = { hasError: false, tabName: props.tabName };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Error in ${this.props.tabName}:`, error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50/50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-red-200 rounded-xl p-8 shadow-lg text-center">
            <div className="text-red-600 text-6xl mb-4">
              <AlertTriangle className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-xl font-bold text-red-800 mb-4">
              {this.state.tabName} Error
            </h3>
            <p className="text-red-600 text-sm mb-6">
              An error occurred while rendering the {this.state.tabName} component.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
              <h4 className="font-semibold text-red-800 mb-2">Error Details:</h4>
              <p className="text-red-700 text-xs font-mono break-all">
                {this.state.error?.message || 'Unknown error'}
              </p>
            </div>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors duration-200"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Inner component that uses TabContext
const SubmitPageContent: React.FC = () => {
  const tabContext = useTabContext();
  const { activeTab, switchTab, setQuestion } = tabContext;
  const searchParams = useSearchParams();
  
  // State for initial question from HomeTab
  const [initialQuestion, setInitialQuestion] = useState<string>('');

  // Sync URL params with tab state
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      // Only switch if the param differs from current activeTab to avoid loops
      if (tabParam !== activeTab) {
        console.log('[page.tsx] URL param tab=', tabParam, 'differs from activeTab=', activeTab, '- switching tab');
        switchTab(tabParam);
      } else {
        console.log('[page.tsx] URL param tab=', tabParam, 'matches activeTab - no switch needed');
      }
    }
  }, [searchParams, activeTab, switchTab]);

  const currentTab = tabs.find(tab => tab.id === activeTab);
  const CurrentComponent = currentTab?.component;

  // Debug logging
  console.log('[page.tsx] Render - activeTab:', activeTab);
  console.log('[page.tsx] currentTab found:', currentTab?.id, currentTab?.name);
  console.log('[page.tsx] CurrentComponent:', CurrentComponent?.name || 'undefined');
  
  // Verify library tab rendering
  if (activeTab === 'library') {
    console.log('[page.tsx] ✅ activeTab is "library" - LibraryPage should render');
    console.log('[page.tsx] CurrentComponent === LibraryPage?', CurrentComponent === LibraryPage);
  }

  return (
    <>
      <SEOHead
        title={seoConfig.pages.home.title}
        description={seoConfig.pages.home.description}
        url={`${seoConfig.url}${seoConfig.pages.home.path}`}
        keywords={seoConfig.keywords}
      />
      
      <SchemaMarkup type="Organization" />
      <SchemaMarkup type="WebSite" />
      <SchemaMarkup 
        type="Collection" 
        data={{
          categories: [
            'Vedas', 'Upanishads', 'Puranas', 'Ayurveda',
            'Darshanas', 'Epics', 'Poetry', 'Sastras'
          ]
        }}
      />
      
      <div className="relative bg-gradient-to-br from-amber-50 via-white to-amber-50/50 pb-20">
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

      {/* Tab content area */}
      <div className="relative z-10 pt-2 sm:pt-4">
        {CurrentComponent && (
          <TabErrorBoundary tabName={currentTab.name}>
            {activeTab === 'home' ? (
              (() => {
                console.log('[page.tsx] Rendering HomeTab');
                return (
                  <HomeTab 
                    key="home"
                    onNavigate={(tab) => switchTab(tab)}
                    onAsk={(question) => {
                      setInitialQuestion(question);
                      setQuestion(question);
                      switchTab('ask');
                    }}
                  />
                );
              })()
            ) : activeTab === 'ask' ? (
              (() => {
                console.log('[page.tsx] Rendering AskTab');
                return (
                  <AskTab 
                    key="ask"
                    initialQuestion={initialQuestion} 
                  />
                );
              })()
            ) : (
              (() => {
                console.log('[page.tsx] Rendering CurrentComponent (fallback) - activeTab:', activeTab);
                if (activeTab === 'library') {
                  console.log('[page.tsx] ✅ Rendering LibraryPage component');
                }
                return <CurrentComponent key={activeTab} />;
              })()
            )}
          </TabErrorBoundary>
        )}
        
        {!CurrentComponent && (
          <div className="min-h-screen flex items-center justify-center p-6">
            <div className="text-center">
              <div className="text-6xl mb-4">❓</div>
              <h3 className="text-xl font-bold text-amber-800 mb-2">
                Tab Not Found
              </h3>
              <p className="text-amber-600">
                The selected tab could not be loaded. Please try again.
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
    </>
  );
};

// Main page component with TabProvider - Default to "home" tab for Today's Wisdom
export default function HomePage() {
  return (
    <TabProvider initialTab="home">
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
        <SubmitPageContent />
      </Suspense>
    </TabProvider>
  );
}
