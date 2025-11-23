import { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { capitalizeWords } from '../utils/formatters';
import { formatTagForDisplay } from '../utils/tagUtils';

interface BrowseByTagsProps {
  tags: string[];
  showTags: boolean;
  onToggle: () => void;
  onTagClick: (tag: string) => void;
}

export function BrowseByTags({ tags, showTags, onToggle, onTagClick }: BrowseByTagsProps) {
  // Memoize the combined tags array to avoid recreation on every render
  const allTags = useMemo(() => ['all sounds', ...tags], [tags]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="mt-4 sm:mt-6"
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-white transition-colors text-sm sm:text-base"
      >
        <span>Browse By Tag</span>
        {showTags ? (
          <ChevronUp className="size-3 sm:size-4" />
        ) : (
          <ChevronDown className="size-3 sm:size-4" />
        )}
      </button>

      <AnimatePresence>
        {showTags && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mt-3 sm:mt-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 sm:p-6">
              <div className="flex flex-wrap gap-2 justify-center">
                {allTags.map((tag, index) => (
                  <motion.button
                    key={tag}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => onTagClick(tag)}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 border rounded-full transition-all text-xs sm:text-sm ${
                      tag === 'all sounds'
                        ? 'bg-blue-600/20 hover:bg-blue-600/40 border-blue-500/30 hover:border-blue-500/50 text-blue-300 hover:text-white'
                        : 'bg-purple-600/20 hover:bg-purple-600/40 border-purple-500/30 hover:border-purple-500/50 text-purple-300 hover:text-white'
                    }`}
                  >
                    {tag === 'all sounds' ? capitalizeWords(tag) : formatTagForDisplay(tag)}
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}