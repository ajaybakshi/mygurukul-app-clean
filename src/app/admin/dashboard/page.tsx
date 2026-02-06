'use client';

import { useState, useEffect } from 'react';

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

  // Get token from URL
  const getToken = () => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    return params.get('token') || '';
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
                      <tr key={i} className="border-b border-gray-700/50">
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
                      <tr key={i} className="border-b border-gray-700/50">
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
    </div>
  );
}
