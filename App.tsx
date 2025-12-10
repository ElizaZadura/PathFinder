
import React, { useState, useEffect } from 'react';
import CVTailor from './components/CVTailor';
import LiveConversation from './components/LiveConversation';
import ProfileBuilder from './components/ProfileBuilder';
import { BotIcon, EditIcon, FileStackIcon, SettingsIcon, DatabaseIcon } from './components/icons';
import { initSupabase } from './services/supabaseService';

type Tab = 'cv' | 'live' | 'profile';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('cv');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Lazy initialization: Read from localStorage immediately. 
  // This prevents the state from being empty on the first render cycle.
  const [supabaseUrl, setSupabaseUrl] = useState(() => 
    localStorage.getItem('supabase_url') || localStorage.getItem('supabaseUrl') || ''
  );
  const [supabaseKey, setSupabaseKey] = useState(() => 
    localStorage.getItem('supabase_key') || localStorage.getItem('supabaseKey') || ''
  );
  
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);

  useEffect(() => {
    // Attempt to initialize immediately on mount if keys are present in state
    if (supabaseUrl && supabaseKey) {
        const connected = initSupabase();
        setIsSupabaseConnected(connected);
    }
  }, []); // Only run once on mount

  const handleSaveSettings = () => {
    if (!supabaseUrl || !supabaseKey) {
        if (!window.confirm("You are about to save empty credentials. This will disconnect Supabase. Continue?")) {
            return;
        }
    }

    // Save with new standard keys
    localStorage.setItem('supabase_url', supabaseUrl);
    localStorage.setItem('supabase_key', supabaseKey);
    
    // Initialize service
    const connected = initSupabase();
    setIsSupabaseConnected(connected);
    setIsSettingsOpen(false);
    alert('Supabase settings saved!');
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
                title="Database Settings"
            >
                <SettingsIcon />
            </button>
        </div>

        {/* Settings Modal */}
        {isSettingsOpen && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                <div className="bg-gray-800 rounded-xl max-w-md w-full p-6 border border-gray-700 shadow-2xl">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <DatabaseIcon className="text-indigo-400" />
                            Supabase Connection
                        </h2>
                        <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-white">&times;</button>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Project URL</label>
                            <input 
                                type="text" 
                                value={supabaseUrl} 
                                onChange={(e) => setSupabaseUrl(e.target.value)}
                                placeholder="https://xyz.supabase.co"
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                            />
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
                        <div className="bg-gray-900/50 p-3 rounded text-xs text-gray-400">
                            <p>Enter your Supabase credentials to enable saving Profiles and Job Applications to the cloud.</p>
                            <p className="mt-1">Required tables: <code className="text-indigo-300">master_profiles</code>, <code className="text-indigo-300">job_applications</code>.</p>
                        </div>
                        <div className="flex justify-end pt-2">
                             <button 
                                onClick={handleSaveSettings}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
                             >
                                Save Connection
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
