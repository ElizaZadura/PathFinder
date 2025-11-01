
import React, { useState } from 'react';
import CVTailor from './components/CVTailor';
import LiveConversation from './components/LiveConversation';
import { BotIcon, EditIcon } from './components/icons';

type Tab = 'cv' | 'live';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('cv');

  const renderContent = () => {
    switch (activeTab) {
      case 'cv':
        return <CVTailor />;
      case 'live':
        return <LiveConversation />;
      default:
        return null;
    }
  };

  // FIX: Changed icon type from JSX.Element to React.ReactNode to resolve "Cannot find namespace 'JSX'" error.
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
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      <div className="container mx-auto p-4 md:p-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-500 to-pink-500">
            Gemini Assistant
          </h1>
          <p className="mt-2 text-gray-400">CV Tailoring & Live Conversation</p>
        </header>

        <nav className="mb-8 p-1.5 bg-gray-800/50 rounded-xl shadow-md max-w-sm mx-auto grid grid-cols-2 gap-2">
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