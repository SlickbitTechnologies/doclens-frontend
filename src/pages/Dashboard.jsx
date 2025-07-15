import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';

export default function Dashboard() {
  const [sourceFile, setSourceFile] = useState(null);
  const [childFiles, setChildFiles] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    // If you have auth context or tokens, clear them here
    // Example: localStorage.removeItem('token');
    navigate('/login'); // Redirect to login screen
  };

  // Refs for file inputs
  const sourceInputRef = useRef();
  const childInputRef = useRef();

  const handleFileSelect = (e, type) => {
    const files = Array.from(e.target.files);
    if (type === 'source') {
      setSourceFile(files[0]);
    } else {
      setChildFiles(prev => {
        // Combine previous and new, but limit to 6
        const combined = [...prev, ...files].slice(0, 6);
        return combined;
      });
    }
  };

  const handleBoxClick = (type) => {
    if (type === 'source') sourceInputRef.current.click();
    else childInputRef.current.click();
  };

  const beginAnalysis = async () => {
    setError('');
    setResult(null);
    if (!sourceFile || childFiles.length === 0) {
      setError('Please upload both files.');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('source', sourceFile);
      childFiles.forEach((file) => {
        formData.append('child', file); // or use unique keys if backend expects
      });

      const response = await fetch('https://doclens.gentlecoast-1594acf8.centralus.azurecontainerapps.io', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMsg = 'Server error';
        try {
          const errorData = await response.json();
          errorMsg = errorData.detail || errorMsg;
        } catch {}
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setShowUploadModal(false);
      // Build array of child file objects with name, type, and comparisonResult
      const getChildType = (filename) => {
        const types = ['USPI', 'SmPC', 'SwissPI', 'JPI', 'AUSPI', 'IPL'];
        const lower = filename.toLowerCase();
        const found = types.find(type => lower.includes(type.toLowerCase()));
        return found || 'Child';
      };
      const childFilesData = childFiles.map((file, idx) => ({
        name: file.name,
        type: getChildType(file.name),
        comparisonResult: Array.isArray(data) ? data[idx] : data // fallback for single result
      }));
      navigate('/comparison', { state: { childFiles: childFilesData } });
    } catch (err) {
      setError('Failed to analyze documents: ' + err.message);
      // Do NOT call navigate here
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 bg-white shadow-sm">
        <div className="flex items-center space-x-2">
          <span role="img" aria-label="DocLens Logo" className="text-2xl">📄</span>
          <span className="text-2xl font-bold text-teal-700">DocLens</span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-gray-700 flex items-center">
            <span className="mr-2">👤</span>{auth.currentUser?.email ? auth.currentUser.email.split('@')[0] : 'Guest'}
          </span>
          <button
            className="border border-teal-600 text-teal-700 px-4 py-1 rounded hover:bg-teal-50 font-semibold"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Welcome Section */}
      <section className="text-center py-16 bg-teal-50">
        <h1 className="text-5xl font-bold text-teal-700 mb-6">Welcome to DocLens</h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
          Professional AI-first platform for side-by-side comparison of regulatory documents. Streamline your document analysis process with advanced AI technology.
        </p>
        <button
          onClick={() => setShowUploadModal(true)}
          className="bg-teal-700 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-teal-800 transition-all duration-200 shadow-lg"
        >
          Start Document Analysis &rarr;
        </button>
      </section>

      {/* Features Section */}
      <section className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mt-12 mb-20 px-4">
        <div className="bg-white rounded-xl shadow p-6 text-center border border-gray-100">
          <div className="text-3xl mb-3">📄</div>
          <h3 className="text-lg font-semibold text-teal-700 mb-2">Document Comparison</h3>
          <p className="text-gray-600 text-sm">Side-by-side analysis of regulatory documents like CDS, USPI, SmPC, and more.</p>
        </div>
        <div className="bg-white rounded-xl shadow p-6 text-center border border-gray-100">
          <div className="text-3xl mb-3">⚡</div>
          <h3 className="text-lg font-semibold text-teal-700 mb-2">AI-Powered Analysis</h3>
          <p className="text-gray-600 text-sm">Advanced AI algorithms identify differences and generate comprehensive summaries.</p>
        </div>
        <div className="bg-white rounded-xl shadow p-6 text-center border border-gray-100">
          <div className="text-3xl mb-3">🛡️</div>
          <h3 className="text-lg font-semibold text-teal-700 mb-2">Regulatory Compliance</h3>
          <p className="text-gray-600 text-sm">Specialized for pharmaceutical and regulatory document requirements.</p>
        </div>
        <div className="bg-white rounded-xl shadow p-6 text-center border border-gray-100">
          <div className="text-3xl mb-3">📊</div>
          <h3 className="text-lg font-semibold text-teal-700 mb-2">Detailed Reports</h3>
          <p className="text-gray-600 text-sm">Export detailed comparison reports in multiple formats (PDF, Word ).</p>
        </div>
      </section>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full p-10 relative">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl font-bold focus:outline-none"
              onClick={() => setShowUploadModal(false)}
              aria-label="Close"
            >
              ×
            </button>
            <h2 className="text-2xl font-bold mb-2 text-center text-gray-900">Upload Regulatory Documents</h2>
            <p className="text-gray-500 text-center mb-8">Upload your source document (CDS) and child document (USPI, SmPC, etc.) to begin comparison</p>
            <div className="flex flex-col md:flex-row gap-6 justify-center mb-8">
              {/* Source Document Box */}
              <div
                className="flex-1 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center p-8 cursor-pointer hover:border-teal-400 transition"
                onClick={() => handleBoxClick('source')}
              >
                <div className="text-4xl mb-2">⬆️</div>
                <div className="font-bold text-lg text-gray-800 mb-1">Source Document</div>
                <div className="text-sm text-gray-500 mb-2">Core Data Sheet (CDS)</div>
                <div className="text-xs text-gray-400 mb-4">Drag and drop your CDS file here</div>
                <button
                  type="button"
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded font-medium hover:bg-gray-200 transition"
                  onClick={e => { e.stopPropagation(); handleBoxClick('source'); }}
                >
                  Browse Files
                </button>
                <input
                  type="file"
                  accept=".pdf,.docx"
                  ref={sourceInputRef}
                  className="hidden"
                  onChange={e => handleFileSelect(e, 'source')}
                />
                {sourceFile && (
                  <div className="mt-3 text-xs text-green-700 font-semibold">{sourceFile.name}</div>
                )}
              </div>
              {/* Child Document Box */}
              <div
                className="flex-1 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center p-8 cursor-pointer hover:border-teal-400 transition"
                onClick={() => handleBoxClick('child')}
              >
                <div className="text-4xl mb-2">⬆️</div>
                <div className="font-bold text-lg text-gray-800 mb-1">Child Document</div>
                <div className="text-sm text-gray-500 mb-2">USPI, SmPC, EU PI, etc.</div>
                <div className="text-xs text-gray-400 mb-4">Drag and drop your child document here</div>
                <button
                  type="button"
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded font-medium hover:bg-gray-200 transition"
                  onClick={e => { e.stopPropagation(); handleBoxClick('child'); }}
                >
                  Browse Files
                </button>
                <input
                  type="file"
                  accept=".pdf,.docx"
                  ref={childInputRef}
                  className="hidden"
                  multiple
                  onChange={e => handleFileSelect(e, 'child')}
                />
                {childFiles.length > 0 && (
                  <div className="mt-3 text-xs text-green-700 font-semibold">
                    {childFiles.map((file, idx) => (
                      <div key={idx}>{file.name}</div>
                    ))}
                  </div>
                )}
                {childFiles.length >= 6 && (
                  <div className="mt-2 text-xs text-red-600 font-semibold">Maximum 6 files allowed.</div>
                )}
              </div>
            </div>
            {/* Analyze Button */}
            {!loading && (
              <button
                onClick={beginAnalysis}
                disabled={!sourceFile || childFiles.length === 0}
                className={`w-full py-3 rounded font-semibold text-lg transition ${!sourceFile || childFiles.length === 0 ? 'bg-blue-300 text-white cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
              >
                Begin Analysis
              </button>
            )}
            {error && <div className="text-red-500 mt-4 text-center">{error}</div>}
            {/* Loader Overlay */}
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white bg-opacity-80 z-50 rounded-xl">
                <svg className="animate-spin h-12 w-12 text-blue-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
                <div className="text-blue-700 font-semibold text-lg">Analyzing...</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}