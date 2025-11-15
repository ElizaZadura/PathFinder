
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { getTailoredCV, extractKeywords, getJobDescriptionFromUrl, refineCV, checkATSCompliance, generateCoverLetter, extractJobDataForCSV } from '../services/geminiService';
import { UploadIcon, DownloadIcon, CheckCircleIcon, XCircleIcon, InfoIcon, TrashIcon, StopIcon, TableIcon } from './icons';
import type { ATSReport, JobData } from '../types';

// Extend the Window interface to include the global libraries from scripts in index.html
declare global {
  interface Window {
    mammoth: any;
    jspdf: any;
  }
}

// --- ATS Report Display Component ---
const ScoreCircle: React.FC<{ score: number; maxScore: number; label: string }> = ({ score, maxScore, label }) => {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / maxScore) * circumference;
  const percentage = Math.round((score / maxScore) * 100);

  let colorClass = 'stroke-green-500';
  if (percentage < 40) colorClass = 'stroke-red-500';
  else if (percentage < 70) colorClass = 'stroke-yellow-500';

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full" viewBox="0 0 120 120">
          <circle
            className="text-gray-700"
            strokeWidth="10"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx="60"
            cy="60"
          />
          <circle
            className={colorClass}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx="60"
            cy="60"
            transform="rotate(-90 60 60)"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-white">
          {score}<span className="text-xl">/{maxScore}</span>
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold text-gray-300">{label}</p>
    </div>
  );
};

const ReportSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-gray-800/50 rounded-lg p-4 h-full">
    <h4 className="font-semibold text-lg mb-3 text-indigo-400">{title}</h4>
    <div className="text-gray-300 space-y-2 text-sm">{children}</div>
  </div>
);

const ListItem: React.FC<{ icon: 'check' | 'cross' | 'info'; text: string | React.ReactNode }> = ({ icon, text }) => {
  const icons = {
    check: <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />,
    cross: <XCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />,
    info: <InfoIcon className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />,
  };
  return (
    <div className="flex items-start gap-2">
      {icons[icon]}
      <span>{text}</span>
    </div>
  );
};

