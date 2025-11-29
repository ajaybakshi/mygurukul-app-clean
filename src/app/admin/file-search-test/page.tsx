'use client';

/**
 * File Search Test Admin UI
 * Test and verify File Search functionality
 */

import { useState } from 'react';

export default function FileSearchTestPage() {
  const [testResults, setTestResults] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [queryText, setQueryText] = useState('What is dharma?');
  const [queryResult, setQueryResult] = useState<any>(null);
  const [querying, setQuerying] = useState(false);

  const runTests = async () => {
    setTesting(true);
    setTestResults(null);

    try {
      const response = await fetch('/api/file-search/test');
      const data = await response.json();
      setTestResults(data);
    } catch (error) {
      setTestResults({
        overall: 'error',
        error: (error as Error).message
      });
    } finally {
      setTesting(false);
    }
  };

  const runQuery = async () => {
    setQuerying(true);
    setQueryResult(null);

    try {
      const response = await fetch('/api/wisdom/file-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: queryText,
          category: 'all'
        })
      });

      const data = await response.json();
      setQueryResult(data);
    } catch (error) {
      setQueryResult({
        success: false,
        error: (error as Error).message
      });
    } finally {
      setQuerying(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'text-green-600 bg-green-50';
      case 'failed': return 'text-red-600 bg-red-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'skipped': return 'text-gray-600 bg-gray-50';
      default: return 'text-blue-600 bg-blue-50';
    }
  };

  const getOverallBadge = (overall: string) => {
    switch (overall) {
      case 'passed': return '✅ All Tests Passed';
      case 'failed': return '❌ Some Tests Failed';
      case 'partial': return '⚠️ Partial Success';
      case 'error': return '🔥 Test Error';
      default: return '⏳ Testing...';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            🧪 File Search Testing Suite
          </h1>
          <p className="text-gray-600">
            Verify that File Search is properly configured and working
          </p>
        </div>

        {/* System Tests */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800">
              System Tests
            </h2>
            <button
              onClick={runTests}
              disabled={testing}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {testing ? '⏳ Running Tests...' : '▶ Run All Tests'}
            </button>
          </div>

          {testResults && (
            <div>
              {/* Overall Status */}
              <div className={`p-4 rounded-lg mb-4 font-semibold text-center ${
                testResults.overall === 'passed' ? 'bg-green-100 text-green-800' :
                testResults.overall === 'failed' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {getOverallBadge(testResults.overall)}
              </div>

              {/* Summary */}
              {testResults.summary && (
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-2xl font-bold text-gray-800">{testResults.summary.total}</div>
                    <div className="text-sm text-gray-600">Total</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded">
                    <div className="text-2xl font-bold text-green-600">{testResults.summary.passed}</div>
                    <div className="text-sm text-gray-600">Passed</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded">
                    <div className="text-2xl font-bold text-red-600">{testResults.summary.failed}</div>
                    <div className="text-sm text-gray-600">Failed</div>
                  </div>
                  <div className="text-center p-3 bg-yellow-50 rounded">
                    <div className="text-2xl font-bold text-yellow-600">{testResults.summary.warnings}</div>
                    <div className="text-sm text-gray-600">Warnings</div>
                  </div>
                </div>
              )}

              {/* Individual Tests */}
              <div className="space-y-3">
                {testResults.tests?.map((test: any, index: number) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-800">{test.name}</h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(test.status)}`}>
                        {test.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <pre className="bg-gray-50 p-3 rounded overflow-auto">
                        {JSON.stringify(test.details, null, 2)}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Live Query Test */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Live Query Test
          </h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Test Question
            </label>
            <input
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Enter a question..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={runQuery}
            disabled={querying || !queryText}
            className="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors mb-4"
          >
            {querying ? '⏳ Querying...' : '🔍 Test Query'}
          </button>

          {queryResult && (
            <div className="border border-gray-200 rounded-lg p-4">
              {queryResult.success ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-green-600 font-semibold">✅ Query Successful</span>
                    <span className="text-sm text-gray-600">
                      {queryResult.data.metadata.responseTime}ms
                    </span>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-800 mb-2">Response:</h4>
                    <div className="bg-gray-50 p-4 rounded max-h-96 overflow-auto">
                      {queryResult.data.narrative}
                    </div>
                  </div>

                  {queryResult.data.citations.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-2">
                        Citations ({queryResult.data.citations.length}):
                      </h4>
                      <div className="space-y-2">
                        {queryResult.data.citations.map((citation: any, index: number) => (
                          <div key={index} className="bg-blue-50 p-3 rounded text-sm">
                            <div className="font-semibold text-blue-800 mb-1">
                              {citation.source}
                            </div>
                            <div className="text-gray-700">
                              {citation.text.substring(0, 200)}...
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-red-600">
                  ❌ Query Failed: {queryResult.error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="bg-gray-100 rounded-lg p-6">
          <h3 className="font-semibold text-gray-800 mb-3">🔗 Quick Links</h3>
          <div className="space-y-2">
            <a href="/api/file-search/config/test" target="_blank" className="block text-blue-600 hover:underline">
              → Configuration Test API
            </a>
            <a href="/api/file-search/stores/list" target="_blank" className="block text-blue-600 hover:underline">
              → List Stores API
            </a>
            <a href="/admin/file-search-upload" className="block text-blue-600 hover:underline">
              → Upload Documents
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}



