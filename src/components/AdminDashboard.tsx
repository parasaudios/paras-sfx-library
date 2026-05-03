import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { LogOut, Plus, List, Search, MessageSquare, Database, Tag } from 'lucide-react';
import { ManageSounds } from './ManageSounds';
import { SearchSounds } from './SearchSounds';
import { ManageSuggestions } from './ManageSuggestions';
import { BulkImport } from './BulkImport';
import { ManageTags } from './ManageTags';
import * as api from '../utils/api';

interface AdminDashboardProps {
  onLogout: () => void;
}

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'add' | 'manage' | 'search' | 'suggestions' | 'import' | 'tags'>('add');
  const [unreadSuggestions, setUnreadSuggestions] = useState(0);

  useEffect(() => {
    updateUnreadCount();
    const interval = setInterval(updateUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const updateUnreadCount = async () => {
    const suggestions = await api.getAllSuggestions();
    const unread = suggestions.filter((s: any) => !s.isRead).length;
    setUnreadSuggestions(unread);
  };

  return (
    <div className="min-h-screen bg-[#0d1017]">
      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0d1017]/90 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <h2 className="text-white text-lg sm:text-xl">Admin Dashboard</h2>
            <div className="flex flex-wrap gap-1 sm:gap-2 w-full sm:w-auto">
              <Button
                onClick={() => setActiveTab('add')}
                variant={activeTab === 'add' ? 'default' : 'ghost'}
                size="sm"
                className={`text-xs sm:text-sm ${activeTab === 'add' ? 'bg-[#10b981] hover:bg-[#0d9668] text-white' : 'text-white hover:bg-white/10'}`}
              >
                <Plus className="size-3 sm:size-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Sounds</span>
              </Button>
              <Button
                onClick={() => setActiveTab('manage')}
                variant={activeTab === 'manage' ? 'default' : 'ghost'}
                size="sm"
                className={`text-xs sm:text-sm ${activeTab === 'manage' ? 'bg-[#10b981] hover:bg-[#0d9668] text-white' : 'text-white hover:bg-white/10'}`}
              >
                <List className="size-3 sm:size-4 sm:mr-2" />
                <span className="hidden sm:inline">Manage</span>
              </Button>
              <Button
                onClick={() => setActiveTab('search')}
                variant={activeTab === 'search' ? 'default' : 'ghost'}
                size="sm"
                className={`text-xs sm:text-sm ${activeTab === 'search' ? 'bg-[#10b981] hover:bg-[#0d9668] text-white' : 'text-white hover:bg-white/10'}`}
              >
                <Search className="size-3 sm:size-4 sm:mr-2" />
                <span className="hidden sm:inline">Search</span>
              </Button>
              <Button
                onClick={() => setActiveTab('suggestions')}
                variant={activeTab === 'suggestions' ? 'default' : 'ghost'}
                size="sm"
                className={`relative text-xs sm:text-sm ${activeTab === 'suggestions' ? 'bg-[#10b981] hover:bg-[#0d9668] text-white' : 'text-white hover:bg-white/10'}`}
              >
                <MessageSquare className="size-3 sm:size-4 sm:mr-2" />
                <span className="hidden sm:inline">Suggestions</span>
                {unreadSuggestions > 0 && (
                  <span className="ml-1 sm:ml-2 bg-red-500 text-white text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
                    {unreadSuggestions}
                  </span>
                )}
              </Button>
              <Button
                onClick={() => setActiveTab('import')}
                variant={activeTab === 'import' ? 'default' : 'ghost'}
                size="sm"
                className={`text-xs sm:text-sm ${activeTab === 'import' ? 'bg-[#10b981] hover:bg-[#0d9668] text-white' : 'text-white hover:bg-white/10'}`}
              >
                <Database className="size-3 sm:size-4 sm:mr-2" />
                <span className="hidden sm:inline">Import</span>
              </Button>
              <Button
                onClick={() => setActiveTab('tags')}
                variant={activeTab === 'tags' ? 'default' : 'ghost'}
                size="sm"
                className={`text-xs sm:text-sm ${activeTab === 'tags' ? 'bg-[#10b981] hover:bg-[#0d9668] text-white' : 'text-white hover:bg-white/10'}`}
              >
                <Tag className="size-3 sm:size-4 sm:mr-2" />
                <span className="hidden lg:inline">Tags</span>
              </Button>
              <Button
                onClick={onLogout}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10 text-xs sm:text-sm"
              >
                <LogOut className="size-3 sm:size-4 sm:mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="pt-24 sm:pt-28 lg:pt-20 p-4 sm:p-6 lg:p-8">
        {activeTab === 'add' ? (
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 sm:mb-8"
            >
              {/* The legacy single-add form was wired to Google Drive URLs and
                  doesn't work with the current Supabase Storage backend. Direct
                  uploads from this UI aren't implemented; bulk import is the
                  supported path now. Showing an explainer instead so admins
                  aren't confused into entering data that won't persist. */}
              <div className="bg-[#141820] border border-[#252a35] rounded-lg p-6 sm:p-8 text-center">
                <h2 className="text-white mb-3 text-xl sm:text-2xl">Add New Sounds</h2>
                <p className="text-[#9ca3af] text-sm sm:text-base mb-6 max-w-xl mx-auto">
                  Adding sounds one at a time isn't supported through this UI right now —
                  the storage upload pipeline lives in the bulk-import script. Use one of the
                  options below to get audio files into the library.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    onClick={() => setActiveTab('import')}
                    className="bg-[#10b981] hover:bg-[#0d9668] h-10 sm:h-12 px-6"
                  >
                    Open Bulk Import
                  </Button>
                  <Button
                    onClick={() => setActiveTab('manage')}
                    variant="ghost"
                    className="text-white hover:bg-white/10 h-10 sm:h-12 px-6"
                  >
                    Or manage existing sounds
                  </Button>
                </div>
                <p className="text-[#6b7280] text-xs mt-6 max-w-xl mx-auto">
                  Tip: for big batches, run <code className="text-[#10b981]">node scripts/enrich-tags.mjs</code>{' '}
                  after import to auto-tag the new sounds.
                </p>
              </div>
            </motion.div>

          </div>
        ) : activeTab === 'search' ? (
          <SearchSounds />
        ) : activeTab === 'manage' ? (
          <ManageSounds />
        ) : activeTab === 'suggestions' ? (
          <ManageSuggestions />
        ) : activeTab === 'import' ? (
          <div className="max-w-4xl mx-auto">
            <BulkImport onImportComplete={() => { /* no-op: refresh handled by Manage tab */ }} />
          </div>
        ) : activeTab === 'tags' ? (
          <ManageTags />
        ) : null}
      </div>
    </div>
  );
}