const ATSReportDisplay: React.FC<{ report: ATSReport }> = ({ report }) => {
  const foundKeywords = new Map(report.keywordMatch.cvKeywords.map(k => [k.keyword.toLowerCase(), k.count]));

  return (
    <div className="space-y-6 mt-6">
      <h2 className="text-2xl font-bold text-center">ATS Friendliness Report</h2>
      
      <div className="flex justify-center items-center gap-8 flex-wrap p-4 bg-gray-800 rounded-lg">
        <ScoreCircle score={report.readabilityScore} maxScore={5} label="ATS Readability" />
        <ScoreCircle score={report.keywordMatch.alignmentScore} maxScore={5} label="Keyword Alignment" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReportSection title="Layout & Formatting">
          {report.layoutSafety.issues.length === 0 ? (
            <ListItem icon="check" text="Layout appears simple and ATS-friendly." />
          ) : (
            report.layoutSafety.issues.map((issue, i) => <ListItem key={i} icon="cross" text={issue} />)
          )}
          {report.formatting.issues.length === 0 ? (
            <ListItem icon="check" text="Formatting appears consistent." />
          ) : (
            report.formatting.issues.map((issue, i) => <ListItem key={i} icon="cross" text={issue} />)
          )}
        </ReportSection>

        <ReportSection title="CV Structure">
          {['Summary', 'Experience', 'Education', 'Skills'].map(section => {
            const isMissing = report.structure.missingSections.some(s => s.toLowerCase() === section.toLowerCase());
            return <ListItem key={section} icon={isMissing ? 'cross' : 'check'} text={`${section} section ${isMissing ? 'is missing' : 'is present'}.`} />;
          })}
          <ListItem icon="info" text={report.structure.experienceCheck} />
        </ReportSection>

        <ReportSection title="Metadata & Readiness">
          <ListItem icon="info" text={<>Suggested filename: <code className="bg-gray-700 p-1 rounded text-xs">{report.metadata.suggestedFilename}</code></>} />
          <ListItem icon="info" text={report.metadata.contactInfoWarning} />
        </ReportSection>

        <ReportSection title="Job Keyword Analysis">
          <ul className="space-y-1">
            {report.keywordMatch.jobKeywords.map(({ keyword }, i) => {
              const count = foundKeywords.get(keyword.toLowerCase()) || 0;
              return (
                <li key={i} className="flex justify-between items-center p-1 rounded">
                  <span>{keyword}</span>
                  {/* FIX: Explicitly cast count to a number before comparison to fix "Operator '>' cannot be applied to types 'unknown' and 'number'" error. */}
                  <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${Number(count) > 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                    {Number(count) > 0 ? `Found ${count}x` : 'Missing'}
                  </span>
                </li>
              )
            })}
          </ul>
        </ReportSection>
      </div>
    </div>
  );
};

// --- Main CVTailor Component ---

const languages = [
  'Arabic', 'Chinese (Simplified)', 'Dutch', 'English', 'French', 'German', 'Italian', 'Japanese', 'Korean', 'Portuguese', 'Russian', 'Spanish', 'Swedish'
];

const CVTailor: React.FC = () => {
  const [cv, setCv] = useState<string>(() => localStorage.getItem('userCv') || '');
  const [jobPosting, setJobPosting] = useState<string>('');
  const [jobPostingUrl, setJobPostingUrl] = useState<string>('');
  const [isFetchingUrl, setIsFetchingUrl] = useState<boolean>(false);
  const [isFileLoading, setIsFileLoading] = useState<boolean>(false);
  const [librariesReady, setLibrariesReady] = useState<boolean>(false);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [tailoredCv, setTailoredCv] = useState<string>('');
  const [coverLetter, setCoverLetter] = useState<string>('');
  const [changesSummary, setChangesSummary] = useState<string[]>([]);
  const [suggestedFilename, setSuggestedFilename] = useState<string>('Tailored-CV');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState<boolean>(false);
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [refinementRequest, setRefinementRequest] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [outputLanguage, setOutputLanguage] = useState<string>('English');
  const [atsReport, setAtsReport] = useState<ATSReport | null>(null);
  const [isCheckingAts, setIsCheckingAts] = useState<boolean>(false);
  const [isCvSaveOpen, setIsCvSaveOpen] = useState<boolean>(false);
  const [isClSaveOpen, setIsClSaveOpen] = useState<boolean>(false);
  const [isExportingCsv, setIsExportingCsv] = useState<boolean>(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cvSaveDropdownRef = useRef<HTMLDivElement>(null);
  const clSaveDropdownRef = useRef<HTMLDivElement>(null);
  const fetchControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    localStorage.setItem('userCv', cv);
  }, [cv]);

  useEffect(() => {
    const checkLibraries = () => {
      if (window.mammoth && window.jspdf) {
        setLibrariesReady(true);
        return true;
      }
      return false;
    };

    if (checkLibraries()) return;
    const intervalId = setInterval(() => { if (checkLibraries()) clearInterval(intervalId); }, 100);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cvSaveDropdownRef.current && !cvSaveDropdownRef.current.contains(event.target as Node)) {
        setIsCvSaveOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clSaveDropdownRef.current && !clSaveDropdownRef.current.contains(event.target as Node)) {
        setIsClSaveOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleStopFetch = () => {
    if (fetchControllerRef.current) {
        fetchControllerRef.current.abort();
        fetchControllerRef.current = null;
    }
    setIsFetchingUrl(false);
  };

  const handleFetchFromUrl = useCallback(async () => {
    if (!jobPostingUrl) return;

    if (fetchControllerRef.current) {
      fetchControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    fetchControllerRef.current = controller;
    
    setIsFetchingUrl(true);
    setError(null);
    try {
      const description = await getJobDescriptionFromUrl(jobPostingUrl);
      if (!controller.signal.aborted) {
        setJobPosting(description);
      }
    } catch (err: any) {
      if (!controller.signal.aborted) {
          setError(err.message || 'Failed to fetch and parse job description from URL.');
      }
    } finally {
      if (fetchControllerRef.current === controller) {
        setIsFetchingUrl(false);
      }
    }
  }, [jobPostingUrl]);

  const handleTailor = useCallback(async () => {
    if (!cv || !jobPosting) {
      setError('Please provide both your CV and the job posting.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setTailoredCv('');
    setKeywords([]);
    setChangesSummary([]);
    setAtsReport(null);
    setSuggestedFilename('Tailored-CV');

    try {
      const extracted = await extractKeywords(jobPosting);
      setKeywords(extracted);
      const result = await getTailoredCV(cv, jobPosting, outputLanguage);
      setTailoredCv(result.tailoredCv);
      setChangesSummary([result.changesSummary]);
      if (result.suggestedFilename) {
          setSuggestedFilename(result.suggestedFilename);
      }
    } catch (err) {
      setError('An error occurred while tailoring your CV. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [cv, jobPosting, outputLanguage]);

  const handleGenerateCoverLetter = useCallback(async () => {
    if (!cv || !jobPosting) {
      setError('Please provide both your CV and the job posting to generate a cover letter.');
      return;
    }
    setIsGeneratingCoverLetter(true);
    setError(null);
    setCoverLetter('');
    try {
      const result = await generateCoverLetter(cv, jobPosting, outputLanguage);
      setCoverLetter(result);
    } catch (err) {
      setError('An error occurred while generating your cover letter. Please try again.');
    } finally {
      setIsGeneratingCoverLetter(false);
    }
  }, [cv, jobPosting, outputLanguage]);
  
  const handleRefine = useCallback(async () => {
    if (!refinementRequest || !tailoredCv) {
      setError('Please provide a refinement request.');
      return;
    }
    setIsRefining(true);
    setError(null);
    setAtsReport(null);
    try {
      const result = await refineCV(cv, jobPosting, tailoredCv, refinementRequest, outputLanguage);
      setTailoredCv(result.tailoredCv);
      setChangesSummary(prev => [...prev, result.changesSummary]);
      setRefinementRequest('');
    } catch (err) {
      setError('An error occurred while refining your CV. Please try again.');
    } finally {
      setIsRefining(false);
    }
  }, [refinementRequest, tailoredCv, cv, jobPosting, outputLanguage]);

  const handleAtsCheck = useCallback(async () => {
    if (!tailoredCv || !jobPosting) {
      setError('Please tailor a CV first before checking ATS compliance.');
      return;
    }
    setIsCheckingAts(true);
    setAtsReport(null);
    setError(null);
    try {
      const result = await checkATSCompliance(tailoredCv, jobPosting);
      setAtsReport(result);
    } catch (err) {
      setError('An error occurred while checking ATS compliance. Please try again.');
    } finally {
      setIsCheckingAts(false);
    }
  }, [tailoredCv, jobPosting]);

  const handleExportCsv = useCallback(async () => {
    if (!cv || !jobPosting) {
      setError('Please provide both your CV and the job posting to export data.');
      return;
    }
    setIsExportingCsv(true);
    setError(null);
    try {
      const data = await extractJobDataForCSV(cv, jobPosting);
      
      const headers = [
        "Application Date", "Position", "Status", "Salary", 
        "Reference Link", "Contact", "Source", "CV Path", 
        "Interview Date", "Next Action", "Notes"
      ];
      
      const escapeCsvField = (field: string | undefined): string => {
        if (field === undefined || field === null) return '""';
        const str = String(field);
        if (str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return `"${str}"`;
      };

      const applicationDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

      const rowData = [
        applicationDate,
        data.position,
        "Applied",
        data.salary,
        jobPostingUrl,
        data.contact,
        data.source,
        data.suggestedCvFilename,
        "", // Interview Date is empty by default
        data.nextAction,
        data.notes,
      ].map(escapeCsvField);
      
      const csvContent = [
        headers.join(','),
        rowData.join(',')
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      const filename = `${data.companyName}-${data.position}.csv`.replace(/[^a-zA-Z0-9-.]/g, '_'); // Sanitize filename
      link.setAttribute("download", filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (err) {
      setError('An error occurred while exporting job data. Please try again.');
    } finally {
      setIsExportingCsv(false);
    }
  }, [cv, jobPosting, jobPostingUrl]);

  const parseDocxArrayBuffer = async (arrayBuffer: ArrayBuffer): Promise<string> => {
      if (!window.mammoth) {
          throw new Error("Mammoth library not loaded.");
      }
      const result = await window.mammoth.extractRawText({ arrayBuffer });
      return result.value;
  };

  const handleFileLoad = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsFileLoading(true);
    setError(null);
    try {
        const fileName = file.name.toLowerCase();
        let text = '';
        if (fileName.endsWith('.docx')) {
            const arrayBuffer = await file.arrayBuffer();
            text = await parseDocxArrayBuffer(arrayBuffer);
        } else {
            text = await file.text();
        }
        setCv(text);
    } catch (err) {
        setError(err instanceof Error ? `Failed to read file: ${err.message}` : "Failed to read or parse the selected file.");
    } finally {
        setIsFileLoading(false);
        if (event.target) event.target.value = '';
    }
  };

  const handleClearCv = () => {
    setCv('');
  };

  const handleClearAll = useCallback(() => {
    if (fetchControllerRef.current) {
        fetchControllerRef.current.abort();
        fetchControllerRef.current = null;
    }
    setCv('');
    setJobPosting('');
    setJobPostingUrl('');
    setKeywords([]);
    setTailoredCv('');
    setCoverLetter('');
    setChangesSummary([]);
    setError(null);
    setAtsReport(null);
    setSuggestedFilename('Tailored-CV');
    setRefinementRequest('');
    setIsFetchingUrl(false);
    setIsLoading(false);
    setIsGeneratingCoverLetter(false);
    setIsRefining(false);
    setIsCheckingAts(false);
    setIsExportingCsv(false);
    setIsCvSaveOpen(false);
    setIsClSaveOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const copyToClipboard = (text: string, type: string) => { 
    navigator.clipboard.writeText(text); 
    alert(`${type} copied to clipboard!`); 
  };
  const handleLoadClick = () => { fileInputRef.current?.click(); };
  
  const handleSaveAsTxt = (content: string, baseFilename: string) => {
    if (!content) return;
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseFilename}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveAsPdf = (content: string, baseFilename: string) => {
    if (!content || !window.jspdf) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const usableWidth = pageWidth - margin * 2;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const lines = doc.splitTextToSize(content, usableWidth);
    
    let cursorY = margin;
    const lineHeight = 7;

    lines.forEach((line: string) => {
        if (cursorY + lineHeight > pageHeight - margin) {
            doc.addPage();
            cursorY = margin;
        }
        doc.text(line, margin, cursorY);
        cursorY += lineHeight;
    });

    doc.save(`${baseFilename}.pdf`);
  };

  const nothingToClear = !cv && !jobPosting && !jobPostingUrl && !tailoredCv && !coverLetter && !atsReport && keywords.length === 0;
  const commonTextAreaClass = "w-full p-4 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 resize-y";

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2 flex flex-col">
            <div className="flex justify-between items-center mb-2">
                 <label htmlFor="cv-input" className="font-semibold text-gray-300">Your CV</label>
                 <div className="flex items-center gap-2">
                    <button onClick={handleClearCv} disabled={!cv} title="Clear CV text" className="flex items-center gap-1.5 px-3 py-1 text-sm bg-gray-700 text-red-400 font-semibold rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        <TrashIcon className="w-4 h-4" />
                        <span>Clear</span>
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileLoad} accept=".txt,.md,.text,.docx" style={{ display: 'none' }} />
                    <button onClick={handleLoadClick} disabled={isFileLoading || !librariesReady} className="flex items-center justify-center w-[140px] gap-2 px-3 py-1 text-sm bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed">
                        {isFileLoading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <UploadIcon className="w-4 h-4" />}
                        {isFileLoading ? 'Parsing...' : (!librariesReady ? 'Initializing...' : 'Load from File')}
                    </button>
                 </div>
            </div>
          <textarea id="cv-input" value={cv} onChange={(e) => setCv(e.target.value)} placeholder="Paste your CV here, or load a DOCX or TXT file." className={`${commonTextAreaClass} flex-grow`} />
        </div>
        <div className="flex flex-col gap-4">
            <div className="space-y-2">
                <label htmlFor="job-posting-url-input" className="font-semibold text-gray-300">Job Posting URL</label>
                <div className="flex items-center gap-2">
                    <input id="job-posting-url-input" type="url" value={jobPostingUrl} onChange={(e) => setJobPostingUrl(e.target.value)} placeholder="https://www.linkedin.com/jobs/view/..." className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                    {isFetchingUrl ? (
                        <div className="flex-shrink-0 h-[50px] w-[110px] bg-gray-800 border border-gray-700 rounded-lg flex items-center justify-center gap-3 px-3" aria-live="polite" aria-busy="true">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-400" role="status">
                                <span className="sr-only">Loading...</span>
                            </div>
                            <div className="h-6 w-px bg-gray-600"></div>
                            <button onClick={handleStopFetch} className="p-1 rounded-md text-gray-400 hover:bg-red-600 hover:text-white transition-colors" aria-label="Stop fetching">
                                <StopIcon className="w-5 h-5" />
                            </button>
                        </div>
                    ) : (
                        <button onClick={handleFetchFromUrl} disabled={!jobPostingUrl.startsWith('http')} className="flex-shrink-0 px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all h-[50px] w-[110px] flex items-center justify-center">
                            Fetch
                        </button>
                    )}
                </div>
                <p className="text-xs text-gray-500 mt-1">Gemini will attempt to access the URL. This works for most public job postings. If it fails, please paste the text below.</p>
            </div>
            <div className="space-y-2 flex-grow flex flex-col">
                <label htmlFor="job-posting-input" className="font-semibold text-gray-300">Job Posting Text</label>
                <textarea id="job-posting-input" value={jobPosting} onChange={(e) => setJobPosting(e.target.value)} placeholder="...or paste the job description text directly here." className={`${commonTextAreaClass} flex-grow`} />
            </div>
        </div>
      </div>
      
      <div className="text-center space-y-4">
        <div>
            <label htmlFor="language-select" className="block mb-2 text-sm font-medium text-gray-400">Output Language</label>
            <select id="language-select" value={outputLanguage} onChange={(e) => setOutputLanguage(e.target.value)} className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full max-w-xs mx-auto p-2.5">
                {languages.map(lang => <option key={lang} value={lang}>{lang}</option>)}
            </select>
        </div>
        <div className="flex justify-center items-start gap-4 flex-wrap">
            <button onClick={handleTailor} disabled={isLoading || !cv || !jobPosting} className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-lg hover:bg-indigo-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 min-w-[220px]">
              {isLoading ? 'Tailoring...' : 'Tailor My CV'}
            </button>
             <button onClick={handleGenerateCoverLetter} disabled={isGeneratingCoverLetter || !cv || !jobPosting} className="px-8 py-3 bg-teal-600 text-white font-bold rounded-lg shadow-lg hover:bg-teal-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-teal-500 min-w-[220px]">
              {isGeneratingCoverLetter ? 'Generating...' : 'Generate Cover Letter'}
            </button>
            <button onClick={handleExportCsv} disabled={isExportingCsv || !cv || !jobPosting} className="px-8 py-3 bg-green-600 text-white font-bold rounded-lg shadow-lg hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-green-500 min-w-[220px] flex items-center justify-center gap-2">
              {isExportingCsv ? <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div><span>Exporting...</span></> : <><TableIcon /><span>Export Job Data</span></>}
            </button>
            <button onClick={handleClearAll} disabled={nothingToClear} className="px-8 py-3 bg-transparent border border-red-500 text-red-400 font-bold rounded-lg hover:bg-red-500/20 disabled:border-gray-600 disabled:text-gray-500 disabled:cursor-not-allowed transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-red-500 min-w-[220px] flex items-center justify-center gap-2">
                <TrashIcon className="w-5 h-5" />
                <span>Clear All</span>
            </button>
        </div>
      </div>

      {error && <div className="text-center p-4 bg-red-900/50 text-red-300 rounded-lg">{error}</div>}

      <div className="space-y-8 mt-8">
        {/* CV Section Loading */}
        {isLoading && (
          <div className="text-center p-8 bg-gray-800/50 rounded-lg">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400 mx-auto"></div>
            <p className="mt-4 text-gray-400">Gemini is tailoring your CV...</p>
          </div>
        )}

        {/* CV Section Content */}
        {!isLoading && tailoredCv && (
          <div className="space-y-8">
            {keywords.length > 0 && (
              <div className="p-4 bg-gray-800/50 rounded-lg">
                <h3 className="font-semibold text-lg mb-3 text-indigo-400">Extracted Keywords:</h3>
                <div className="flex flex-wrap gap-2">{keywords.map((keyword, index) => <span key={index} className="px-3 py-1 bg-gray-700 text-gray-200 text-sm rounded-full">{keyword}</span>)}</div>
              </div>
            )}

            {changesSummary.length > 0 && (
              <div className="p-4 bg-gray-800/50 rounded-lg">
                <h3 className="font-semibold text-lg mb-3 text-indigo-400">Summary of Changes:</h3>
                <div className="space-y-4">{changesSummary.map((summary, index) => ( <div key={index}> {index > 0 && <><hr className="my-4 border-gray-700" /><h4 className="font-semibold text-md mt-4 mb-2 text-indigo-300">Refinement {index}:</h4></>} <div className="text-gray-300 whitespace-pre-wrap text-sm" dangerouslySetInnerHTML={{ __html: summary.replace(/\\n/g, '<br />') }}></div> </div> ))}</div>
              </div>
            )}
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-100">Your Tailored CV</h2>
                <div className="flex items-center gap-2">
                  <div className="relative" ref={cvSaveDropdownRef}>
                      <button onClick={() => setIsCvSaveOpen(prev => !prev)} className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors">
                          <DownloadIcon className="w-4 h-4" />
                          <span>Save As...</span>
                      </button>
                      {isCvSaveOpen && (
                          <div className="origin-top-right absolute right-0 mt-2 w-36 rounded-md shadow-lg bg-gray-600 ring-1 ring-black ring-opacity-5 z-10">
                              <div className="py-1">
                                  <button onClick={() => { handleSaveAsTxt(tailoredCv, suggestedFilename); setIsCvSaveOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-500">
                                      Save as TXT
                                  </button>
                                  <button onClick={() => { handleSaveAsPdf(tailoredCv, suggestedFilename); setIsCvSaveOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-500">
                                      Save as PDF
                                  </button>
                              </div>
                          </div>
                      )}
                  </div>
                  <button onClick={() => copyToClipboard(tailoredCv, 'CV')} className="px-4 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors">Copy</button>
                </div>
              </div>
              <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg whitespace-pre-wrap font-mono text-sm leading-relaxed">{tailoredCv}</div>
              
              <div className="text-center pt-4">
                <button onClick={handleAtsCheck} disabled={isCheckingAts} className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center min-w-[220px] mx-auto">
                  {isCheckingAts ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : 'Analyze ATS Friendliness'}
                </button>
              </div>

              {isCheckingAts && (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-400 mx-auto"></div>
                  <p className="mt-3 text-gray-400">Analyzing your tailored CV...</p>
                </div>
              )}

              {atsReport && <ATSReportDisplay report={atsReport} />}

              <div className="p-4 bg-gray-800/50 rounded-lg mt-6">
                <h3 className="font-semibold text-lg mb-3 text-indigo-400">Need Changes? Ask Gemini.</h3>
                <textarea value={refinementRequest} onChange={(e) => setRefinementRequest(e.target.value)} placeholder="e.g., 'Make the summary more concise' or 'Add a section for my certifications'" className={`${commonTextAreaClass} h-24`} />
                <div className="text-right mt-2">
                  <button onClick={handleRefine} disabled={isRefining || !refinementRequest} className="px-6 py-2 bg-indigo-500 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-600 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center min-w-[120px] ml-auto">
                    {isRefining ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : 'Refine CV'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cover Letter Section Loading */}
        {isGeneratingCoverLetter && (
          <div className="text-center p-8 bg-gray-800/50 rounded-lg">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mx-auto"></div>
            <p className="mt-4 text-gray-400">Gemini is writing your cover letter...</p>
          </div>
        )}

        {/* Cover Letter Section Content */}
        {!isGeneratingCoverLetter && coverLetter && (
          <div className="space-y-4 pt-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-100">Generated Cover Letter</h2>
              <div className="flex items-center gap-2">
                 <div className="relative" ref={clSaveDropdownRef}>
                      <button onClick={() => setIsClSaveOpen(prev => !prev)} className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors">
                          <DownloadIcon className="w-4 h-4" />
                          <span>Save As...</span>
                      </button>
                      {isClSaveOpen && (
                          <div className="origin-top-right absolute right-0 mt-2 w-36 rounded-md shadow-lg bg-gray-600 ring-1 ring-black ring-opacity-5 z-10">
                              <div className="py-1">
                                  <button onClick={() => { handleSaveAsTxt(coverLetter, 'Cover-Letter'); setIsClSaveOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-500">
                                      Save as TXT
                                  </button>
                                  <button onClick={() => { handleSaveAsPdf(coverLetter, 'Cover-Letter'); setIsClSaveOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-500">
                                      Save as PDF
                                  </button>
                              </div>
                          </div>
                      )}
                  </div>
                <button onClick={() => copyToClipboard(coverLetter, 'Cover Letter')} className="px-4 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors">Copy</button>
              </div>
            </div>
            <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg whitespace-pre-wrap font-mono text-sm leading-relaxed">{coverLetter}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CVTailor;
