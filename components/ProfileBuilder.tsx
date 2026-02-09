import React, { useState, useRef, useEffect } from 'react';
import { generateMasterProfile, extendMasterProfile, processUrlForProfile } from '../services/geminiService';
import { UploadIcon, FileStackIcon, TrashIcon, DownloadIcon, CloudIcon, LinkIcon, PenIcon } from './icons';
import { extractTextFromFile } from '../utils/fileHelpers';
import { saveMasterProfileToSupabase, getLatestMasterProfileFromSupabase, getSupabaseClient } from '../services/supabaseService';
import { Toast } from './Toast';

declare global {
  interface Window {
    jspdf: any;
  }
}

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
  
  const [urlInput, setUrlInput] = useState<string>('');
  const [isUrlProcessing, setIsUrlProcessing] = useState<boolean>(false);
  const [manualText, setManualText] = useState<string>('');
  
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
  
  const handleUrlSubmit = async () => {
      if (!urlInput || !urlInput.startsWith('http')) {
          setToast({ message: "Please enter a valid URL (starting with http/https).", type: 'error' });
          return;
      }
      
      setIsUrlProcessing(true);
      setError(null);
      try {
          const summary = await processUrlForProfile(urlInput);
          setFiles(prev => [...prev, { name: `URL: ${urlInput}`, content: summary }]);
          setUrlInput('');
          setToast({ message: "URL content processed and added!", type: 'success' });
      } catch (err: any) {
          setError(err.message || "Failed to process URL.");
          setToast({ message: "Failed to fetch URL content.", type: 'error' });
      } finally {
          setIsUrlProcessing(false);
      }
  };

  const handleAddManualText = () => {
    if (!manualText.trim()) return;
    setFiles(prev => [...prev, { 
        name: `Text Note (${new Date().toLocaleTimeString()})`, 
        content: manualText 
    }]);
    setManualText('');
    setToast({ message: "Text note added to queue.", type: 'success' });
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
      
      let profile = '';
      if (masterProfile && masterProfile.trim().length > 0) {
          profile = await extendMasterProfile(masterProfile, docsContent);
          setToast({ message: "Profile updated with new documents!", type: 'success' });
      } else {
          profile = await generateMasterProfile(docsContent);
          setToast({ message: "Master Profile generated!", type: 'success' });
      }
      
      setMasterProfile(profile);
      // New profile generated/updated locally, so the stored ID is no longer valid until saved
      localStorage.removeItem('masterProfileId');
      setFiles([]); // Clear files after successful processing
    } catch (err) {
      setError('Failed to process documents. Please try again.');
      setToast({ message: "Failed to process documents.", type: 'error' });
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

  const handleSaveAsPdf = () => {
    if (!masterProfile) return;
    
    if (!window.jspdf) {
        setToast({ message: "PDF library not loaded yet. Please refresh the page.", type: 'error' });
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const margin = 15;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const usableWidth = pageWidth - margin * 2;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        const lines = doc.splitTextToSize(masterProfile, usableWidth);
        
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

        doc.save('Master_Career_Profile.pdf');
        setIsSaveOpen(false);
        setToast({ message: "PDF Saved!", type: 'success' });
    } catch (err) {
        console.error(err);
        setToast({ message: "Failed to generate PDF.", type: 'error' });
    }
  };

  const handleClearProfile = () => {
    if (window.confirm("Are you sure you want to clear the current Master Profile? This action cannot be undone.")) {
      setMasterProfile('');
      localStorage.removeItem('masterProfile');
      localStorage.removeItem('masterProfileId');
    }
  };

  const handleSaveToCloud = async () => {
      if (!masterProfile) return;
      setIsCloudSyncing(true);
      try {
          const data = await saveMasterProfileToSupabase(masterProfile);
          if (data && data.id) {
            localStorage.setItem('masterProfileId', data.id.toString());
          }
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
          const data = await getLatestMasterProfileFromSupabase();
          if (data && data.content) {
              setMasterProfile(data.content);
              if (data.id) {
                localStorage.setItem('masterProfileId', data.id.toString());
              }
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
          Upload multiple documents (Old CVs, Project Summaries), paste URLs (GitHub Repos, Portfolios), or add raw text to create a single, comprehensive "Master Career Profile".
        </p>
        
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center flex-wrap">
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
                disabled={isProcessing || isUrlProcessing}
                className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
             >
               <UploadIcon className="w-5 h-5" />
               {isProcessing ? 'Processing Files...' : 'Upload Files (PDF, DOCX)'}
             </button>
             
             <div className="hidden md:block w-px h-10 bg-gray-700"></div>
             
             <div className="flex-grow flex gap-2 w-full md:w-auto">
                 <input 
                    type="url" 
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://github.com/username/repo"
                    className="flex-grow p-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm min-w-[200px]"
                 />
                 <button 
                    onClick={handleUrlSubmit}
                    disabled={isProcessing || isUrlProcessing || !urlInput}
                    className="px-4 py-2 bg-indigo-800 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                 >
                    {isUrlProcessing ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <LinkIcon className="w-4 h-4" />}
                    <span>Fetch URL</span>
                 </button>
             </div>
          </div>
          
          <div className="bg-gray-900/30 p-3 rounded-lg border border-gray-700/50">
            <label className="text-xs text-gray-400 font-semibold mb-2 block uppercase tracking-wider">Add Manual Text</label>
            <div className="flex gap-2 flex-col md:flex-row items-start">
                 <textarea 
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    placeholder="Paste or type additional bio, skills, or project details here..."
                    className="flex-grow w-full p-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm min-h-[60px] resize-y"
                 />
                 <button 
                    onClick={handleAddManualText}
                    disabled={!manualText.trim()}
                    className="px-4 py-2 h-full min-h-[60px] bg-indigo-800 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
                 >
                    <PenIcon className="w-4 h-4" />
                    <span>Add Text</span>
                 </button>
            </div>
          </div>
          
          <div className="text-sm text-gray-500">{files.length} items ready to process</div>

          {files.length > 0 && (
            <div className="bg-gray-900/50 rounded-lg p-4 space-y-2 max-h-48 overflow-y-auto">
              {files.map((file, index) => (
                <div key={index} className="flex justify-between items-center bg-gray-800 p-2 rounded border border-gray-700">
                  <div className="flex items-center gap-2 overflow-hidden">
                      {file.name.startsWith('URL:') ? <LinkIcon className="w-4 h-4 text-indigo-400 flex-shrink-0" /> : file.name.startsWith('Text Note') ? <PenIcon className="w-4 h-4 text-green-400 flex-shrink-0" /> : <FileStackIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                      <span className="text-sm truncate max-w-[300px]">{file.name}</span>
                  </div>
                  <button onClick={() => handleRemoveFile(index)} className="text-red-400 hover:text-red-300 p-1">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded">{error}</div>}
          
          <div className="flex justify-center pt-4 gap-4 flex-wrap">
             <button 
                onClick={handleGenerateProfile} 
                disabled={files.length === 0 || isProcessing || isUrlProcessing}
                className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-lg hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all"
             >
               {isProcessing 
                  ? 'Processing...' 
                  : (masterProfile ? 'Update Profile with New Items' : 'Generate Master Profile')
               }
             </button>

             {!masterProfile && hasSupabase && (
                <button 
                    onClick={handleLoadFromCloud} 
                    disabled={isCloudSyncing}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-900/50 text-indigo-200 hover:bg-indigo-900 border border-indigo-700/50 rounded-lg shadow-lg transition-colors disabled:opacity-50 font-semibold"
                >
                   <CloudIcon className="w-5 h-5" />
                   {isCloudSyncing ? 'Loading...' : 'Load from Cloud'}
                </button>
             )}
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
                                <button onClick={handleSaveAsPdf} className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 transition-colors">
                                    Save as PDF (.pdf)
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