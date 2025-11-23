import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search } from 'lucide-react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { SuggestSoundFormSection } from './components/SuggestSoundFormSection';
import { Login } from './components/Login';
import { AdminDashboard } from './components/AdminDashboard';
import { GoogleDriveAudioPlayer } from './components/GoogleDriveAudioPlayer';
import { BrowseByTags } from './components/BrowseByTags';
import { AgeVerification } from './components/AgeVerification';
import { Toaster } from './components/ui/sonner';
import { searchSounds } from './utils/searchUtils';
import { isAgeVerified, setAgeVerified, filterNSFWSounds, isNSFW } from './utils/ageVerification';
import * as api from './utils/api';
import type { Sound } from './types';

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<Sound[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [allSounds, setAllSounds] = useState<Sound[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTags, setShowTags] = useState(false);
  const [managedTags, setManagedTags] = useState<string[]>([]);
  const [ageVerified, setAgeVerifiedState] = useState(isAgeVerified());
  const [showAgeVerification, setShowAgeVerification] = useState(false);
  const [pendingSearch, setPendingSearch] = useState<string | null>(null);
  
  // Load sounds from API on mount
  useEffect(() => {
    loadSounds();
    loadManagedTags();
  }, []);

  const loadSounds = async () => {
    setLoading(true);
    try {
      const sounds = await api.getAllSounds();
      console.log('Loaded sounds from API:', sounds);
      setAllSounds(sounds);
    } catch (error) {
      console.error('Failed to load sounds:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadManagedTags = async () => {
    try {
      const tags = await api.getAllTags();
      console.log('Loaded managed tags from API:', tags);
      setManagedTags(tags);
    } catch (error) {
      console.error('Failed to load managed tags:', error);
    }
  };

  const handleSearch = useCallback(() => {
    if (searchQuery.trim()) {
      const matchedResults = searchSounds(allSounds, searchQuery);
      
      // Check if any result contains NSFW content
      const hasNSFWContent = matchedResults.some(sound => isNSFW(sound.tags));
      
      if (hasNSFWContent && !ageVerified) {
        // Store pending search and show age verification
        setPendingSearch(searchQuery);
        setShowAgeVerification(true);
        return;
      }
      
      // Filter NSFW content if not verified
      const filteredResults = filterNSFWSounds(matchedResults, ageVerified);
      setResults(filteredResults);
      setShowResults(true);
    }
  }, [searchQuery, allSounds, ageVerified]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleNewSearch = () => {
    setShowResults(false);
    setSearchQuery('');
  };

  const handleShowAll = () => {
    // Check if library contains NSFW content
    const hasNSFWContent = allSounds.some(sound => isNSFW(sound.tags));
    
    if (hasNSFWContent && !ageVerified) {
      setPendingSearch('__VIEW_ALL__');
      setShowAgeVerification(true);
      return;
    }
    
    const filteredSounds = filterNSFWSounds(allSounds, ageVerified);
    setResults(filteredSounds);
    setSearchQuery('');
    setShowResults(true);
  };

  const scrollToForm = () => {
    const formElement = document.getElementById('suggest-form');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleLogin = () => {
    setIsLoggedIn(true);
    setShowLogin(false);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    // Reset to default search page
    setShowResults(false);
    setSearchQuery('');
    setResults([]);
    // Reload sounds when admin logs out to show any new additions
    loadSounds();
  };

  // Handle clicking on a tag
  const handleTagClick = (tag: string) => {
    setShowTags(false);
    
    // If "All Sounds" is clicked, show all sounds
    if (tag.toLowerCase() === 'all sounds') {
      handleShowAll();
      return;
    }
    
    setSearchQuery(tag);
    const matchedResults = searchSounds(allSounds, tag);
    
    // Check if results contain NSFW content
    const hasNSFWContent = matchedResults.some(sound => isNSFW(sound.tags));
    
    if (hasNSFWContent && !ageVerified) {
      setPendingSearch(tag);
      setShowAgeVerification(true);
      return;
    }
    
    const filteredResults = filterNSFWSounds(matchedResults, ageVerified);
    setResults(filteredResults);
    setShowResults(true);
  };

  // Handle age verification confirm
  const handleAgeVerified = () => {
    setAgeVerified(true);
    setAgeVerifiedState(true);
    setShowAgeVerification(false);
    
    // Execute pending search if any
    if (pendingSearch) {
      if (pendingSearch === '__VIEW_ALL__') {
        setResults(allSounds);
        setSearchQuery('');
        setShowResults(true);
      } else {
        const matchedResults = searchSounds(allSounds, pendingSearch);
        setResults(matchedResults);
        setSearchQuery(pendingSearch);
        setShowResults(true);
      }
      setPendingSearch(null);
    }
  };

  // Handle age verification decline
  const handleAgeDeclined = () => {
    setShowAgeVerification(false);
    setPendingSearch(null);
    
    // Show filtered results if there was a pending search
    if (pendingSearch && pendingSearch !== '__VIEW_ALL__') {
      const matchedResults = searchSounds(allSounds, pendingSearch);
      const filteredResults = filterNSFWSounds(matchedResults, false);
      setResults(filteredResults);
      setSearchQuery(pendingSearch);
      setShowResults(true);
    }
  };

  // Show login page if requested
  if (showLogin && !isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  // Show admin dashboard if logged in
  if (isLoggedIn) {
    return <AdminDashboard onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Age Verification Modal */}
      <AgeVerification
        isOpen={showAgeVerification}
        onVerify={handleAgeVerified}
        onDecline={handleAgeDeclined}
      />

      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <h2 className="text-white text-base sm:text-lg lg:text-xl">Para's SFX Library</h2>
              
              <div className="hidden sm:block w-px h-6 bg-white/20 mx-1"></div>
              
              {/* Social Media Icons - Hidden on smallest mobile */}
              <div className="hidden sm:flex items-center gap-2">
                <a
                  href="https://discord.com/invite/Ve6vaJwmQy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-white transition-colors"
                  title="Join our Discord"
                >
                  <svg className="size-4 sm:size-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                </a>
                <a
                  href="https://reddit.com/u/Paradoxxxical"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-white transition-colors"
                  title="Follow on Reddit"
                >
                  <svg className="size-4 sm:size-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12a12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547l-.8 3.747c1.824.07 3.48.632 4.674 1.488c.308-.309.73-.491 1.207-.491c.968 0 1.754.786 1.754 1.754c0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87c-3.874 0-7.004-2.176-7.004-4.87c0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754c.463 0 .898.196 1.207.49c1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197a.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248c.687 0 1.248-.561 1.248-1.249c0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25c0 .687.561 1.248 1.249 1.248c.688 0 1.249-.561 1.249-1.249c0-.687-.561-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094a.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913c.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463a.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73c-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
                  </svg>
                </a>
              </div>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2">
              {showResults && (
                <Button
                  onClick={handleNewSearch}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/10 text-xs sm:text-sm px-2 sm:px-4"
                >
                  <span className="hidden sm:inline">New Search</span>
                  <span className="sm:hidden">New</span>
                </Button>
              )}
              <Button
                onClick={scrollToForm}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10 text-xs sm:text-sm px-2 sm:px-4 hidden md:flex"
              >
                Suggest A Sound Effect
              </Button>
              <Button
                onClick={scrollToForm}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10 text-xs sm:text-sm px-2 sm:px-4 md:hidden"
              >
                Suggest
              </Button>
              <Button
                onClick={() => setShowLogin(true)}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10 text-xs sm:text-sm px-2 sm:px-4"
              >
                Admin
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="pt-16 sm:pt-20 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {!showResults ? (
              <motion.div
                key="search"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="flex items-center justify-center min-h-[calc(100vh-4rem)] sm:min-h-[calc(100vh-5rem)]"
              >
                <div className="w-full max-w-2xl px-4">
                  <motion.h1
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-white text-center mb-8 sm:mb-12 lg:mb-16 text-3xl sm:text-4xl md:text-5xl lg:text-6xl"
                  >
                    Para's SFX Library
                  </motion.h1>
                  
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 size-4 sm:size-5" />
                      <Input
                        type="text"
                        placeholder="Type the sfx you're looking for.."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="pl-9 sm:pl-11 h-12 sm:h-14 bg-white/10 border-white/20 text-white placeholder:text-slate-400 text-sm sm:text-base"
                      />
                    </div>
                    <Button
                      onClick={handleSearch}
                      className="h-12 sm:h-14 px-6 sm:px-8 bg-purple-600 hover:bg-purple-700 text-sm sm:text-base"
                    >
                      Search
                    </Button>
                  </div>
                  
                  {/* Expandable Tags Section */}
                  {!loading && (
                    <BrowseByTags
                      tags={managedTags}
                      showTags={showTags}
                      onToggle={() => setShowTags(!showTags)}
                      onTagClick={handleTagClick}
                    />
                  )}

                  {/* Library Counter and View All Link */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="mt-6 text-center"
                  >
                    <p className="text-slate-400 mb-2 text-sm sm:text-base">
                      {loading ? 'Loading...' : `${allSounds.length} sounds in library`}
                    </p>
                    <button
                      onClick={handleShowAll}
                      disabled={loading}
                      className="text-purple-400 hover:text-purple-300 transition-colors underline underline-offset-4 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                    >
                      View all sounds
                    </button>
                  </motion.div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
              >
                <div className="mb-6 sm:mb-8">
                  <h2 className="text-white mb-2 text-xl sm:text-2xl">
                    {searchQuery ? `Search Results for "${searchQuery}"` : 'All Sounds'}
                  </h2>
                  <p className="text-slate-400 text-sm sm:text-base">Found {results.length} tracks</p>
                </div>

                {/* Browse by Tags on Results Page */}
                <BrowseByTags
                  tags={managedTags}
                  showTags={showTags}
                  onToggle={() => setShowTags(!showTags)}
                  onTagClick={handleTagClick}
                />

                {results.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-6 sm:mt-8">
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
                  <div className="text-center py-12 sm:py-16">
                    <p className="text-slate-400 text-base sm:text-lg mb-4">No results found</p>
                    <p className="text-slate-500 text-xs sm:text-sm">
                      Try different search terms or add sounds via the Admin panel
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Suggest Form Section - Centered when scrolled to */}
          <div className="min-h-screen flex items-center justify-center py-12 sm:py-16 lg:py-20">
            <SuggestSoundFormSection />
          </div>
        </div>
      </div>
      
      {/* Toast notifications */}
      <Toaster />
    </div>
  );
}