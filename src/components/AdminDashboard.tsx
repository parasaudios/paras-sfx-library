import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner@2.0.3';
import { LogOut, Plus, List, Search, MessageSquare, Database, Tag } from 'lucide-react';
import { ManageSounds } from './ManageSounds';
import { SearchSounds } from './SearchSounds';
import { ManageSuggestions } from './ManageSuggestions';
import { BulkImport } from './BulkImport';
import { ManageTags } from './ManageTags';
import * as api from '../utils/api';
import { migrateLocalStorageToSupabase } from '../utils/migrateData';
import { seedDatabase } from '../utils/seedData';

interface Sound {
  id: string;
  title: string;
  audioUrl: string;
  tags: string[];
  equipment?: string;
  format?: string;
}

interface AdminDashboardProps {
  onLogout: () => void;
}

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'add' | 'manage' | 'search' | 'suggestions' | 'import' | 'tags'>('add');
  const [title, setTitle] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [tags, setTags] = useState('');
  const [equipment, setEquipment] = useState('');
  const [format, setFormat] = useState('');
  const [customSounds, setCustomSounds] = useState<Sound[]>([]);
  const [unreadSuggestions, setUnreadSuggestions] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Migrate existing localStorage data to Supabase
    const migrate = async () => {
      const result = await migrateLocalStorageToSupabase();
      if (result.success && result.migrated > 0) {
        toast.success(result.message);
      }
    };
    migrate();

    // Load custom sounds from API
    loadSounds();

    // Load unread suggestions count
    updateUnreadCount();

    // Update count when tab becomes active
    const interval = setInterval(updateUnreadCount, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadSounds = async () => {
    const sounds = await api.getAllSounds();
    setCustomSounds(sounds);
  };

  const updateUnreadCount = async () => {
    const suggestions = await api.getAllSuggestions();
    const unread = suggestions.filter((s: any) => !s.isRead).length;
    setUnreadSuggestions(unread);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !audioUrl.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const newSound = await api.createSound({
        title: title.trim(),
        audioUrl: audioUrl.trim(),
        tags: tags.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag.length > 0),
        equipment: equipment.trim() || undefined,
        format: format.trim() || undefined
      });

      if (newSound) {
        setCustomSounds([newSound, ...customSounds]);
        toast.success('Sound effect added successfully!');
        
        // Reset form
        setTitle('');
        setAudioUrl('');
        setTags('');
        setEquipment('');
        setFormat('');
      } else {
        toast.error('Failed to add sound effect');
      }
    } catch (error) {
      console.error('Error adding sound:', error);
      toast.error('Failed to add sound effect');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const success = await api.deleteSound(id);
    if (success) {
      const updatedSounds = customSounds.filter(sound => sound.id !== id);
      setCustomSounds(updatedSounds);
      toast.success('Sound effect deleted');
    } else {
      toast.error('Failed to delete sound effect');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <h2 className="text-white text-lg sm:text-xl">Admin Dashboard</h2>
            <div className="flex flex-wrap gap-1 sm:gap-2 w-full sm:w-auto">
              <Button
                onClick={() => setActiveTab('add')}
                variant={activeTab === 'add' ? 'default' : 'ghost'}
                size="sm"
                className={`text-xs sm:text-sm ${activeTab === 'add' ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'text-white hover:bg-white/10'}`}
              >
                <Plus className="size-3 sm:size-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Sounds</span>
              </Button>
              <Button
                onClick={() => setActiveTab('manage')}
                variant={activeTab === 'manage' ? 'default' : 'ghost'}
                size="sm"
                className={`text-xs sm:text-sm ${activeTab === 'manage' ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'text-white hover:bg-white/10'}`}
              >
                <List className="size-3 sm:size-4 sm:mr-2" />
                <span className="hidden sm:inline">Manage</span>
              </Button>
              <Button
                onClick={() => setActiveTab('search')}
                variant={activeTab === 'search' ? 'default' : 'ghost'}
                size="sm"
                className={`text-xs sm:text-sm ${activeTab === 'search' ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'text-white hover:bg-white/10'}`}
              >
                <Search className="size-3 sm:size-4 sm:mr-2" />
                <span className="hidden sm:inline">Search</span>
              </Button>
              <Button
                onClick={() => setActiveTab('suggestions')}
                variant={activeTab === 'suggestions' ? 'default' : 'ghost'}
                size="sm"
                className={`relative text-xs sm:text-sm ${activeTab === 'suggestions' ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'text-white hover:bg-white/10'}`}
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
                className={`text-xs sm:text-sm ${activeTab === 'import' ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'text-white hover:bg-white/10'}`}
              >
                <Database className="size-3 sm:size-4 sm:mr-2" />
                <span className="hidden sm:inline">Import</span>
              </Button>
              <Button
                onClick={() => setActiveTab('tags')}
                variant={activeTab === 'tags' ? 'default' : 'ghost'}
                size="sm"
                className={`text-xs sm:text-sm ${activeTab === 'tags' ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'text-white hover:bg-white/10'}`}
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
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 sm:p-6 lg:p-8">
                <h2 className="text-white mb-4 sm:mb-6 text-xl sm:text-2xl">Add New Sound Effect</h2>
                
                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="title" className="text-white text-sm sm:text-base">Title *</Label>
                      <Input
                        id="title"
                        placeholder="e.g., Door Creak"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="bg-white/5 border-white/20 text-white placeholder:text-slate-400 h-10 sm:h-12 text-sm sm:text-base"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="equipment" className="text-white text-sm sm:text-base">Equipment (optional)</Label>
                      <Input
                        id="equipment"
                        placeholder="e.g., Rode NT1-A, Zoom H6"
                        value={equipment}
                        onChange={(e) => setEquipment(e.target.value)}
                        className="bg-white/5 border-white/20 text-white placeholder:text-slate-400 h-10 sm:h-12 text-sm sm:text-base"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="format" className="text-white text-sm sm:text-base">Audio Format (optional)</Label>
                      <Input
                        id="format"
                        placeholder="e.g., WAV, MP3, FLAC"
                        value={format}
                        onChange={(e) => setFormat(e.target.value)}
                        className="bg-white/5 border-white/20 text-white placeholder:text-slate-400 h-10 sm:h-12 text-sm sm:text-base"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="tags" className="text-white text-sm sm:text-base">Tags (comma separated)</Label>
                      <Input
                        id="tags"
                        placeholder="e.g., door, wood, horror"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        className="bg-white/5 border-white/20 text-white placeholder:text-slate-400 h-10 sm:h-12 text-sm sm:text-base"
                      />
                    </div>
                  </div>

                  {/* Google Drive Link */}
                  <div className="space-y-2">
                    <Label htmlFor="audioUrl" className="text-white text-sm sm:text-base">Google Drive Link *</Label>
                    <Input
                      id="audioUrl"
                      placeholder="https://drive.google.com/file/d/..."
                      value={audioUrl}
                      onChange={(e) => setAudioUrl(e.target.value)}
                      className="bg-white/5 border-white/20 text-white placeholder:text-slate-400 h-10 sm:h-12 text-sm sm:text-base"
                      required
                    />
                    <p className="text-slate-400 text-xs sm:text-sm">
                      <strong>Important:</strong> Make sure the Google Drive file is set to "Anyone with the link can view"
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-purple-600 hover:bg-purple-700 h-10 sm:h-12 text-sm sm:text-base"
                    disabled={loading}
                  >
                    {loading ? 'Adding...' : 'Add Sound Effect'}
                  </Button>
                </form>
              </div>
            </motion.div>

            {/* Quick Stats */}
            {customSounds.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 sm:p-6 text-center">
                  <p className="text-slate-400 text-sm sm:text-base">
                    You have <span className="text-purple-400">{customSounds.length}</span> sound{customSounds.length !== 1 ? 's' : ''} in your library
                  </p>
                  <Button
                    onClick={() => setActiveTab('manage')}
                    variant="ghost"
                    size="sm"
                    className="text-purple-400 hover:text-purple-300 hover:bg-purple-400/10 mt-2 text-xs sm:text-sm"
                  >
                    View & Manage Sounds →
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        ) : activeTab === 'search' ? (
          <SearchSounds />
        ) : activeTab === 'manage' ? (
          <ManageSounds />
        ) : activeTab === 'suggestions' ? (
          <ManageSuggestions />
        ) : activeTab === 'import' ? (
          <div className="max-w-4xl mx-auto">
            <BulkImport onImportComplete={loadSounds} />
          </div>
        ) : activeTab === 'tags' ? (
          <ManageTags />
        ) : null}
      </div>
    </div>
  );
}