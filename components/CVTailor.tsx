import React, { useState, useCallback, useRef, useEffect } from 'react';
import { getTailoredCV, extractKeywords, getJobDescriptionFromUrl } from '../services/geminiService';
import { UploadIcon, DownloadIcon } from './icons';

const languages = [
  'English', 'Spanish', 'French', 'German', 'Portuguese', 'Italian', 'Dutch', 'Russian', 'Japanese', 'Chinese (Simplified)', 'Korean', 'Arabic'
];

const CVTailor: React.FC = () => {
  const [cv, setCv] = useState<string>(() => localStorage.getItem('userCv') || '');
  const [jobPosting, setJobPosting] = useState<string>('');
  const [jobPostingUrl, setJobPostingUrl] = useState<string>('');
  const [isFetchingUrl, setIsFetchingUrl] = useState<boolean>(false);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [tailoredCv, setTailoredCv] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [outputLanguage, setOutputLanguage] = useState<string>('English');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('userCv', cv);
  }, [cv]);

  const handleCvChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCv = e.target.value;
    setCv(newCv);
  };

  const handleFetchFromUrl = useCallback(async () => {
    if (!jobPostingUrl) return;

    setIsFetchingUrl(true);
    setError(null);
    try {
      const description = await getJobDescriptionFromUrl(jobPostingUrl);
      setJobPosting(description);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch and parse job description from URL. Please paste the content manually.');
      console.error(err);
    } finally {
      setIsFetchingUrl(false);
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

    try {
      const extracted = await extractKeywords(jobPosting);
      setKeywords(extracted);
      const result = await getTailoredCV(cv, jobPosting, outputLanguage);
      setTailoredCv(result);
    } catch (err) {
      setError('An error occurred while tailoring your CV. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [cv, jobPosting, outputLanguage]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(tailoredCv);
    alert('CV copied to clipboard!');
  };

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileLoad = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        setCv(text);
      }
    };
    reader.onerror = () => {
        console.error("Failed to read file");
        setError("Failed to read the selected file.");
    };
    reader.readAsText(file);
    if (event.target) {
        event.target.value = '';
    }
  };

  const handleSaveToFile = () => {
    if (!tailoredCv) return;
    const blob = new Blob([tailoredCv], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Tailored-CV.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const commonTextAreaClass = "w-full p-4 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 resize-y";

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2 flex flex-col">
            <div className="flex justify-between items-center mb-2">
                 <label htmlFor="cv-input" className="font-semibold text-gray-300">Your CV</label>
                 <input type="file" ref={fileInputRef} onChange={handleFileLoad} accept=".txt,.md,.text" style={{ display: 'none' }} />
                 <button onClick={handleLoadClick} className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors">
                    <UploadIcon className="w-4 h-4" /> Load from File
                </button>
            </div>
          <textarea
            id="cv-input"
            value={cv}
            onChange={handleCvChange}
            placeholder="Paste your CV here..."
            className={`${commonTextAreaClass} flex-grow`}
          />
        </div>
        <div className="flex flex-col gap-4">
            <div className="space-y-2">
                <label htmlFor="job-posting-url-input" className="font-semibold text-gray-300">
                Job Posting URL
                </label>
                <div className="flex items-center gap-2">
                <input
                    id="job-posting-url-input"
                    type="url"
                    value={jobPostingUrl}
                    onChange={(e) => setJobPostingUrl(e.target.value)}
                    placeholder="https://www.linkedin.com/jobs/view/..."
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200"
                    aria-label="Job Posting URL"
                />
                <button
                    onClick={handleFetchFromUrl}
                    disabled={isFetchingUrl || !jobPostingUrl.startsWith('http')}
                    className="flex-shrink-0 px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all duration-300 h-[50px] w-[110px] flex items-center justify-center"
                    aria-label="Fetch job description from URL"
                >
                    {isFetchingUrl ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                    'Fetch'
                    )}
                </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                 Pasting a URL may not always work due to site restrictions (CORS). If it fails, please paste the text below.
                </p>
            </div>
            <div className="space-y-2 flex-grow flex flex-col">
                <label htmlFor="job-posting-input" className="font-semibold text-gray-300">
                Job Posting Text
                </label>
                <textarea
                id="job-posting-input"
                value={jobPosting}
                onChange={(e) => setJobPosting(e.target.value)}
                placeholder="...or paste the job description text directly here."
                className={`${commonTextAreaClass} flex-grow`}
                />
            </div>
        </div>
      </div>
      
      <div className="text-center space-y-4">
        <div>
            <label htmlFor="language-select" className="block mb-2 text-sm font-medium text-gray-400">Output Language</label>
            <select
                id="language-select"
                value={outputLanguage}
                onChange={(e) => setOutputLanguage(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full max-w-xs mx-auto p-2.5"
                aria-label="Select output language"
            >
                {languages.map(lang => (
                    <option key={lang} value={lang}>{lang}</option>
                ))}
            </select>
        </div>
        <button
          onClick={handleTailor}
          disabled={isLoading || !cv || !jobPosting}
          className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-lg hover:bg-indigo-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500"
        >
          {isLoading ? 'Tailoring...' : 'Tailor My CV'}
        </button>
      </div>

      {error && <div className="text-center p-4 bg-red-900/50 text-red-300 rounded-lg">{error}</div>}

      {isLoading && (
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400 mx-auto"></div>
          <p className="mt-4 text-gray-400">Gemini is working its magic...</p>
        </div>
      )}

      {keywords.length > 0 && !isLoading && (
        <div className="p-4 bg-gray-800/50 rounded-lg">
          <h3 className="font-semibold text-lg mb-3 text-indigo-400">Extracted Keywords:</h3>
          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword, index) => (
              <span key={index} className="px-3 py-1 bg-gray-700 text-gray-200 text-sm rounded-full">
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}

      {tailoredCv && !isLoading && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
             <h2 className="text-2xl font-bold text-gray-100">Your Tailored CV</h2>
             <div className="flex items-center gap-2">
                 <button onClick={handleSaveToFile} className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors">
                    <DownloadIcon className="w-4 h-4" /> Save
                </button>
                <button onClick={copyToClipboard} className="px-4 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors">Copy</button>
             </div>
          </div>
          <div
            className="p-6 bg-gray-800 border border-gray-700 rounded-lg whitespace-pre-wrap font-mono text-sm leading-relaxed"
          >
            {tailoredCv}
          </div>
        </div>
      )}
    </div>
  );
};

export default CVTailor;