import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { FaDownload } from 'react-icons/fa';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';

const ComparisonScreen = () => {
  const location = useLocation();
  const navigate = useNavigate();
  // Only show uploaded/processed child files (with a valid comparisonResult)
  const allChildFiles = location.state?.childFiles || [
    { name: 'USPI_sample.docx', type: 'USPI', comparisonResult: location.state?.comparisonResult },
    { name: 'SwissPI_sample.docx', type: 'SwissPI', comparisonResult: null },
    { name: 'SmPC_sample.docx', type: 'SmPC', comparisonResult: null },
    { name: 'AUSPI_sample.docx', type: 'AUSPI', comparisonResult: null },
    { name: 'IPL_sample.docx', type: 'IPL', comparisonResult: null },
    { name: 'JPI_sample.docx', type: 'JPI', comparisonResult: null },
  ];
  const uploadedChildFiles = allChildFiles.filter(f => f.comparisonResult);
  const [selectedChildIdx, setSelectedChildIdx] = useState(0);
  const selectedChild = uploadedChildFiles[selectedChildIdx] || uploadedChildFiles[0];
  const comparisonResult = selectedChild?.comparisonResult || location.state?.comparisonResult;
  const childFileName = selectedChild?.name;

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
  const [showExportModal, setShowExportModal] = useState(false);
  const [showExportFormatModal, setShowExportFormatModal] = useState(false); // NEW
  // Replace exportOptions state with a single exportOption
  const [exportOption, setExportOption] = useState('overallSummary');
  const [selectedSectionIdx, setSelectedSectionIdx] = useState(null);
  const [selectedSectionTitle, setSelectedSectionTitle] = useState(null);
  // Helper to normalize titles
  const normalizeTitle = (title) => (title || '').trim().toLowerCase();
  // Build maps for first occurrence of each section title in CDS and Child
  const cdsTitleToIndex = {};
  cdsSections.forEach((sec, idx) => {
    const norm = normalizeTitle(sec.title);
    if (norm && !(norm in cdsTitleToIndex)) cdsTitleToIndex[norm] = idx;
  });
  const childTitleToIndex = {};
  childSections.forEach((sec, idx) => {
    const norm = normalizeTitle(sec.title);
    if (norm && !(norm in childTitleToIndex)) childTitleToIndex[norm] = idx;
  });

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

  // Calculate missing sections
  const unmatchedCdsSections = cdsSections.filter(sec => !matchedPairs.some(pair => pair.cds_title === sec.title));
  const unmatchedChildSections = childSections.filter(sec => !matchedPairs.some(pair => pair.child_title === sec.title && pair.cds_title));
  const missingSectionsCount = unmatchedCdsSections.length + unmatchedChildSections.length;

  // Calculate changed sections
  const changedSections = sectionComparisons.filter(s => s.change_count > 0);
  const sectionsAffectedOverall = changedSections.length + missingSectionsCount;
  const totalDifferencesOverall = changedSections.reduce((sum, s) => sum + (s.change_count || 0), 0) + missingSectionsCount;
  const summaryOfChangesOverall = [
    ...changedSections.filter(s => s.summary).map(s => s.summary),
    ...unmatchedCdsSections.map(s => `Missing in ${childType}: ${s.title}`),
    ...unmatchedChildSections.map(s => `Missing in CDS: ${s.title}`)
  ];

  // Helper to build export content based on options
  const buildExportContent = () => {
    let content = '';
    if (exportOption === 'updatedDocuments') {
      content += '--- Updated Documents ---\n';
      cdsSections.forEach((sec, idx) => {
        content += `CDS Section ${idx + 1}: ${sec.title}\n${sec.content}\n\n`;
      });
      childSections.forEach((sec, idx) => {
        content += `${childType} Section ${idx + 1}: ${sec.title}\n${sec.content}\n\n`;
      });
    } else if (exportOption === 'overallSummary') {
      content += '--- Overall Summary ---\n';
      content += `Total Differences: ${totalDifferencesOverall}\nSections Affected: ${sectionsAffectedOverall}\n\n`;
      // Changed sections
      changedSections.forEach((s, idx) => {
        const cdsSection = cdsSections.find(sec => normalizeTitle(sec.title) === normalizeTitle(s.title));
        const childSection = childSections.find(sec => normalizeTitle(sec.title) === normalizeTitle(s.title));
        content += `Section: ${s.title}\nSummary: ${s.summary}\n`;
        content += `CDS Content:\n${cdsSection?.content || 'No content'}\n`;
        content += `${childType} Content:\n${childSection?.content || 'No content'}\n\n`;
      });
      // Missing CDS sections
      unmatchedCdsSections.forEach(section => {
        content += `Section: ${section.title}\nMissing in ${childType}\n`;
        content += `CDS Content:\n${section.content || 'No content'}\n\n`;
      });
      // Missing Child sections
      unmatchedChildSections.forEach(section => {
        content += `Section: ${section.title}\nMissing in CDS\n`;
        content += `${childType} Content:\n${section.content || 'No content'}\n\n`;
      });
    } else if (exportOption === 'sectionWise') {
      content += '\n--- Section-wise Differences ---\n';
      sectionComparisons.forEach((s, idx) => {
        if (s.change_count > 0) {
          const sectionName = s.section && s.section.trim() ? s.section : `Section ${idx + 1}`;
          content += `Section: ${sectionName}\nChanges: ${s.change_count}\nSummary: ${s.summary}\n\n`;
        }
      });
    }
    return content || 'No content selected for export.';
  };

  // PDF Export
  const handleExportPDF = () => {
    const doc = new jsPDF();
    const content = buildExportContent();
    const lines = doc.splitTextToSize(content, 180);
    let y = 10;
    lines.forEach(line => {
      if (y > 280) {
        doc.addPage();
        y = 10;
      }
      doc.text(line, 10, y);
      y += 8;
    });
    doc.save('comparison_export.pdf');
  };

  // Word Export
  const handleExportWord = () => {
    const content = buildExportContent();
    const paragraphs = content.split('\n').map(line => new Paragraph(line));
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    });
    Packer.toBlob(doc).then(blob => {
      saveAs(blob, 'comparison_export.docx');
    });
  };

  // Dropdown state
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <div className="min-h-screen bg-teal-50 p-0">
      {/* Back to Home Button */}
      <div className="px-6 pt-4 pb-2 flex items-center">
        <button
          className="flex items-center text-teal-700 hover:underline text-base font-semibold gap-2"
          onClick={() => navigate('/')}
        >
          <span className="text-xl">🏠</span> Back to Home
        </button>
      </div>
      {/* Back to All Sections Button */}
      {selectedSectionTitle && (
        <div className="px-6 pt-4 pb-2 flex items-center">
          <button
            className="flex items-center text-teal-700 hover:underline text-base font-semibold gap-2"
            onClick={() => setSelectedSectionTitle(null)}
          >
            <span className="text-xl">←</span> Back to All Sections
          </button>
        </div>
      )}
      {/* Header */}
      <div className="bg-teal-700 rounded-t-xl px-6 py-3 flex items-center gap-3">
        <img src="https://img.icons8.com/fluency/48/000000/document.png" alt="DocLens" className="h-8 w-8 mr-2" />
        <span className="text-white text-2xl font-bold">DocLens</span>
      </div>
      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto bg-white rounded-b-xl shadow-lg flex flex-row mt-0 overflow-hidden">
        {/* Left: CDS & USPI Columns */}
        <div className="flex-1">
          <div className="h-[600px] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4 p-6">
              {/* Column Headers */}
              <div className="col-span-1 text-xl font-bold text-teal-700 mb-4">Core Data Sheet (CDS)</div>
              <div className="col-span-1 flex items-center gap-2 text-xl font-bold text-teal-700 mb-4">
                <span>{selectedChild.type} Document</span>
                <div className="relative">
                  <button
                    className="flex items-center px-2 py-1 border border-gray-300 rounded bg-white hover:bg-gray-100 text-base font-semibold text-teal-700 gap-1"
                    onClick={() => setShowDropdown(v => !v)}
                    type="button"
                  >
                    <span className="mr-1">▼</span>
                    <span>{selectedChild.type}</span>
                  </button>
                  {showDropdown && (
                    <div className="absolute z-10 mt-1 w-32 bg-white border border-gray-200 rounded shadow-lg">
                      {uploadedChildFiles.map((file, idx) => (
                        <div
                          key={file.type}
                          className={`px-4 py-2 cursor-pointer hover:bg-teal-50 ${selectedChildIdx === idx ? 'bg-teal-100 font-bold' : ''}`}
                          onClick={() => { setSelectedChildIdx(idx); setShowDropdown(false); }}
                        >
                          {file.type}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {/* Section Rows */}
              {rows.map((row, idx) => {
                // Find the index of this section in its own array
                const cdsIdx = row.cds ? cdsSections.findIndex(sec => normalizeTitle(sec.title) === normalizeTitle(row.cds.title)) : -1;
                const childIdx = row.child ? childSections.findIndex(sec => normalizeTitle(sec.title) === normalizeTitle(row.child.title)) : -1;
                // Find the first occurrence index for the selected title
                const firstCdsIdx = selectedSectionTitle ? cdsSections.findIndex(sec => normalizeTitle(sec.title) === selectedSectionTitle) : -1;
                const firstChildIdx = selectedSectionTitle ? childSections.findIndex(sec => normalizeTitle(sec.title) === selectedSectionTitle) : -1;
                let cdsHighlighted = false;
                let childHighlighted = false;
                if (selectedSectionTitle) {
                  if (row.cds && normalizeTitle(row.cds.title) === selectedSectionTitle && cdsIdx === firstCdsIdx) {
                    cdsHighlighted = true;
                  }
                  if (row.child && normalizeTitle(row.child.title) === selectedSectionTitle && childIdx === firstChildIdx) {
                    childHighlighted = true;
                  }
                }
                return (
                  <React.Fragment key={idx}>
                    {/* CDS Card */}
                    <div>
                      {row.cds ? (
                        <div className={`bg-white rounded-lg p-4 mb-4 shadow border transition-all duration-150 ${cdsHighlighted ? 'ring-2 ring-teal-600 border-teal-600 bg-teal-50' : ''}`}>
                          <div className="font-semibold text-teal-700 mb-2">{row.cds.title || `Section ${idx+1}`}</div>
                          <div className="text-gray-700 text-sm whitespace-pre-line">{row.cds.content}</div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-dashed border-gray-200 min-h-[80px]" />
                      )}
                    </div>
                    {/* USPI/Child Card */}
                    <div>
                      {row.child ? (
                        <div className={`bg-white rounded-lg p-4 mb-4 shadow border transition-all duration-150 ${childHighlighted ? 'ring-2 ring-teal-600 border-teal-600 bg-teal-50' : ''}`}>
                          <div className="font-semibold text-teal-700 mb-2">{row.child.title || `Section ${idx+1}`}</div>
                          <div className="text-gray-700 text-sm whitespace-pre-line">{row.child.content}</div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-dashed border-gray-200 min-h-[80px]" />
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
        {/* Right: AI Summary Panel */}
        <div className="w-[400px] border-l bg-teal-50 p-6 flex flex-col h-[600px] overflow-y-auto">
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
            <button
              className="px-3 py-1 rounded font-semibold border bg-white text-teal-700 border-teal-700"
              onClick={() => setShowExportModal(true)}
            >
              Export
            </button>
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
                      <span className="font-semibold text-teal-700 text-sm">{section.title || `${childType} Section`}</span>
                      <span className="bg-red-100 text-red-700 rounded px-2 py-0.5 text-xs font-semibold">Missing in CDS</span>
                    </div>
                    <div className="text-gray-700 text-sm">{section.content}</div>
                  </div>
                ))}
                {/* Section Differences List (clickable/highlightable) */}
                {sectionComparisons.filter(s => s.change_count > 0).map((s, idx) => (
                  <div
                    key={`section-diff-${idx}`}
                    className={`bg-white rounded-lg p-3 shadow border flex flex-col gap-1 mb-2 cursor-pointer transition-all duration-150 ${selectedSectionTitle === normalizeTitle(s.title) ? 'ring-2 ring-teal-600 border-teal-600 bg-teal-50' : ''}`}
                    onClick={() => setSelectedSectionTitle(normalizeTitle(s.title))}
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-teal-600 inline-block" />
                      <span className="font-semibold text-teal-700">{s.title || `Section ${idx + 1}`}</span>
                      <span className="ml-auto text-xs text-gray-500">{s.change_count} change{s.change_count > 1 ? 's' : ''}</span>
                    </div>
                    <div className="text-gray-700 text-sm">{s.summary}</div>
                  </div>
                ))}
                {/* Section Diff Viewer */}
                {selectedSectionTitle && (() => {
                  const selectedSection = sectionComparisons.find(
                    s => normalizeTitle(s.title) === selectedSectionTitle
                  );
                  return selectedSection && selectedSection.diff ? (
                    <div className="mt-4">
                      <h4 className="text-md font-semibold text-teal-700 mb-2">
                        Detailed Changes for: {selectedSection.title}
                      </h4>
                      <div
                        className="overflow-auto bg-white border rounded p-2 mb-4"
                        style={{ maxHeight: 350 }}
                        dangerouslySetInnerHTML={{ __html: selectedSection.diff }}
                      />
                      {/* Missing Content Lists */}
                      {(selectedSection.missing_in_child?.length > 0 || selectedSection.missing_in_cds?.length > 0) && (
                        <div className="flex flex-col gap-2 mt-2">
                          {selectedSection.missing_in_child?.length > 0 && (
                            <div>
                              <div className="font-semibold text-red-700 mb-1">Present in CDS, missing in {childType}:</div>
                              <ul className="list-disc list-inside text-xs text-gray-700">
                                {selectedSection.missing_in_child.map((item, i) => (
                                  <li key={`missing-in-child-${i}`}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {selectedSection.missing_in_cds?.length > 0 && (
                            <div>
                              <div className="font-semibold text-red-700 mb-1">Present in {childType}, missing in CDS:</div>
                              <ul className="list-disc list-inside text-xs text-gray-700">
                                {selectedSection.missing_in_cds.map((item, i) => (
                                  <li key={`missing-in-cds-${i}`}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
          )}
          {/* Overall Summary */}
          {activeTab === 'overall' && (
            <div>
              <h3 className="text-md font-semibold text-teal-700 mb-2">Document Analysis Summary</h3>
              <div className="flex gap-4 mb-4">
                <div className="bg-white rounded-lg shadow border p-4 flex flex-col items-center min-w-[120px]">
                  <span className="text-2xl font-bold text-teal-700">{totalDifferencesOverall}</span>
                  <span className="text-gray-600 text-xs mt-1">Total Differences</span>
                </div>
                <div className="bg-white rounded-lg shadow border p-4 flex flex-col items-center min-w-[120px]">
                  <span className="text-2xl font-bold text-teal-700">{sectionsAffectedOverall}</span>
                  <span className="text-gray-600 text-xs mt-1">Sections Affected</span>
                </div>
              </div>
              <h4 className="text-md font-semibold text-teal-700 mb-2">Summary of Changes & Missing Sections</h4>
              <div className="flex flex-col gap-3">
                {sectionsAffectedOverall === 0 ? (
                  <div className="text-gray-400 italic">No significant changes or missing sections found.</div>
                ) : (
                  <>
                    {/* Changed Sections */}
                    {changedSections.map((s, idx) => (
                      <div key={`changed-${idx}`} className="bg-white rounded-lg p-3 shadow border flex flex-col gap-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="h-2 w-2 rounded-full bg-teal-600 inline-block" />
                          <span className="font-semibold text-teal-700">{s.title}</span>
                          <span className="ml-auto text-xs text-gray-500">{s.change_count} change{s.change_count > 1 ? 's' : ''}</span>
                        </div>
                        <div className="text-gray-700 text-sm mb-2">{s.summary}</div>
                      </div>
                    ))}
                    {/* Missing CDS Sections */}
                    {unmatchedCdsSections.map((section, idx) => (
                      <div key={`missing-cds-${idx}`} className="bg-white rounded-lg p-3 shadow border flex flex-col gap-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="h-2 w-2 rounded-full bg-red-600 inline-block" />
                          <span className="font-semibold text-teal-700">{section.title}</span>
                          <span className="ml-auto text-xs text-red-500">Missing in {childType}</span>
                        </div>
                        <div className="font-semibold text-teal-700 mb-1">CDS</div>
                        <div className="text-gray-700 text-xs whitespace-pre-line bg-gray-50 rounded p-2 min-h-[40px]">{section.content || <span className='italic text-gray-400'>No content</span>}</div>
                      </div>
                    ))}
                    {/* Missing Child Sections */}
                    {unmatchedChildSections.map((section, idx) => (
                      <div key={`missing-child-${idx}`} className="bg-white rounded-lg p-3 shadow border flex flex-col gap-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="h-2 w-2 rounded-full bg-red-600 inline-block" />
                          <span className="font-semibold text-teal-700">{section.title}</span>
                          <span className="ml-auto text-xs text-red-500">Missing in CDS</span>
                        </div>
                        <div className="font-semibold text-teal-700 mb-1">{childType}</div>
                        <div className="text-gray-700 text-xs whitespace-pre-line bg-gray-50 rounded p-2 min-h-[40px]">{section.content || <span className='italic text-gray-400'>No content</span>}</div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Export Options Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-0 relative">
            <button
              className="absolute top-5 right-6 text-gray-400 hover:text-gray-600 text-2xl font-bold focus:outline-none"
              onClick={() => setShowExportModal(false)}
              aria-label="Close"
            >
              ×
            </button>
            <div className="px-8 pt-8 pb-2">
              <div className="flex items-center gap-3 mb-6">
                <FaDownload className="text-teal-600 text-2xl" />
                <h2 className="text-2xl font-bold text-teal-700">Export Options</h2>
              </div>
              <div className="flex flex-col gap-4 mb-6">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="exportOption"
                    value="updatedDocuments"
                    checked={exportOption === 'updatedDocuments'}
                    onChange={() => setExportOption('updatedDocuments')}
                    className="form-radio h-5 w-5 text-teal-600 mt-1 border-gray-300 focus:ring-2 focus:ring-teal-500"
                  />
                  <div>
                    <span className="font-semibold text-gray-900">Updated Documents</span>
                    <div className="text-gray-500 text-sm mt-0.5">Export the complete updated documents</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="exportOption"
                    value="overallSummary"
                    checked={exportOption === 'overallSummary'}
                    onChange={() => setExportOption('overallSummary')}
                    className="form-radio h-5 w-5 text-teal-600 mt-1 border-gray-300 focus:ring-2 focus:ring-teal-500"
                  />
                  <div>
                    <span className="font-semibold text-gray-900">Overall Summary</span>
                    <div className="text-gray-500 text-sm mt-0.5">Export the overall comparison summary</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="exportOption"
                    value="sectionWise"
                    checked={exportOption === 'sectionWise'}
                    onChange={() => setExportOption('sectionWise')}
                    className="form-radio h-5 w-5 text-teal-600 mt-1 border-gray-300 focus:ring-2 focus:ring-teal-500"
                  />
                  <div>
                    <span className="font-semibold text-gray-900">Section-wise Differences</span>
                    <div className="text-gray-500 text-sm mt-0.5">Export detailed section-wise differences</div>
                  </div>
                </label>
              </div>
              <div className="flex justify-end gap-3 mt-8 pb-2">
                <button
                  className="px-5 py-2 rounded font-semibold border bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                  onClick={() => setShowExportModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-5 py-2 rounded font-semibold bg-teal-700 text-white hover:bg-teal-800 flex items-center gap-2"
                  onClick={() => {
                    setShowExportModal(false);
                    setShowExportFormatModal(true); // Open second modal
                  }}
                >
                  <FaDownload className="text-white text-lg" /> Export
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Export Format Modal (Second Modal) */}
      {showExportFormatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-0 relative">
            <button
              className="absolute top-5 right-6 text-gray-400 hover:text-gray-600 text-2xl font-bold focus:outline-none"
              onClick={() => setShowExportFormatModal(false)}
              aria-label="Close"
            >
              ×
            </button>
            <div className="px-8 pt-8 pb-2">
              <h2 className="text-2xl font-bold text-teal-700 mb-6 flex items-center gap-2">
                <FaDownload className="text-teal-600 text-2xl" /> Choose Export Format
              </h2>
              <div className="flex gap-6 mb-8 justify-center">
                <button
                  className="flex flex-col items-center border rounded-lg px-8 py-6 hover:bg-teal-50 focus:outline-none"
                  onClick={() => { setShowExportFormatModal(false); handleExportPDF(); }}
                >
                  <span className="text-4xl mb-2">📄</span>
                  <span className="font-semibold text-teal-700">PDF</span>
                </button>
                <button
                  className="flex flex-col items-center border rounded-lg px-8 py-6 hover:bg-teal-50 focus:outline-none"
                  onClick={() => { setShowExportFormatModal(false); handleExportWord(); }}
                >
                  <span className="text-4xl mb-2">📝</span>
                  <span className="font-semibold text-teal-700">Word Document</span>
                </button>
              </div>
              <div className="flex justify-end mt-4 mb-2">
                <button
                  className="px-5 py-2 rounded font-semibold border bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                  onClick={() => setShowExportFormatModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComparisonScreen;