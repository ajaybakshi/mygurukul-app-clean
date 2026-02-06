'use client';

import { useState, useEffect } from 'react';

// Full detail types for modal display
interface WisdomDetail {
  id: number;
  date: string;
  source: string;
  chapter: string | null;
  section: string | null;
  textType: string | null;
  rawText: string;
  interpretation: string;
  metadata: any;
  createdAt: string;
}

interface ConversationDetail {
  id: number;
  sessionId: string;
  question: string;
  responseNarrative: string | null;
  citations: any[] | null;
  provider: string | null;
  responseTimeMs: number | null;
  grounded: boolean;
  createdAt: string;
}

interface WisdomEntry {
  id: number;
  date: string;
  source: string;
  chapter: string;
  section: string;
  textType: string;
  rawTextPreview: string;
  interpretationPreview: string;
  createdAt: string;
}

interface ConversationEntry {
  id: number;
  sessionId: string;
  question: string;
  responsePreview: string;
  provider: string;
  responseTimeMs: number;
  grounded: boolean;
  citationsCount: number;
  createdAt: string;
}

interface MetricsHealth {
  endpoint: string;
  totalRequests: number;
  successfulRequests: number;
  successRate: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  minLatencyMs: number;
}

interface ErrorEntry {
  id: number;
  endpoint: string;
  statusCode: number;
  errorMessage: string;
  latencyMs: number;
  createdAt: string;
}

type TabType = 'wisdom' | 'conversations' | 'metrics';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('metrics');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [wisdomData, setWisdomData] = useState<{ entries: WisdomEntry[]; stats: any } | null>(null);
  const [conversationsData, setConversationsData] = useState<{ conversations: ConversationEntry[]; stats: any } | null>(null);
  const [metricsData, setMetricsData] = useState<{ health: MetricsHealth[]; recentErrors: ErrorEntry[]; summary: any; database: any } | null>(null);

  // Modal states for detail view
  const [selectedWisdom, setSelectedWisdom] = useState<WisdomDetail | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetail | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Get token from URL
  const getToken = () => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    return params.get('token') || '';
  };

  // Fetch wisdom detail for modal
  const fetchWisdomDetail = async (id: number) => {
    setModalLoading(true);
    const token = getToken();
    try {
      const res = await fetch(`/api/admin/wisdom/${id}?token=${token}`);
      if (!res.ok) throw new Error('Failed to fetch wisdom detail');
      const data = await res.json();
      setSelectedWisdom(data.data);
    } catch (err) {
      console.error('Error fetching wisdom detail:', err);
    } finally {
      setModalLoading(false);
    }
  };

  // Fetch conversation detail for modal
  const fetchConversationDetail = async (id: number) => {
    setModalLoading(true);
    const token = getToken();
    try {
      const res = await fetch(`/api/admin/conversations/${id}?token=${token}`);
      if (!res.ok) throw new Error('Failed to fetch conversation detail');
      const data = await res.json();
      setSelectedConversation(data.data);
    } catch (err) {
      console.error('Error fetching conversation detail:', err);
    } finally {
      setModalLoading(false);
    }
  };

  // Close modals
  const closeModal = () => {
    setSelectedWisdom(null);
    setSelectedConversation(null);
  };

  // Fetch data based on active tab
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      const token = getToken();

      try {
        if (activeTab === 'wisdom') {
          const res = await fetch(`/api/admin/wisdom?token=${token}`);
          if (!res.ok) throw new Error('Failed to fetch wisdom data');
          const data = await res.json();
          setWisdomData(data.data);
        } else if (activeTab === 'conversations') {
          const res = await fetch(`/api/admin/conversations?token=${token}`);
          if (!res.ok) throw new Error('Failed to fetch conversations data');
          const data = await res.json();
          setConversationsData(data.data);
        } else if (activeTab === 'metrics') {
          const res = await fetch(`/api/admin/metrics?token=${token}`);
          if (!res.ok) throw new Error('Failed to fetch metrics data');
          const data = await res.json();
          setMetricsData(data.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-amber-400">MyGurukul Admin</h1>
            <p className="text-gray-400 text-sm">API Metrics & Analytics Dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            {(['metrics', 'wisdom', 'conversations'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-amber-400 border-b-2 border-amber-400'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {tab === 'metrics' && '📊 API Metrics'}
                {tab === 'wisdom' && '🕉️ Daily Wisdom'}
                {tab === 'conversations' && '💬 Conversations'}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-amber-400"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Metrics Tab */}
        {!loading && activeTab === 'metrics' && metricsData && (
          <div className="space-y-6">
            {/* Database Status Card */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h2 className="text-lg font-semibold text-amber-400 mb-4">Database Status</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-900 rounded p-4">
                  <p className="text-gray-400 text-sm">Connection</p>
                  <p className="text-2xl font-bold text-green-400">
                    {metricsData.database?.connected ? '✓ Connected' : '✗ Disconnected'}
                  </p>
                </div>
                <div className="bg-gray-900 rounded p-4">
                  <p className="text-gray-400 text-sm">Wisdom Entries</p>
                  <p className="text-2xl font-bold text-amber-400">{metricsData.database?.tables?.daily_wisdom || 0}</p>
                </div>
                <div className="bg-gray-900 rounded p-4">
                  <p className="text-gray-400 text-sm">Conversations</p>
                  <p className="text-2xl font-bold text-blue-400">{metricsData.database?.tables?.conversations || 0}</p>
                </div>
                <div className="bg-gray-900 rounded p-4">
                  <p className="text-gray-400 text-sm">API Metrics</p>
                  <p className="text-2xl font-bold text-purple-400">{metricsData.database?.tables?.api_metrics || 0}</p>
                </div>
              </div>
            </div>

            {/* API Health Table */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h2 className="text-lg font-semibold text-amber-400 mb-4">API Health (Last 24h)</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
                      <th className="pb-3">Endpoint</th>
                      <th className="pb-3">Requests</th>
                      <th className="pb-3">Success Rate</th>
                      <th className="pb-3">Avg Latency</th>
                      <th className="pb-3">Max Latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metricsData.health.map((h, i) => (
                      <tr key={i} className="border-b border-gray-700/50">
                        <td className="py-3 font-mono text-sm">{h.endpoint}</td>
                        <td className="py-3">{h.totalRequests}</td>
                        <td className="py-3">
                          <span className={h.successRate >= 95 ? 'text-green-400' : h.successRate >= 80 ? 'text-yellow-400' : 'text-red-400'}>
                            {h.successRate}%
                          </span>
                        </td>
                        <td className="py-3">{h.avgLatencyMs}ms</td>
                        <td className="py-3">{h.maxLatencyMs}ms</td>
                      </tr>
                    ))}
                    {metricsData.health.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-500">No API metrics recorded yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Errors */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h2 className="text-lg font-semibold text-red-400 mb-4">Recent Errors</h2>
              <div className="space-y-3">
                {metricsData.recentErrors.map((e, i) => (
                  <div key={i} className="bg-gray-900 rounded p-4 border-l-4 border-red-500">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-mono text-sm">{e.endpoint}</p>
                        <p className="text-red-400 text-sm mt-1">{e.errorMessage}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-400 text-sm">{e.statusCode}</p>
                        <p className="text-gray-500 text-xs">{new Date(e.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {metricsData.recentErrors.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No recent errors 🎉</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Wisdom Tab */}
        {!loading && activeTab === 'wisdom' && wisdomData && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <p className="text-gray-400 text-sm">Total Entries</p>
                <p className="text-2xl font-bold text-amber-400">{wisdomData.stats.totalEntries}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <p className="text-gray-400 text-sm">Text Types</p>
                <p className="text-2xl font-bold text-purple-400">{wisdomData.stats.uniqueTextTypes}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <p className="text-gray-400 text-sm">First Entry</p>
                <p className="text-lg font-bold text-gray-300">{wisdomData.stats.earliestDate || 'N/A'}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <p className="text-gray-400 text-sm">Latest Entry</p>
                <p className="text-lg font-bold text-gray-300">{wisdomData.stats.latestDate || 'N/A'}</p>
              </div>
            </div>

            {/* Wisdom Entries Table */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h2 className="text-lg font-semibold text-amber-400 mb-4">Recent Wisdom Entries</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
                      <th className="pb-3">Date</th>
                      <th className="pb-3">Source</th>
                      <th className="pb-3">Type</th>
                      <th className="pb-3">Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wisdomData.entries.map((w, i) => (
                      <tr
                        key={i}
                        className="border-b border-gray-700/50 cursor-pointer hover:bg-gray-700/30 transition-colors"
                        onClick={() => fetchWisdomDetail(w.id)}
                        title="Click to view full details"
                      >
                        <td className="py-3">{w.date}</td>
                        <td className="py-3">{w.source}</td>
                        <td className="py-3">
                          <span className="px-2 py-1 bg-amber-900/30 text-amber-400 rounded text-xs">{w.textType || 'N/A'}</span>
                        </td>
                        <td className="py-3 text-gray-400 text-sm max-w-md truncate">{w.rawTextPreview}</td>
                      </tr>
                    ))}
                    {wisdomData.entries.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-gray-500">No wisdom entries yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Conversations Tab */}
        {!loading && activeTab === 'conversations' && conversationsData && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <p className="text-gray-400 text-sm">Total Conversations</p>
                <p className="text-2xl font-bold text-blue-400">{conversationsData.stats.totalConversations}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <p className="text-gray-400 text-sm">Unique Sessions (30d)</p>
                <p className="text-2xl font-bold text-green-400">{conversationsData.stats.uniqueSessions30d}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <p className="text-gray-400 text-sm">Avg per Session</p>
                <p className="text-2xl font-bold text-purple-400">
                  {conversationsData.stats.uniqueSessions30d > 0
                    ? Math.round(conversationsData.stats.totalConversations / conversationsData.stats.uniqueSessions30d)
                    : 0}
                </p>
              </div>
            </div>

            {/* Conversations Table */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h2 className="text-lg font-semibold text-blue-400 mb-4">Recent Conversations</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
                      <th className="pb-3">Time</th>
                      <th className="pb-3">Provider</th>
                      <th className="pb-3">Question</th>
                      <th className="pb-3">Latency</th>
                      <th className="pb-3">Grounded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conversationsData.conversations.map((c, i) => (
                      <tr
                        key={i}
                        className="border-b border-gray-700/50 cursor-pointer hover:bg-gray-700/30 transition-colors"
                        onClick={() => fetchConversationDetail(c.id)}
                        title="Click to view full details"
                      >
                        <td className="py-3 text-sm text-gray-400">
                          {new Date(c.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="py-3">
                          <span className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded text-xs">{c.provider}</span>
                        </td>
                        <td className="py-3 text-sm max-w-md truncate">{c.question}</td>
                        <td className="py-3">{c.responseTimeMs}ms</td>
                        <td className="py-3">
                          {c.grounded ? (
                            <span className="text-green-400">✓ {c.citationsCount}</span>
                          ) : (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {conversationsData.conversations.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-500">No conversations recorded yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Popular Questions */}
            {conversationsData.stats.popularQuestions?.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h2 className="text-lg font-semibold text-purple-400 mb-4">Popular Questions</h2>
                <div className="space-y-2">
                  {conversationsData.stats.popularQuestions.map((q: any, i: number) => (
                    <div key={i} className="flex justify-between items-center bg-gray-900 rounded p-3">
                      <p className="text-sm truncate max-w-lg">{q.question}</p>
                      <span className="text-purple-400 font-medium">{q.count}x</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-700 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-gray-500 text-sm">
          MyGurukul Admin Dashboard • Data refreshes on tab switch
        </div>
      </footer>

      {/* Wisdom Detail Modal */}
      {selectedWisdom && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div
            className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-600"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-amber-400">Wisdom Details</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            {modalLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-amber-400 mx-auto"></div>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-900 rounded p-3">
                    <p className="text-gray-400 text-xs">Date</p>
                    <p className="text-gray-100">{selectedWisdom.date}</p>
                  </div>
                  <div className="bg-gray-900 rounded p-3">
                    <p className="text-gray-400 text-xs">Source</p>
                    <p className="text-amber-400">{selectedWisdom.source}</p>
                  </div>
                  <div className="bg-gray-900 rounded p-3">
                    <p className="text-gray-400 text-xs">Chapter</p>
                    <p className="text-gray-100">{selectedWisdom.chapter || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-900 rounded p-3">
                    <p className="text-gray-400 text-xs">Type</p>
                    <p className="text-purple-400">{selectedWisdom.textType || 'N/A'}</p>
                  </div>
                </div>

                <div className="bg-gray-900 rounded p-4">
                  <h3 className="text-amber-400 font-semibold mb-2">📜 Raw Sanskrit Text</h3>
                  <p className="text-gray-200 whitespace-pre-wrap font-serif leading-relaxed">{selectedWisdom.rawText}</p>
                </div>

                <div className="bg-gray-900 rounded p-4">
                  <h3 className="text-blue-400 font-semibold mb-2">🙏 Guru&apos;s Interpretation</h3>
                  <div className="text-gray-200 whitespace-pre-wrap leading-relaxed">
                    {selectedWisdom.interpretation.split('\n\n').map((p, i) => (
                      <p key={i} className="mb-3">{p}</p>
                    ))}
                  </div>
                </div>

                {selectedWisdom.metadata && (
                  <div className="bg-gray-900 rounded p-4">
                    <h3 className="text-gray-400 font-semibold mb-2">Metadata</h3>
                    <pre className="text-gray-300 text-sm overflow-x-auto">{JSON.stringify(selectedWisdom.metadata, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conversation Detail Modal */}
      {selectedConversation && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div
            className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-600"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-blue-400">Conversation Details</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            {modalLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-400 mx-auto"></div>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-900 rounded p-3">
                    <p className="text-gray-400 text-xs">Session ID</p>
                    <p className="text-gray-100 font-mono text-sm truncate">{selectedConversation.sessionId}</p>
                  </div>
                  <div className="bg-gray-900 rounded p-3">
                    <p className="text-gray-400 text-xs">Provider</p>
                    <p className="text-blue-400">{selectedConversation.provider || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-900 rounded p-3">
                    <p className="text-gray-400 text-xs">Response Time</p>
                    <p className="text-gray-100">{selectedConversation.responseTimeMs}ms</p>
                  </div>
                  <div className="bg-gray-900 rounded p-3">
                    <p className="text-gray-400 text-xs">Grounded</p>
                    <p className={selectedConversation.grounded ? 'text-green-400' : 'text-gray-500'}>
                      {selectedConversation.grounded ? '✓ Yes' : '— No'}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-900 rounded p-4">
                  <h3 className="text-amber-400 font-semibold mb-2">❓ User Question</h3>
                  <p className="text-gray-200 whitespace-pre-wrap">{selectedConversation.question}</p>
                </div>

                <div className="bg-gray-900 rounded p-4">
                  <h3 className="text-blue-400 font-semibold mb-2">💬 AI Response</h3>
                  <div className="text-gray-200 whitespace-pre-wrap leading-relaxed">
                    {selectedConversation.responseNarrative ? (
                      selectedConversation.responseNarrative.split('\n\n').map((p, i) => (
                        <p key={i} className="mb-3">{p}</p>
                      ))
                    ) : (
                      <p className="text-gray-500 italic">No response recorded</p>
                    )}
                  </div>
                </div>

                {selectedConversation.citations && selectedConversation.citations.length > 0 && (
                  <div className="bg-gray-900 rounded p-4">
                    <h3 className="text-green-400 font-semibold mb-2">📚 Citations ({selectedConversation.citations.length})</h3>
                    <div className="space-y-2">
                      {selectedConversation.citations.map((c: any, i: number) => (
                        <div key={i} className="bg-gray-800 rounded p-3 border-l-2 border-green-500">
                          <p className="text-green-300 text-sm font-semibold">{c.source || 'Unknown Source'}</p>
                          <p className="text-gray-300 text-sm mt-1">{c.text || 'No text available'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-gray-500 text-xs text-right">
                  Created: {new Date(selectedConversation.createdAt).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
