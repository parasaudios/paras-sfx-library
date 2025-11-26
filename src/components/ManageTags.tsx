import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner';
import { X, Plus, Tag, ArrowRight, ArrowLeft } from 'lucide-react';
import * as api from '../utils/api';
import { capitalizeWords } from '../utils/formatters';
import { formatTagForDisplay } from '../utils/tagUtils';

export function ManageTags() {
  const [currentTags, setCurrentTags] = useState<string[]>([]);
  const [allAvailableTags, setAllAvailableTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      // Load managed tags from database
      const managedTags = await api.getAllTags();
      setCurrentTags(managedTags);

      // Load all sounds and extract unique tags
      const sounds = await api.getAllSounds();
      const extractedTags = new Set<string>();
      
      sounds.forEach((sound: any) => {
        if (sound.tags && Array.isArray(sound.tags)) {
          sound.tags.forEach((tag: string) => {
            extractedTags.add(tag.toLowerCase().trim());
          });
        }
      });

      // Filter out tags that are already in currentTags
      const availableTags = Array.from(extractedTags)
        .filter(tag => !managedTags.includes(tag))
        .sort();
      
      setAllAvailableTags(availableTags);
    } catch (error) {
      console.error('Failed to load tags:', error);
      toast.error('Failed to load tags');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToCurrentTags = async (tag: string) => {
    try {
      const updatedTags = await api.addTag(tag);
      setCurrentTags(updatedTags);
      setAllAvailableTags(prev => prev.filter(t => t !== tag));
      toast.success(`Added "${tag}" to current tags`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to add tag');
    }
  };

  const handleRemoveFromCurrentTags = async (tag: string) => {
    try {
      const updatedTags = await api.removeTag(tag);
      setCurrentTags(updatedTags);
      setAllAvailableTags(prev => [...prev, tag].sort());
      toast.success(`Removed "${tag}" from current tags`);
    } catch (error) {
      toast.error('Failed to remove tag');
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="text-center py-12">
          <p className="text-slate-400">Loading tags...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="mb-6">
          <h2 className="text-white mb-2">Manage Search Tags</h2>
          <p className="text-slate-400">
            Select tags from your sound library to display in the "Browse by Tag" section on the homepage
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* All Available Tags */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6">
            <h3 className="text-white mb-4 flex items-center gap-2">
              <Tag className="size-5" />
              All Tags from Library ({allAvailableTags.length})
            </h3>
            <p className="text-slate-400 text-sm mb-4">
              Click on a tag to add it to the homepage
            </p>

            {allAvailableTags.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400">No available tags</p>
                <p className="text-slate-500 text-sm mt-2">
                  {currentTags.length > 0 
                    ? 'All tags from your library are already in use' 
                    : 'Add tags to your sounds to see them here'}
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-[500px] overflow-y-auto pr-2">
                {allAvailableTags.map((tag, index) => (
                  <motion.button
                    key={tag}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.01 }}
                    onClick={() => handleAddToCurrentTags(tag)}
                    className="group px-4 py-2 bg-slate-600/20 hover:bg-purple-600/40 border border-slate-500/30 hover:border-purple-500/50 rounded-full text-slate-300 hover:text-white transition-all text-sm flex items-center gap-2"
                  >
                    <span>{formatTagForDisplay(tag)}</span>
                    <ArrowRight className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.button>
                ))}
              </div>
            )}
          </div>

          {/* Current Tags (Displayed on Homepage) */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6">
            <h3 className="text-white mb-4 flex items-center gap-2">
              <Tag className="size-5 text-purple-400" />
              Current Tags ({currentTags.length})
            </h3>
            <p className="text-slate-400 text-sm mb-4">
              These tags appear in the "Browse by Tag" section
            </p>

            {currentTags.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400">No tags selected</p>
                <p className="text-slate-500 text-sm mt-2">
                  Click on tags from the left to add them
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-[500px] overflow-y-auto pr-2">
                {currentTags.map((tag, index) => (
                  <motion.button
                    key={tag}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.01 }}
                    onClick={() => handleRemoveFromCurrentTags(tag)}
                    className="group px-4 py-2 bg-purple-600/20 hover:bg-red-600/40 border border-purple-500/30 hover:border-red-500/50 rounded-full text-purple-300 hover:text-white transition-all text-sm flex items-center gap-2"
                  >
                    <ArrowLeft className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span>{formatTagForDisplay(tag)}</span>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <p className="text-blue-300 text-sm">
            💡 <strong>Tip:</strong> Tags are automatically extracted from your sound library. Click tags to add/remove them from the homepage search section.
          </p>
        </div>
      </motion.div>
    </div>
  );
}