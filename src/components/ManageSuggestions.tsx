import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { Trash2, CheckCircle2, Circle } from 'lucide-react';
import * as api from '../utils/api';

interface Suggestion {
  id: string;
  soundName: string;
  category: string;
  description: string;
  submittedAt: string;
  isRead: boolean;
}

export function ManageSuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    loadSuggestions();
    
    // Reload suggestions when component becomes visible
    const interval = setInterval(loadSuggestions, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadSuggestions = async () => {
    const allSuggestions = await api.getAllSuggestions();
    setSuggestions(allSuggestions);
  };

  const toggleReadStatus = async (id: string) => {
    const suggestion = suggestions.find(s => s.id === id);
    if (!suggestion) return;

    const result = await api.updateSuggestion(id, { isRead: !suggestion.isRead });
    if (result) {
      const updated = suggestions.map(s =>
        s.id === id ? { ...s, isRead: !s.isRead } : s
      );
      setSuggestions(updated);
      toast.success('Suggestion status updated');
    } else {
      toast.error('Failed to update suggestion status');
    }
  };

  const deleteSuggestion = async (id: string) => {
    const success = await api.deleteSuggestion(id);
    if (success) {
      const updated = suggestions.filter(suggestion => suggestion.id !== id);
      setSuggestions(updated);
      toast.success('Suggestion deleted');
    } else {
      toast.error('Failed to delete suggestion');
    }
  };

  const unreadCount = suggestions.filter(s => !s.isRead).length;

  return (
    <div className="max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-white mb-2">Sound Effect Suggestions</h2>
            <p className="text-slate-400">
              Review and manage user suggestions for new sound effects
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-400">Total Suggestions</div>
            <div className="text-white">
              <span className="text-purple-400">{unreadCount}</span> unread / {suggestions.length} total
            </div>
          </div>
        </div>

        {suggestions.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-12 text-center">
            <p className="text-slate-400">No suggestions yet</p>
            <p className="text-slate-500 text-sm mt-2">
              When users submit sound effect suggestions, they'll appear here
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {suggestions.map((suggestion, index) => (
              <motion.div
                key={suggestion.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`bg-white/5 backdrop-blur-sm border rounded-lg p-6 ${
                  suggestion.isRead 
                    ? 'border-white/10 opacity-60' 
                    : 'border-purple-500/30 shadow-lg shadow-purple-500/10'
                }`}
              >
                {/* Header with Status */}
                <div className="flex items-start justify-between mb-4">
                  <Badge 
                    variant={suggestion.isRead ? "secondary" : "default"}
                    className={suggestion.isRead 
                      ? "bg-slate-600 text-slate-200" 
                      : "bg-purple-600 text-white"
                    }
                  >
                    {suggestion.isRead ? 'Read' : 'New'}
                  </Badge>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleReadStatus(suggestion.id)}
                      className="h-8 w-8 p-0 hover:bg-white/10"
                      title={suggestion.isRead ? "Mark as unread" : "Mark as read"}
                    >
                      {suggestion.isRead ? (
                        <Circle className="size-4 text-slate-400" />
                      ) : (
                        <CheckCircle2 className="size-4 text-green-400" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSuggestion(suggestion.id)}
                      className="h-8 w-8 p-0 hover:bg-red-500/10"
                      title="Delete suggestion"
                    >
                      <Trash2 className="size-4 text-red-400" />
                    </Button>
                  </div>
                </div>

                {/* Sound Name */}
                <div className="mb-4">
                  <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                    Sound Effect
                  </div>
                  <h3 className="text-white">{suggestion.soundName}</h3>
                </div>

                {/* Category */}
                {suggestion.category && (
                  <div className="mb-4">
                    <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                      Category
                    </div>
                    <Badge variant="outline" className="border-purple-500/30 text-purple-300">
                      {suggestion.category}
                    </Badge>
                  </div>
                )}

                {/* Description */}
                {suggestion.description && (
                  <div className="mb-4">
                    <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                      Details
                    </div>
                    <p className="text-slate-300 text-sm line-clamp-3">
                      {suggestion.description}
                    </p>
                  </div>
                )}

                {/* Timestamp */}
                <div className="pt-4 border-t border-white/10">
                  <div className="text-xs text-slate-500">
                    {new Date(suggestion.submittedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}