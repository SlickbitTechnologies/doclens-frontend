import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
const ComparisonScreen = () => {
  const location = useLocation();
  const comparisonResult = location.state?.comparisonResult;
  const childFileName = location.state?.childFileName;

  // Extract type from child file name (robust)
  const getChildType = (filename) => {
    if (!filename) return 'Child';
    const types = ['USPI', 'SmPC', 'SwissPI', 'JPI', 'AUSPI', 'IPL'];
    const lower = filename.toLowerCase();
    const found = types.find(type => lower.includes(type.toLowerCase()));
    return found || 'Child';
  };
  const childType = getChildType(childFileName);
  // Debug: log the file name and detected type
  console.log('Child file name:', childFileName, 'Detected type:', childType);
  const matchedPairs = comparisonResult?.matched_pairs || [];
  const cdsSections = comparisonResult?.cds_sections || [];
  const childSections = comparisonResult?.child_sections || [];
  const sectionComparisons = comparisonResult?.section_comparisons || [];
  const [activeTab, setActiveTab] = useState('section');

  // Build maps for quick lookup
  const matchedByCdsTitle = Object.fromEntries(matchedPairs.map(pair => [pair.cds_title, pair.child_title]));
  const matchedByChildTitle = Object.fromEntries(matchedPairs.map(pair => [pair.child_title, pair.cds_title]));
  const childSectionMap = Object.fromEntries(childSections.map(sec => [sec.title, sec]));
  const cdsSectionMap = Object.fromEntries(cdsSections.map(sec => [sec.title, sec]));

  // Track which USPI sections have already been matched
  const matchedChildTitles = new Set(matchedPairs.map(pair => pair.child_title));

  // Build rows: for each CDS section, show its match if any, else blank; then add unmatched USPI sections
  const rows = [];
  cdsSections.forEach((cdsSec, idx) => {
    const matchedChildTitle = matchedByCdsTitle[cdsSec.title];
    const childSec = matchedChildTitle ? childSectionMap[matchedChildTitle] : null;
    rows.push({
      cds: cdsSec,
      child: childSec || null
    });
  });
  // Add unmatched USPI sections
  childSections.forEach((childSec) => {
    if (!matchedByChildTitle[childSec.title]) {
      rows.push({
        cds: null,
        child: childSec
      });
    }
  });

  if (!comparisonResult || (cdsSections.length === 0 && childSections.length === 0)) {
    return (
      <div className="flex items-center justify-center h-screen text-red-600 text-lg font-semibold">
        No comparison result found.
      </div>
    );
  }

  // Dynamic data for overall summary based on sectionComparisons
  const totalDifferences = sectionComparisons.reduce((sum, s) => sum + (s.change_count || 0), 0);
  const sectionsAffected = sectionComparisons.filter(s => s.change_count > 0).length;
  const summaryOfChanges = sectionComparisons
    .filter(s => s.change_count > 0 && s.summary)
    .map(s => s.summary);

  return (
    <div className="min-h-screen bg-teal-50 p-0">
      {/* Header */}
      <div className="bg-teal-700 rounded-t-xl px-6 py-3 flex items-center gap-3">
        <img src="https://img.icons8.com/fluency/48/000000/document.png" alt="DocLens" className="h-8 w-8 mr-2" />
        <span className="text-white text-2xl font-bold">DocLens</span>
      </div>
      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto bg-white rounded-b-xl shadow-lg flex flex-row mt-0">
        {/* Left: CDS & USPI Columns */}
        <div className="flex-1">
          <div className="grid grid-cols-2 gap-4 p-6">
            {/* Column Headers */}
            <div className="col-span-1 text-xl font-bold text-teal-700 mb-4">Core Data Sheet (CDS)</div>
            <div className="col-span-1 text-xl font-bold text-teal-700 mb-4">USPI Document</div>
            {/* Section Rows */}
            {rows.map((row, idx) => (
              <React.Fragment key={idx}>
                {/* CDS Card */}
                <div>
                  {row.cds ? (
                    <div className="bg-white rounded-lg p-4 mb-4 shadow border">
                      <div className="font-semibold text-teal-700 mb-2">{row.cds.title || `Section ${idx+1}`}</div>
                      <div className="text-gray-700 text-sm whitespace-pre-line">{row.cds.content}</div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-dashed border-gray-200 min-h-[80px]" />
                  )}
                </div>
                {/* USPI Card */}
                <div>
                  {row.child ? (
                    <div className="bg-white rounded-lg p-4 mb-4 shadow border">
                      <div className="font-semibold text-teal-700 mb-2">{row.child.title || `Section ${idx+1}`}</div>
                      <div className="text-gray-700 text-sm whitespace-pre-line">{row.child.content}</div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-dashed border-gray-200 min-h-[80px]" />
                  )}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
        {/* Right: AI Summary Panel */}
        <div className="w-[400px] border-l bg-teal-50 p-6 flex flex-col">
          <h2 className="text-lg font-bold text-teal-700 mb-4">AI Summary</h2>
          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              className={`px-3 py-1 rounded font-semibold border ${activeTab === 'section' ? 'bg-teal-700 text-white' : 'bg-white text-teal-700 border-teal-700'}`}
              onClick={() => setActiveTab('section')}
            >
              Section-Wise
            </button>
            <button
              className={`px-3 py-1 rounded font-semibold border ${activeTab === 'overall' ? 'bg-teal-700 text-white' : 'bg-white text-teal-700 border-teal-700'}`}
              onClick={() => setActiveTab('overall')}
            >
              Overall
            </button>
            <button className="px-3 py-1 rounded font-semibold border bg-white text-teal-700 border-teal-700" disabled>Export</button>
          </div>
          {/* Section-Wise Summary */}
          {activeTab === 'section' && (
            <div>
              <h3 className="text-md font-semibold text-teal-700 mb-2">Missing Sections</h3>
              <div className="flex flex-col gap-3">
                {/* Unmatched CDS sections (missing in Child/USPI) */}
                {cdsSections.filter(sec => !matchedPairs.some(pair => pair.cds_title === sec.title)).map((section, idx) => (
                  <div key={`cds-missing-${idx}`} className="bg-white rounded-lg p-3 shadow border flex flex-col">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-teal-700 text-sm">{section.title || `CDS Section`}</span>
                      <span className="bg-red-100 text-red-700 rounded px-2 py-0.5 text-xs font-semibold">{`Missing in ${childType}`}</span>
                    </div>
                    <div className="text-gray-700 text-sm">{section.content}</div>
                  </div>
                ))}
                {/* Unmatched USPI sections (missing in CDS) */}
                {childSections.filter(sec => !matchedPairs.some(pair => pair.child_title === sec.title && pair.cds_title)).map((section, idx) => (
                  <div key={`uspi-missing-${idx}`} className="bg-white rounded-lg p-3 shadow border flex flex-col">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-teal-700 text-sm">{section.title || `USPI Section`}</span>
                      <span className="bg-red-100 text-red-700 rounded px-2 py-0.5 text-xs font-semibold">Missing in CDS</span>
                    </div>
                    <div className="text-gray-700 text-sm">{section.content}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Overall Summary */}
          {activeTab === 'overall' && (
            <div>
              <h3 className="text-md font-semibold text-teal-700 mb-2">Document Analysis Summary</h3>
              <div className="flex gap-4 mb-4">
                <div className="bg-white rounded-lg shadow border p-4 flex flex-col items-center min-w-[120px]">
                  <span className="text-2xl font-bold text-teal-700">{totalDifferences}</span>
                  <span className="text-gray-600 text-xs mt-1">Total Differences</span>
                </div>
                <div className="bg-white rounded-lg shadow border p-4 flex flex-col items-center min-w-[120px]">
                  <span className="text-2xl font-bold text-teal-700">{sectionsAffected}</span>
                  <span className="text-gray-600 text-xs mt-1">Sections Affected</span>
                </div>
              </div>
              <h4 className="text-md font-semibold text-teal-700 mb-2">Summary of Changes</h4>
              <div className="flex flex-col gap-3">
                {summaryOfChanges.length === 0 ? (
                  <div className="text-gray-400 italic">No significant changes found.</div>
                ) : (
                  summaryOfChanges.map((change, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-3 shadow border flex flex-row items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-teal-600 inline-block" />
                      <span className="text-gray-700 text-sm">{change}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComparisonScreen;