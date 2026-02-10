import React, { useState, useEffect } from 'react';
import CVTailor from './components/CVTailor';
import LiveConversation from './components/LiveConversation';
import ProfileBuilder from './components/ProfileBuilder';
import { BotIcon, EditIcon, FileStackIcon, SettingsIcon, DatabaseIcon, NotionIcon } from './components/icons';
import { initSupabase, HARDCODED_SUPABASE_URL } from './services/supabaseService';

type Tab = 'cv' | 'live' | 'profile';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('cv');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Lazy initialization: Prefer hardcoded URL, otherwise read from localStorage.
  const [supabaseUrl, setSupabaseUrl] = useState(() => 
    HARDCODED_SUPABASE_URL || localStorage.getItem('supabase_url') || localStorage.getItem('supabaseUrl') || ''
  );
  const [supabaseKey, setSupabaseKey] = useState(() => 
    localStorage.getItem('supabase_key') || localStorage.getItem('supabaseKey') || ''
  );
  
  // Notion Settings
  const [notionKey, setNotionKey] = useState(() => localStorage.getItem('notion_key') || '');
  const [notionDbId, setNotionDbId] = useState(() => localStorage.getItem('notion_db_id') || '');
  
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);

  useEffect(() => {
    // Attempt to initialize immediately on mount if keys are present in state
    if (supabaseUrl && supabaseKey) {
        const connected = initSupabase();
        setIsSupabaseConnected(connected);
    }
  }, []); // Only run once on mount

  const handleSaveSettings = () => {
    // Sanitize inputs: Trim and remove non-ASCII chars to prevent header errors
    const cleanSupabaseUrl = supabaseUrl.trim().replace(/[^\x00-\x7F]/g, "");
    const cleanSupabaseKey = supabaseKey.trim().replace(/[^\x00-\x7F]/g, "");
    const cleanNotionKey = notionKey.trim().replace(/[^\x00-\x7F]/g, "");
    const cleanNotionDbId = notionDbId.trim().replace(/[^\x00-\x7F]/g, "");

    // Update state with cleaned values
    setSupabaseUrl(cleanSupabaseUrl);
    setSupabaseKey(cleanSupabaseKey);
    setNotionKey(cleanNotionKey);
    setNotionDbId(cleanNotionDbId);

    // Save Supabase Keys
    if (!cleanSupabaseUrl || !cleanSupabaseKey) {
        if (cleanSupabaseUrl || cleanSupabaseKey) {
             // If partial, allow it (user might be fixing things)
        } else if (!window.confirm("You are about to save empty credentials. This will disconnect Supabase. Continue?")) {
            return;
        }
    }

    localStorage.setItem('supabase_url', cleanSupabaseUrl);
    localStorage.setItem('supabase_key', cleanSupabaseKey);
    
    // Save Notion Keys
    localStorage.setItem('notion_key', cleanNotionKey);
    localStorage.setItem('notion_db_id', cleanNotionDbId);
    
    // Initialize service
    const connected = initSupabase();
    setIsSupabaseConnected(connected);
    setIsSettingsOpen(false);
    alert('Settings saved!');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'cv':
        return <CVTailor />;
      case 'live':
        return <LiveConversation />;
      case 'profile':
        return <ProfileBuilder />;
      default:
        return null;
    }
  };

  const TabButton = ({ tab, label, icon }: { tab: Tab; label: string; icon: React.ReactNode }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center justify-center w-full px-4 py-3 text-sm font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 rounded-lg ${
        activeTab === tab
          ? 'bg-indigo-600 text-white shadow-lg'
          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
      }`}
    >
      {icon}
      <span className="ml-2">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans relative">
        {/* Settings Button */}
        <div className="absolute top-4 right-4 z-50">
            <button 
                onClick={() => setIsSettingsOpen(true)}
                className={`p-2 rounded-full transition-colors ${isSupabaseConnected ? 'bg-green-600/20 text-green-400' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                title="Application Settings"
            >
                <SettingsIcon />
            </button>
        </div>

        {/* Settings Modal */}
        {isSettingsOpen && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                <div className="bg-gray-800 rounded-xl max-w-md w-full p-6 border border-gray-700 shadow-2xl max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <SettingsIcon className="text-indigo-400" />
                            Settings
                        </h2>
                        <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-white">&times;</button>
                    </div>
                    
                    <div className="space-y-6">
                        {/* Supabase Section */}
                        <div className="space-y-3 pb-4 border-b border-gray-700">
                             <h3 className="font-semibold text-indigo-300 flex items-center gap-2">
                                <DatabaseIcon className="w-4 h-4" /> Supabase Connection
                             </h3>
                             <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Project URL</label>
                                <input 
                                    type="text" 
                                    value={supabaseUrl} 
                                    onChange={(e) => setSupabaseUrl(e.target.value)}
                                    disabled={!!HARDCODED_SUPABASE_URL}
                                    placeholder="https://xyz.supabase.co"
                                    className={`w-full bg-gray-900 border border-gray-700 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 ${!!HARDCODED_SUPABASE_URL ? 'text-gray-500 cursor-not-allowed' : ''}`}
                                />
                                {!!HARDCODED_SUPABASE_URL && <p className="text-xs text-green-500 mt-1">URL is hardcoded in code.</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Anon API Key</label>
                                <input 
                                    type="password" 
                                    value={supabaseKey} 
                                    onChange={(e) => setSupabaseKey(e.target.value)}
                                    placeholder="eyJh..."
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        {/* Notion Section */}
                         <div className="space-y-3">
                             <h3 className="font-semibold text-gray-200 flex items-center gap-2">
                                <NotionIcon className="w-4 h-4" /> Notion Integration
                             </h3>
                             <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Internal Integration Secret</label>
                                <input 
                                    type="password" 
                                    value={notionKey} 
                                    onChange={(e) => setNotionKey(e.target.value)}
                                    placeholder="secret_..."
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Database ID</label>
                                <input 
                                    type="text" 
                                    value={notionDbId} 
                                    onChange={(e) => setNotionDbId(e.target.value)}
                                    placeholder="32 character ID"
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="bg-gray-900/50 p-2 rounded text-xs text-gray-500">
                                <p>Required Properties: Company (Title), Position (Rich Text), Status (Select), Date (Date), Link (URL), Salary (Rich Text).</p>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                             <button 
                                onClick={handleSaveSettings}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
                             >
                                Save Settings
                             </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

      <div className="container mx-auto p-4 md:p-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-500 to-pink-500">
            Gemini Assistant
          </h1>
          <p className="mt-2 text-gray-400">CV Tailoring & Live Conversation</p>
        </header>

        <nav className="mb-8 p-1.5 bg-gray-800/50 rounded-xl shadow-md max-w-lg mx-auto grid grid-cols-3 gap-2">
          <TabButton tab="profile" label="Profile Builder" icon={<FileStackIcon />} />
          <TabButton tab="cv" label="CV Tailor" icon={<EditIcon />} />
          <TabButton tab="live" label="Live Chat" icon={<BotIcon />} />
        </nav>

        <main>
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;