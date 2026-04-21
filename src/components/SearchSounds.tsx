import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Search as SearchIcon, X } from 'lucide-react';
import { GoogleDriveAudioPlayer } from './GoogleDriveAudioPlayer';
import * as api from '../utils/api';
import type { Sound } from '../types/index';

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
        const microphoneLower = sfx.microphone?.toLowerCase() || '';
        const formatLower = sfx.format?.toLowerCase() || '';
        
        // Check if any search term matches title, tags, equipment, or format
        return searchTerms.some(term => 
          titleLower.includes(term) ||
          microphoneLower.includes(term) ||
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
        <div className="bg-[#141820] border border-[#252a35] rounded-lg p-8">
          <h2 className="text-white mb-6">Search Sound Effects</h2>
          
          <div className="flex gap-3">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#9ca3af] size-5" />
              <Input
                type="text"
                placeholder="Type the sfx you're looking for.."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-11 h-14 bg-[#0f1218] border-[#252a35] text-white placeholder:text-[#6b7280]"
              />
            </div>
            <Button
              onClick={handleSearch}
              className="h-14 px-8 bg-[#10b981] hover:bg-[#0d9668]"
            >
              Search
            </Button>
            {hasSearched && (
              <Button
                onClick={handleClearSearch}
                variant="outline"
                className="h-14 px-8 border-[#252a35] bg-transparent text-white hover:bg-[#1f2430]"
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
            <p className="text-[#9ca3af]">Found {results.length} sound{results.length !== 1 ? 's' : ''}</p>
          </div>

          {results.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((result, index) => (
                <GoogleDriveAudioPlayer
                  key={result.id}
                  sound={result}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <div className="bg-[#141820] border border-[#252a35] rounded-lg p-12 text-center">
              <p className="text-[#9ca3af] text-lg mb-4">No results found</p>
              <p className="text-[#6b7280] text-sm">
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
          className="bg-[#141820] border border-[#252a35] rounded-lg p-12 text-center"
        >
          <SearchIcon className="size-16 text-[#6b7280] mx-auto mb-4" />
          <p className="text-[#9ca3af] text-lg mb-2">Start searching for sound effects</p>
          <p className="text-[#6b7280] text-sm">
            Search by title, tags, equipment, or format
          </p>
          <div className="mt-6 text-[#6b7280] text-sm">
            <p>Total sounds in library: <span className="text-[#10b981]">{customSounds.length}</span></p>
          </div>
        </motion.div>
      )}
    </div>
  );
}