
import React, { useState, useRef, useEffect } from 'react';
import { generateMasterProfile } from '../services/geminiService';
import { UploadIcon, FileStackIcon, TrashIcon, DownloadIcon } from './icons';
import { extractTextFromFile } from '../utils/fileHelpers';

interface UploadedFile {
  name: string;
  content: string;
}

const ProfileBuilder: React.FC = () => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [masterProfile, setMasterProfile] = useState<string>(() => localStorage.getItem('masterProfile') || '');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (masterProfile) {
      localStorage.setItem('masterProfile', masterProfile);
    }
  }, [masterProfile]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    
    const newFiles: UploadedFile[] = [];
    setError(null);
    setIsProcessing(true);

    try {
      for (let i = 0; i < event.target.files.length; i++) {
        const file = event.target.files[i];
        try {
          const text = await extractTextFromFile(file);
          newFiles.push({ name: file.name, content: text });
        } catch (err) {
          console.error(`Error parsing ${file.name}`, err);
          setError(prev => `${prev ? prev + '\n' : ''}Failed to parse ${file.name}`);
        }
      }
      setFiles(prev => [...prev, ...newFiles]);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerateProfile = async () => {
    if (files.length === 0) return;
    
    setIsProcessing(true);
    setError(null);
    try {
      const docsContent = files.map(f => f.content);
      const profile = await generateMasterProfile(docsContent);
      setMasterProfile(profile);
    } catch (err) {
      setError('Failed to generate Master Profile. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveProfile = () => {
     const blob = new Blob([masterProfile], { type: 'text/plain;charset=utf-8' });
     const url = URL.createObjectURL(blob);
     const link = document.createElement('a');
     link.href = url;
     link.download = 'Master_Career_Profile.md';
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
     URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
        <h2 className="text-2xl font-bold mb-4 text-indigo-400 flex items-center gap-2">
          <FileStackIcon className="w-8 h-8" />
          Profile Builder
        </h2>
        <p className="text-gray-400 mb-6">
          Upload multiple documents (Old CVs, Project Summaries, LinkedIn exports) to create a single, comprehensive "Master Career Profile".
          This master profile will then be used to tailor your CV for specific jobs with higher accuracy.
        </p>
        
        <div className="space-y-4">
          <div className="flex items-center gap-4">
             <input 
                type="file" 
                multiple 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".txt,.md,.text,.docx,.pdf" 
                className="hidden" 
             />
             <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isProcessing}
                className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
             >
               <UploadIcon className="w-5 h-5" />
               {isProcessing ? 'Processing...' : 'Upload Files (PDF, DOCX, TXT)'}
             </button>
             <span className="text-sm text-gray-500">{files.length} files loaded</span>
          </div>

          {files.length > 0 && (
            <div className="bg-gray-900/50 rounded-lg p-4 space-y-2 max-h-48 overflow-y-auto">
              {files.map((file, index) => (
                <div key={index} className="flex justify-between items-center bg-gray-800 p-2 rounded border border-gray-700">
                  <span className="text-sm truncate max-w-[80%]">{file.name}</span>
                  <button onClick={() => handleRemoveFile(index)} className="text-red-400 hover:text-red-300 p-1">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded">{error}</div>}
          
          <div className="flex justify-center pt-4">
             <button 
                onClick={handleGenerateProfile} 
                disabled={files.length === 0 || isProcessing}
                className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-lg hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all"
             >
               {isProcessing ? 'Analyzing Documents...' : 'Generate Master Profile'}
             </button>
          </div>
        </div>
      </div>

      {masterProfile && (
        <div className="space-y-4 animate-fade-in">
           <div className="flex justify-between items-center">
             <h3 className="text-xl font-semibold text-gray-200">Your Master Profile</h3>
             <button onClick={handleSaveProfile} className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium">
               <DownloadIcon className="w-4 h-4" />
               Save as Markdown
             </button>
           </div>
           <textarea 
             value={masterProfile} 
             onChange={(e) => setMasterProfile(e.target.value)} 
             className="w-full h-96 p-4 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm leading-relaxed resize-y"
             placeholder="Your generated master profile will appear here..."
           />
           <p className="text-center text-green-400 text-sm">
             <span className="font-bold">✓ Saved automatically.</span> Go to the "CV Tailor" tab to use this profile.
           </p>
        </div>
      )}
    </div>
  );
};

export default ProfileBuilder;
