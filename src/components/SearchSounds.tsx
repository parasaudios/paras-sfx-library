import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Search as SearchIcon, X } from 'lucide-react';
import { GoogleDriveAudioPlayer } from './GoogleDriveAudioPlayer';
import * as api from '../utils/api';

interface Sound {
  id: string;
  title: string;
  audioUrl: string;
  tags: string[];
  equipment?: string;
  format?: string;
}

export function SearchSounds() {
  const [searchQuery, setSearchQuery] = useState('');
  const [customSounds, setCustomSounds] = useState<Sound[]>([]);
  const [results, setResults] = useState<Sound[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    // Load custom sounds from API
    loadSounds();
  }, []);

  const loadSounds = async () => {
    const sounds = await api.getAllSounds();
    setCustomSounds(sounds);
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      const searchTerms = searchQuery.toLowerCase().trim().split(' ').filter(term => term.length > 0);
      
      const matchedResults = customSounds.filter(sfx => {
        const titleLower = sfx.title.toLowerCase();
        const tagsLower = sfx.tags.map(tag => tag.toLowerCase());
        const equipmentLower = sfx.equipment?.toLowerCase() || '';
        const formatLower = sfx.format?.toLowerCase() || '';
        
        // Check if any search term matches title, tags, equipment, or format
        return searchTerms.some(term => 
          titleLower.includes(term) || 
          equipmentLower.includes(term) ||
          formatLower.includes(term) ||
          tagsLower.some(tag => tag.includes(term) || term.includes(tag))
        );
      });

      // Sort by relevance (exact title matches first, then tag matches)
      matchedResults.sort((a, b) => {
        const aTitleMatch = searchTerms.some(term => a.title.toLowerCase().includes(term));
        const bTitleMatch = searchTerms.some(term => b.title.toLowerCase().includes(term));
        
        if (aTitleMatch && !bTitleMatch) return -1;
        if (!aTitleMatch && bTitleMatch) return 1;
        return 0;
      });
      
      setResults(matchedResults);
      setHasSearched(true);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setResults([]);
    setHasSearched(false);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-8">
          <h2 className="text-white mb-6">Search Sound Effects</h2>
          
          <div className="flex gap-3">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 size-5" />
              <Input
                type="text"
                placeholder="Type the sfx you're looking for.."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-11 h-14 bg-white/5 border-white/20 text-white placeholder:text-slate-400"
              />
            </div>
            <Button
              onClick={handleSearch}
              className="h-14 px-8 bg-purple-600 hover:bg-purple-700"
            >
              Search
            </Button>
            {hasSearched && (
              <Button
                onClick={handleClearSearch}
                variant="outline"
                className="h-14 px-8 border-white/20 bg-transparent text-white hover:bg-white/10"
              >
                <X className="size-4 mr-2" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {hasSearched && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="mb-6">
            <h3 className="text-white mb-2">
              Search Results for "{searchQuery}"
            </h3>
            <p className="text-slate-400">Found {results.length} sound{results.length !== 1 ? 's' : ''}</p>
          </div>

          {results.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((result, index) => (
                <GoogleDriveAudioPlayer
                  key={result.id}
                  title={result.title}
                  audioUrl={result.audioUrl}
                  tags={result.tags}
                  equipment={result.equipment}
                  format={result.format}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-12 text-center">
              <p className="text-slate-400 text-lg mb-4">No results found</p>
              <p className="text-slate-500 text-sm">
                Try different search terms or check the Manage Sounds section
              </p>
            </div>
          )}
        </motion.div>
      )}

      {!hasSearched && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-12 text-center"
        >
          <SearchIcon className="size-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-lg mb-2">Start searching for sound effects</p>
          <p className="text-slate-500 text-sm">
            Search by title, tags, equipment, or format
          </p>
          <div className="mt-6 text-slate-500 text-sm">
            <p>Total sounds in library: <span className="text-purple-400">{customSounds.length}</span></p>
          </div>
        </motion.div>
      )}
    </div>
  );
}