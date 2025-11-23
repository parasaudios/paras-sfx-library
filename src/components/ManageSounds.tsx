import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner@2.0.3';
import { Trash2, Search, X, Save } from 'lucide-react';
import * as api from '../utils/api';
import { capitalizeWords } from '../utils/formatters';
import { formatTagForDisplay } from '../utils/tagUtils';

interface Sound {
  id: string;
  title: string;
  audioUrl: string;
  tags: string[];
  equipment?: string;
  format?: string;
}

export function ManageSounds() {
  const [customSounds, setCustomSounds] = useState<Sound[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    audioUrl: '',
    tags: '',
    equipment: '',
    format: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load custom sounds from API
    loadSounds();
  }, []);

  const loadSounds = async () => {
    const sounds = await api.getAllSounds();
    setCustomSounds(sounds);
  };

  // Filter sounds by tag search
  const filteredSounds = customSounds.filter((sound) => {
    if (!searchQuery.trim()) return true;
    
    const searchLower = searchQuery.toLowerCase();
    const titleMatch = sound.title.toLowerCase().includes(searchLower);
    const tagMatch = sound.tags.some(tag => tag.toLowerCase().includes(searchLower));
    const equipmentMatch = sound.equipment?.toLowerCase().includes(searchLower);
    const formatMatch = sound.format?.toLowerCase().includes(searchLower);
    
    return titleMatch || tagMatch || equipmentMatch || formatMatch;
  });

  const handleEdit = (sound: Sound) => {
    setEditingId(sound.id);
    setEditForm({ 
      title: sound.title,
      audioUrl: sound.audioUrl,
      tags: sound.tags.join(', '),
      equipment: sound.equipment || '',
      format: sound.format || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({
      title: '',
      audioUrl: '',
      tags: '',
      equipment: '',
      format: ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editForm.title.trim() || !editForm.audioUrl.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const updatedData = {
        title: editForm.title,
        audioUrl: editForm.audioUrl,
        tags: editForm.tags.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag.length > 0),
        equipment: editForm.equipment || undefined,
        format: editForm.format || undefined
      };

      const result = await api.updateSound(editingId as string, updatedData);
      
      if (result) {
        // Update local state
        const updatedSounds = customSounds.map((sound) =>
          sound.id === editingId ? { ...sound, ...updatedData } : sound
        );
        setCustomSounds(updatedSounds);
        toast.success('Sound effect updated successfully!');
        
        setEditingId(null);
        setEditForm({
          title: '',
          audioUrl: '',
          tags: '',
          equipment: '',
          format: ''
        });
      } else {
        toast.error('Failed to update sound effect');
      }
    } catch (error) {
      console.error('Error updating sound:', error);
      toast.error('Failed to update sound effect');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      const success = await api.deleteSound(id);
      if (success) {
        const updatedSounds = customSounds.filter(sound => sound.id !== id);
        setCustomSounds(updatedSounds);
        toast.success('Sound effect deleted');
      } else {
        toast.error('Failed to delete sound effect');
      }
    } catch (error) {
      console.error('Error deleting sound:', error);
      toast.error('Failed to delete sound effect');
    } finally {
      setLoading(false);
    }
  };

  const handleEditFormChange = (field: keyof typeof editForm, value: string) => {
    setEditForm({
      ...editForm,
      [field]: value
    });
  };

  return (
    <div className="max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 size-5" />
              <Input
                type="text"
                placeholder="Search by title, tag, equipment, or format..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 h-12 bg-white/5 border-white/20 text-white placeholder:text-slate-400"
              />
            </div>
            <div className="text-slate-400 whitespace-nowrap">
              {filteredSounds.length} of {customSounds.length} sounds
            </div>
          </div>
        </div>
      </motion.div>

      {filteredSounds.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          {filteredSounds.map((sound) => (
            <div
              key={sound.id}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6"
            >
              {editingId === sound.id && editForm ? (
                // Edit Mode
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white">Edit Sound Effect</h3>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSaveEdit}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Save className="size-4 mr-2" />
                        Save
                      </Button>
                      <Button
                        onClick={handleCancelEdit}
                        size="sm"
                        variant="ghost"
                        className="text-slate-400 hover:text-white hover:bg-white/10"
                      >
                        <X className="size-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-white">Title *</Label>
                      <Input
                        value={editForm.title}
                        onChange={(e) => handleEditFormChange('title', e.target.value)}
                        className="bg-white/5 border-white/20 text-white placeholder:text-slate-400"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-white">Equipment</Label>
                      <Input
                        value={editForm.equipment}
                        onChange={(e) => handleEditFormChange('equipment', e.target.value)}
                        className="bg-white/5 border-white/20 text-white placeholder:text-slate-400"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-white">Format</Label>
                      <Input
                        value={editForm.format}
                        onChange={(e) => handleEditFormChange('format', e.target.value)}
                        className="bg-white/5 border-white/20 text-white placeholder:text-slate-400"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-white">Tags (comma separated)</Label>
                      <Input
                        value={editForm.tags}
                        onChange={(e) => handleEditFormChange('tags', e.target.value)}
                        className="bg-white/5 border-white/20 text-white placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">Google Drive Link *</Label>
                    <Input
                      value={editForm.audioUrl}
                      onChange={(e) => handleEditFormChange('audioUrl', e.target.value)}
                      className="bg-white/5 border-white/20 text-white placeholder:text-slate-400"
                    />
                  </div>
                </div>
              ) : (
                // View Mode
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <h3 className="text-white mb-3">{sound.title}</h3>
                    
                    <div className="space-y-2 text-slate-300 text-sm">
                      {sound.equipment && (
                        <div>
                          <span className="text-slate-400">Equipment:</span>{' '}
                          {sound.equipment.split(',').map((item, index) => (
                            <span key={index}>
                              {capitalizeWords(item.trim())}
                              {index < sound.equipment.split(',').length - 1 ? ', ' : ''}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      {sound.format && (
                        <div>
                          <span className="text-slate-400">Audio Format:</span> {capitalizeWords(sound.format)}
                        </div>
                      )}
                      
                      {sound.tags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-slate-400">Tags:</span>
                          {sound.tags.map((tag, index) => (
                            <span
                              key={`${tag}-${index}`}
                              className="inline-block text-xs bg-purple-600/30 text-purple-200 px-2 py-1 rounded-full"
                            >
                              {formatTagForDisplay(tag)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="text-slate-500 text-sm break-all pt-2">
                      <strong>URL:</strong> {sound.audioUrl}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleEdit(sound)}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Edit
                    </Button>
                    <Button
                      onClick={() => handleDelete(sound.id)}
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-12 text-center"
        >
          <p className="text-slate-400 text-lg">
            {searchQuery ? 'No sounds found matching your search' : 'No sounds added yet'}
          </p>
          {searchQuery && (
            <Button
              onClick={() => setSearchQuery('')}
              variant="ghost"
              className="text-purple-400 hover:text-purple-300 hover:bg-purple-400/10 mt-4"
            >
              Clear search
            </Button>
          )}
        </motion.div>
      )}
    </div>
  );
}