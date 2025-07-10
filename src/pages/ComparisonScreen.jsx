import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';

const TABS = [
  { label: 'Section-Wise', value: 'section' },
  { label: 'Overall', value: 'overall' },
];

const ComparisonScreen = () => {
  const location = useLocation();
  const comparisonResult = location.state?.comparisonResult;
  const sections = comparisonResult?.sections || [];
  const [activeTab, setActiveTab] = useState('section');

  if (!comparisonResult || !Array.isArray(sections) || sections.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen text-red-600 text-lg font-semibold">
        No comparison result found.
      </div>
    );
  }

  // Export handler (CSV)
  const handleExport = () => {
    const csvRows = [
      'CDS Section,Child Section,CDS Content,Child Content,Summary',
      ...sections.map(s =>
        `"${s.cds_title || ''}","${s.child_title || ''}","${(s.cds_content || '').replace(/\n/g, ' ')}","${(s.child_content || '').replace(/\n/g, ' ')}","${(s.summary || '').replace(/\n/g, ' ')}"`
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'comparison.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Count changes for summary panel
  const countChanges = (section) => {
    let changes = 0;
    if (section.cds_content && section.child_content && section.cds_content !== section.child_content) changes++;
    if (section.cds_title && !section.child_title) changes++;
    if (!section.cds_title && section.child_title) changes++;
    return changes;
  };

  return (
    <div className="min-h-screen bg-teal-50 p-0">
      {/* Header */}
      <div className="bg-teal-700 rounded-t-xl px-6 py-3 flex items-center gap-3">
        <img src="https://img.icons8.com/fluency/48/000000/document.png" alt="DocLens" className="h-8 w-8 mr-2" />
        <span className="text-white text-2xl font-bold">DocLens</span>
      </div>
      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto bg-white rounded-b-xl shadow-lg flex flex-row mt-0">
        {/* Left: CDS & Child Columns */}
        <div className="flex-1 grid grid-cols-2 gap-4 p-6">
          {/* CDS Column */}
          <div>
            <h2 className="text-lg font-bold text-teal-700 mb-4">Core Data Sheet (CDS)</h2>
            {sections.map((section, idx) => (
              <div key={idx} className="bg-white rounded-lg p-4 mb-4 shadow border">
                <div className="font-semibold text-teal-700 mb-2">{section.cds_title || section.child_title || `Section ${idx+1}`}</div>
                {/* CDS content with green for CDS-only, pink for modified */}
                {section.cds_content && section.child_content && section.cds_content !== section.child_content ? (
                  <span className="bg-pink-50 text-pink-700 rounded p-1 text-sm font-mono">{section.cds_content}</span>
                ) : section.cds_content ? (
                  <span className="bg-green-50 text-green-700 rounded p-1 text-sm font-mono">{section.cds_content}</span>
                ) : (
                  <span className="text-gray-400 italic">No CDS content</span>
                )}
              </div>
            ))}
          </div>
          {/* Child Column */}
          <div>
            <h2 className="text-lg font-bold text-teal-700 mb-4">USPI Document</h2>
            {sections.map((section, idx) => (
              <div key={idx} className="bg-white rounded-lg p-4 mb-4 shadow border">
                <div className="font-semibold text-teal-700 mb-2">{section.child_title || section.cds_title || `Section ${idx+1}`}</div>
                {/* Child content with red for child-only, pink for modified */}
                {section.cds_content && section.child_content && section.cds_content !== section.child_content ? (
                  <span className="bg-pink-50 text-pink-700 rounded p-1 text-sm font-mono">{section.child_content}</span>
                ) : section.child_content ? (
                  <span className="bg-red-50 text-red-700 rounded p-1 text-sm font-mono">{section.child_content}</span>
                ) : (
                  <span className="text-gray-400 italic">No USPI content</span>
                )}
              </div>
            ))}
          </div>
        </div>
        {/* Right: AI Summary Panel */}
        <div className="w-[400px] border-l bg-teal-50 p-6 flex flex-col">
          <h2 className="text-lg font-bold text-teal-700 mb-4">AI Summary</h2>
          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            {TABS.map(tab => (
              <button
                key={tab.value}
                className={`px-4 py-2 rounded font-semibold border transition-all ${activeTab === tab.value ? 'bg-teal-700 text-white' : 'bg-white text-teal-700 border-teal-700'}`}
                onClick={() => setActiveTab(tab.value)}
              >
                {tab.label}
              </button>
            ))}
            <button
              className="ml-auto px-4 py-2 rounded font-semibold border border-teal-700 bg-white text-teal-700 hover:bg-teal-100"
              onClick={handleExport}
            >
              Export
            </button>
          </div>
          {/* Section Differences */}
          {activeTab === 'section' ? (
            <div>
              <h3 className="text-md font-semibold text-teal-700 mb-2">Section Differences</h3>
              <div className="flex flex-col gap-3">
                {sections.map((section, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-3 shadow border flex flex-col">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-teal-700 text-sm">
                        {section.cds_title || section.child_title || `Section ${idx+1}`}
                      </span>
                      <span className="bg-teal-100 text-teal-700 rounded px-2 py-0.5 text-xs font-semibold">
                        {countChanges(section)} changes
                      </span>
                    </div>
                    <div className="text-gray-700 text-sm">
                      {section.summary || <span className="text-gray-400">No summary</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <h3 className="text-md font-semibold text-teal-700 mb-2">Overall Summary</h3>
              <div className="bg-white rounded-lg p-4 shadow border text-gray-700 text-sm">
                {sections.map(s => s.summary).filter(Boolean).join(' ')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComparisonScreen;