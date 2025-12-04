'use client';

/**
 * File Search Upload Admin UI
 * Simple interface for uploading PDFs to File Search stores
 */

import { useState, useEffect } from 'react';

interface Store {
  name: string;
  displayName: string;
  createTime?: string;
}

export default function FileSearchUploadPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Load stores on mount
  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    try {
      const response = await fetch('/api/file-search/stores/list');
      const data = await response.json();
      
      if (data.success) {
        setStores(data.stores || []);
        if (data.stores && data.stores.length > 0) {
          setSelectedStore(data.stores[0].name);
        }
      } else {
        setError('Failed to load stores: ' + data.error);
      }
    } catch (err) {
      setError('Failed to load stores: ' + (err as Error).message);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      // Auto-populate display name from filename (without extension)
      const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '');
      setDisplayName(nameWithoutExt.replace(/_/g, ' '));
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedStore) {
      setError('Please select a file and store');
      return;
    }

    setUploading(true);
    setMessage('');
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('storeName', selectedStore);
      formData.append('displayName', displayName || file.name);

      const response = await fetch('/api/file-search/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setMessage(`✅ Successfully uploaded: ${data.file.name} (${data.file.sizeMB}MB)`);
        setFile(null);
        setDisplayName('');
        // Reset file input
        const fileInput = document.getElementById('fileInput') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        setError('❌ Upload failed: ' + data.error);
      }
    } catch (err) {
      setError('❌ Upload failed: ' + (err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const createAllStores = async () => {
    if (!confirm('Create all File Search stores (Vedas, Upanishads, Darshanas, Epics, Yoga, Sastras)?')) {
      return;
    }

    setUploading(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/file-search/stores/create', {
        method: 'PUT',
      });

      const data = await response.json();

      if (data.success) {
        setMessage(`✅ ${data.message}`);
        await loadStores(); // Reload stores
      } else {
        setError('❌ Failed to create stores: ' + data.error);
      }
    } catch (err) {
      setError('❌ Failed to create stores: ' + (err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const deleteStore = async (storeName: string, displayName: string) => {
    if (!confirm(`Are you sure you want to delete "${displayName}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    setUploading(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/file-search/stores/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ storeName }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage(`✅ Successfully deleted: ${displayName}`);
        await loadStores(); // Reload stores
      } else {
        setError('❌ Failed to delete store: ' + data.error);
      }
    } catch (err) {
      setError('❌ Failed to delete store: ' + (err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            📚 File Search Upload
          </h1>
          <p className="text-gray-600">
            Upload English PDFs of sacred texts to File Search stores
          </p>
        </div>

        {/* Store Creation */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-blue-800">First Time Setup</h3>
              <p className="text-blue-700 text-sm mt-1">
                Create File Search stores for your document categories
              </p>
            </div>
            <button
              onClick={createAllStores}
              disabled={uploading || stores.length >= 6}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {stores.length >= 6 ? '✓ All Stores Created' : 'Create All Stores (6)'}
            </button>
          </div>
        </div>

        {/* Store Selection */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Select Destination Store
          </h2>
          
          {stores.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No stores found. Please create stores first using the button above.
            </div>
          ) : (
            <div className="space-y-3">
              {stores.map((store) => (
                <div
                  key={store.name}
                  className={`flex items-center justify-between p-4 border-2 rounded-lg transition-all ${
                    selectedStore === store.name
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <label className="flex items-center flex-1 cursor-pointer">
                    <input
                      type="radio"
                      name="store"
                      value={store.name}
                      checked={selectedStore === store.name}
                      onChange={(e) => setSelectedStore(e.target.value)}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-semibold text-gray-800">
                        {store.displayName}
                      </div>
                      <div className="text-sm text-gray-500 font-mono">
                        {store.name}
                      </div>
                    </div>
                  </label>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      deleteStore(store.name, store.displayName);
                    }}
                    disabled={uploading}
                    className="ml-4 px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete this store"
                  >
                    🗑️ Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* File Upload */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Upload Document
          </h2>

          {/* File Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select PDF File
            </label>
            <input
              id="fileInput"
              type="file"
              accept=".pdf,.txt,.docx"
              onChange={handleFileChange}
              disabled={uploading || !selectedStore}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
            />
            <p className="mt-1 text-sm text-gray-500">
              Supported: PDF, TXT, DOCX (max 100MB)
            </p>
          </div>

          {/* Display Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Display Name (optional)
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., Bhagavad Gita - English Translation"
              disabled={uploading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            />
            <p className="mt-1 text-sm text-gray-500">
              This name will appear in citations. Leave empty to use filename.
            </p>
          </div>

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!file || !selectedStore || uploading}
            className="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? '⏳ Uploading and Indexing...' : '📤 Upload Document'}
          </button>
        </div>

        {/* Messages */}
        {message && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
            <p className="text-green-800">{message}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-gray-100 rounded-lg p-6">
          <h3 className="font-semibold text-gray-800 mb-3">📖 Instructions</h3>
          <ol className="list-decimal list-inside space-y-2 text-gray-700 text-sm">
            <li>First time: Click &quot;Create All Stores&quot; to set up all six category stores</li>
            <li>Select the appropriate store for your document (Vedas, Upanishads, Darshanas, Epics, Yoga, or Sastras)</li>
            <li>Choose your PDF file (must be in English, max 100MB)</li>
            <li>Optionally edit the display name for better citations</li>
            <li>Click &quot;Upload Document&quot; and wait for indexing to complete (~10-30 seconds)</li>
            <li>Repeat for all your documents</li>
          </ol>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>Category Guide:</strong> Vedas (Rig, Sama, etc.) • Upanishads (Katha, Isha, etc.) • 
              Darshanas (Philosophical Systems) • Epics (Ramayana, Bhagavad Gita, Mahabharata) • 
              Yoga (Yoga Sutras, Hatha Yoga, etc.) • Sastras (Dharma, Artha, Kama, etc.)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

