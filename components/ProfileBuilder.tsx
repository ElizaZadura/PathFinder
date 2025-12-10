
import React, { useState, useRef, useEffect } from 'react';
import { generateMasterProfile } from '../services/geminiService';
import { UploadIcon, FileStackIcon, TrashIcon, DownloadIcon, CloudIcon } from './icons';
import { extractTextFromFile } from '../utils/fileHelpers';
import { saveMasterProfileToSupabase, getLatestMasterProfileFromSupabase, getSupabaseClient } from '../services/supabaseService';
import { Toast } from './Toast';

interface UploadedFile {
  name: string;
  content: string;
}

const ProfileBuilder: React.FC = () => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [masterProfile, setMasterProfile] = useState<string>(() => localStorage.getItem('masterProfile') || '');
  const [error, setError] = useState<string | null>(null);
  const [isSaveOpen, setIsSaveOpen] = useState<boolean>(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [hasSupabase, setHasSupabase] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (masterProfile) {
      localStorage.setItem('masterProfile', masterProfile);
    }
  }, [masterProfile]);

  useEffect(() => {
      const client = getSupabaseClient();
      setHasSupabase(!!client);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (saveDropdownRef.current && !saveDropdownRef.current.contains(event.target as Node)) {
        setIsSaveOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const handleSaveProfile = (format: 'md' | 'json') => {
     if (!masterProfile) return;

     let blob: Blob;
     let filename: string;

     if (format === 'json') {
         const data = { masterProfile };
         blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
         filename = 'Master_Career_Profile.json';
     } else {
         blob = new Blob([masterProfile], { type: 'text/markdown;charset=utf-8' });
         filename = 'Master_Career_Profile.md';
     }

     const url = URL.createObjectURL(blob);
     const link = document.createElement('a');
     link.href = url;
     link.download = filename;
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
     URL.revokeObjectURL(url);
     setIsSaveOpen(false);
  };

  const handleClearProfile = () => {
    if (window.confirm("Are you sure you want to clear the current Master Profile? This action cannot be undone.")) {
      setMasterProfile('');
      localStorage.removeItem('masterProfile');
    }
  };

  const handleSaveToCloud = async () => {
      if (!masterProfile) return;
      setIsCloudSyncing(true);
      try {
          await saveMasterProfileToSupabase(masterProfile);
          setToast({ message: "Profile saved to Supabase successfully.", type: 'success' });
      } catch (err: any) {
          setToast({ message: `Failed to save to cloud: ${err.message}`, type: 'error' });
      } finally {
          setIsCloudSyncing(false);
      }
  };

  const handleLoadFromCloud = async () => {
      setIsCloudSyncing(true);
      try {
          const content = await getLatestMasterProfileFromSupabase();
          if (content) {
              setMasterProfile(content);
              setToast({ message: "Latest profile loaded from Supabase.", type: 'success' });
          } else {
              setToast({ message: "No profile found in database.", type: 'error' });
          }
      } catch (err: any) {
          setToast({ message: `Failed to load from cloud: ${err.message}`, type: 'error' });
      } finally {
          setIsCloudSyncing(false);
      }
  };

  return (
    <div className="space-y-8 relative">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

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
           <div className="flex justify-between items-center flex-wrap gap-2">
             <h3 className="text-xl font-semibold text-gray-200">Your Master Profile</h3>
             <div className="flex items-center gap-2">
                {hasSupabase && (
                    <>
                        <button 
                            onClick={handleLoadFromCloud} 
                            disabled={isCloudSyncing}
                            className="flex items-center gap-2 px-3 py-2 bg-indigo-900/50 text-indigo-200 hover:bg-indigo-900 border border-indigo-700/50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                            title="Load latest from Supabase"
                        >
                            <CloudIcon className="w-4 h-4" />
                            Load Cloud
                        </button>
                        <button 
                            onClick={handleSaveToCloud} 
                            disabled={isCloudSyncing}
                            className="flex items-center gap-2 px-3 py-2 bg-indigo-900/50 text-indigo-200 hover:bg-indigo-900 border border-indigo-700/50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                            title="Save current profile to Supabase"
                        >
                            <CloudIcon className="w-4 h-4" />
                            Save Cloud
                        </button>
                        <div className="w-px h-6 bg-gray-700 mx-1"></div>
                    </>
                )}
                
                <button 
                    onClick={handleClearProfile} 
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-sm font-medium transition-colors"
                >
                  <TrashIcon className="w-4 h-4" />
                  Clear Profile
                </button>
                
                <div className="relative" ref={saveDropdownRef}>
                    <button 
                        onClick={() => setIsSaveOpen(!isSaveOpen)} 
                        className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors text-white"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        Save As...
                    </button>
                    {isSaveOpen && (
                        <div className="origin-top-right absolute right-0 mt-2 w-52 rounded-md shadow-lg bg-gray-700 ring-1 ring-black ring-opacity-5 z-10">
                            <div className="py-1">
                                <button onClick={() => handleSaveProfile('md')} className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 transition-colors">
                                    Save as Markdown (.md)
                                </button>
                                <button onClick={() => handleSaveProfile('json')} className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 transition-colors">
                                    Save as JSON (.json)
                                </button>
                            </div>
                        </div>
                    )}
                </div>
             </div>
           </div>
           <textarea 
             value={masterProfile} 
             onChange={(e) => setMasterProfile(e.target.value)} 
             className="w-full h-96 p-4 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm leading-relaxed resize-y"
             placeholder="Your generated master profile will appear here..."
           />
           <p className="text-center text-green-400 text-sm">
             <span className="font-bold">✓ Saved automatically locally.</span> {hasSupabase ? 'Use Cloud buttons to sync.' : 'Configure Supabase in Settings to sync to cloud.'}
           </p>
        </div>
      )}
    </div>
  );
};

export default ProfileBuilder;
