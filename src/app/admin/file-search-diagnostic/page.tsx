'use client';

import { useState, useEffect } from 'react';

interface DiagnosticData {
  success: boolean;
  timestamp: string;
  summary: {
    totalStores: number;
    totalDocuments: number;
    storesReady: number;
    storesIndexing: number;
    storesEmpty: number;
    storesError: number;
  };
  stores: Array<{
    name: string;
    displayName: string;
    documentCount: number;
    status: string;
    message?: string;
    documents: Array<any>;
    recentUploads?: number;
  }>;
  recommendation: string;
}

export default function FileSearchDiagnosticPage() {
  const [data, setData] = useState<DiagnosticData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  const loadDiagnostics = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Add cache-busting to ensure real-time data
      const response = await fetch(`/api/file-search/stores/diagnose?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        }
      });
      const result = await response.json();
      
      if (result.success !== false) {
        setData(result);
        // Clear any previous errors on success
        if (result.stores && result.stores.length > 0) {
          setError('');
        }
      } else {
        setError(result.error || 'Failed to load diagnostics');
      }
    } catch (err) {
      setError('Network error: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDiagnostics();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadDiagnostics();
      }, 10000); // Refresh every 10 seconds
      
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'text-green-700 bg-green-50 border-green-200';
      case 'indexing': return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'empty': return 'text-gray-700 bg-gray-50 border-gray-200';
      case 'error': return 'text-red-700 bg-red-50 border-red-200';
      default: return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready': return '✅';
      case 'indexing': return '⏳';
      case 'empty': return '📭';
      case 'error': return '❌';
      default: return '❓';
    }
  };

  const handleDeleteDocument = async (documentName: string, displayName: string) => {
    if (!confirm(`Are you sure you want to delete "${displayName}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch('/api/file-search/documents/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ documentName })
      });

      const result = await response.json();

      if (result.success) {
        alert(`✅ Successfully deleted: ${displayName}`);
        loadDiagnostics(); // Reload to show updated list
      } else {
        alert(`❌ Failed to delete: ${result.error}`);
      }
    } catch (err) {
      alert(`❌ Error: ${(err as Error).message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                🔍 File Search Diagnostics
              </h1>
              <p className="text-gray-600">
                Check document upload and indexing status
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {data && (
                <div className="text-xs text-gray-500">
                  Last updated: {new Date(data.timestamp).toLocaleTimeString()}
                </div>
              )}
              <label className="flex items-center text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="mr-2"
                />
                Auto-refresh (10s)
              </label>
              <button
                onClick={loadDiagnostics}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Refreshing...</span>
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    <span>Refresh Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Summary */}
        {data && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Overall Summary
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-sm text-blue-700">Total Stores</div>
                <div className="text-2xl font-bold text-blue-800">
                  {data.summary.totalStores}
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-sm text-green-700">Documents Ready</div>
                <div className="text-2xl font-bold text-green-800">
                  {data.summary.totalDocuments}
                </div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="text-sm text-yellow-700">Stores Indexing</div>
                <div className="text-2xl font-bold text-yellow-800">
                  {data.summary.storesIndexing}
                </div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="text-sm text-red-700">Stores Empty/Error</div>
                <div className="text-2xl font-bold text-red-800">
                  {data.summary.storesEmpty + data.summary.storesError}
                </div>
              </div>
            </div>
            {data.recommendation && (
              <div className="mt-4 bg-blue-100 border-l-4 border-blue-500 p-4 text-blue-800">
                <p className="font-semibold">Recommendation:</p>
                <p>{data.recommendation}</p>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <p className="text-red-800 font-semibold">Error:</p>
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Store Details */}
        {loading && !data && (
          <div className="text-center py-12 text-gray-500 text-lg">
            Loading diagnostics...
          </div>
        )}

        {data && data.stores && data.stores.length > 0 && (
          <>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Store Details ({data.stores.length} stores)
            </h2>
            <div className="space-y-6">
              {data.stores.map((store, index) => (
                <div key={index} className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{getStatusIcon(store.status)}</span>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">
                          {store.displayName}
                        </h3>
                        <p className="text-sm text-gray-500 font-mono">
                          {store.name}
                        </p>
                      </div>
                    </div>
                    <div className={`px-4 py-2 rounded-lg border-2 ${getStatusColor(store.status)}`}>
                      <span className="font-semibold uppercase text-sm">
                        {store.status}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="text-sm text-gray-600">Documents in Store</div>
                      <div className="text-2xl font-bold text-gray-800">
                        {store.documentCount}
                      </div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="text-sm text-gray-600">Recent Uploads</div>
                      <div className="text-2xl font-bold text-gray-800">
                        {store.recentUploads || 0}
                      </div>
                    </div>
                  </div>

                  {store.message && (
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-3 mb-4">
                      <p className="text-sm text-blue-800">{store.message}</p>
                    </div>
                  )}

                  {('pendingOperations' in store && (store as any).pendingOperations > 0) && (
                    <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 mb-4">
                      <p className="text-sm text-yellow-800 font-semibold">
                        ⏳ {(store as any).pendingOperations} upload operation(s) still processing
                      </p>
                      <p className="text-xs text-yellow-700 mt-1">
                        Documents will appear here once indexing completes (usually 2-5 minutes)
                      </p>
                    </div>
                  )}

                  {store.queryError && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-3 mb-4">
                      <p className="text-sm text-red-800 font-semibold">Query Error:</p>
                      <p className="text-xs text-red-700">{store.queryError}</p>
                    </div>
                  )}

                  {store.documents && store.documents.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-semibold text-gray-700 mb-2">
                        📄 Recent Files ({store.documents.length})
                      </h4>
                      <div className="space-y-2">
                        {store.documents.map((doc: any, docIndex: number) => (
                          <div key={docIndex} className="bg-gray-50 p-3 rounded text-sm">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-semibold text-gray-800">
                                  {doc.displayName || doc.name}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {doc.mimeType} • {(doc.sizeBytes / 1024).toFixed(1)} KB
                                </div>
                                {doc.name && (
                                  <div className="text-xs text-gray-400 font-mono mt-1">
                                    {doc.name}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <div className={`px-2 py-1 rounded text-xs ${
                                  doc.state === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                                  doc.state === 'PROCESSING' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {doc.state || 'INDEXED'}
                                </div>
                                <button
                                  onClick={() => handleDeleteDocument(doc.name, doc.displayName || doc.name)}
                                  className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                                  title="Delete this document"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                            {doc.error && (
                              <div className="mt-2 text-xs text-red-600">
                                Error: {doc.error}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
