
import React, { useState, useCallback } from 'react';
import { getTailoredCV, extractKeywords, getJobDescriptionFromUrl } from '../services/geminiService';

const defaultCV = `
John Doe
(123) 456-7890 | john.doe@email.com | linkedin.com/in/johndoe

Summary
Innovative and results-driven Software Engineer with 5+ years of experience in developing and scaling web applications. Proficient in JavaScript, React, and Node.js. Passionate about creating intuitive user interfaces and solving complex problems.

Experience
Senior Frontend Engineer | Tech Solutions Inc. | 2020 - Present
- Led the development of a new customer-facing dashboard using React and TypeScript, resulting in a 20% increase in user engagement.
- Collaborated with a team of 5 engineers to build and maintain a component library, improving development efficiency by 30%.
- Mentored junior engineers and conducted code reviews.

Software Engineer | Web Innovators | 2018 - 2020
- Developed and maintained RESTful APIs using Node.js and Express.
- Contributed to a large-scale single-page application using Angular.

Education
Bachelor of Science in Computer Science | University of Technology | 2014 - 2018
`.trim();

const CVTailor: React.FC = () => {
  const [cv, setCv] = useState<string>(() => {
    try {
      const savedCv = localStorage.getItem('userCV');
      return savedCv ? savedCv : defaultCV;
    } catch (error) {
      console.error("Failed to read CV from localStorage", error);
      return defaultCV;
    }
  });
  const [jobPosting, setJobPosting] = useState<string>('');
  const [jobPostingUrl, setJobPostingUrl] = useState<string>('');
  const [isFetchingUrl, setIsFetchingUrl] = useState<boolean>(false);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [tailoredCv, setTailoredCv] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleCvChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCv = e.target.value;
    setCv(newCv);
    try {
      localStorage.setItem('userCV', newCv);
    } catch (error) {
      console.error("Failed to save CV to localStorage", error);
    }
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
      const result = await getTailoredCV(cv, jobPosting);
      setTailoredCv(result);
    } catch (err) {
      setError('An error occurred while tailoring your CV. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [cv, jobPosting]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(tailoredCv);
    alert('CV copied to clipboard!');
  };

  const commonTextAreaClass = "w-full p-4 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 resize-y";

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2 flex flex-col">
          <label htmlFor="cv-input" className="font-semibold text-gray-300">Your CV</label>
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
      
      <div className="text-center">
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
             <button onClick={copyToClipboard} className="px-4 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors">Copy</button>
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
