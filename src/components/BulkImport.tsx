import { useState } from 'react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { toast } from 'sonner@2.0.3';
import { Upload } from 'lucide-react';
import * as api from '../utils/api';

interface BulkImportProps {
  onImportComplete: () => void;
}

export function BulkImport({ onImportComplete }: BulkImportProps) {
  const [jsonInput, setJsonInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleBulkImport = async () => {
    if (!jsonInput.trim()) {
      toast.error('Please paste your sound data');
      return;
    }

    setLoading(true);
    try {
      const sounds = JSON.parse(jsonInput);
      
      if (!Array.isArray(sounds)) {
        toast.error('Data must be an array of sounds');
        setLoading(false);
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const sound of sounds) {
        try {
          const result = await api.createSound({
            title: sound.title || 'Untitled',
            audioUrl: sound.audioUrl || sound.url || '',
            tags: Array.isArray(sound.tags) ? sound.tags : [],
            equipment: sound.equipment,
            format: sound.format,
          });

          if (result) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          console.error('Error importing sound:', error);
          errorCount++;
        }
      }

      toast.success(`Imported ${successCount} sound(s). ${errorCount > 0 ? `${errorCount} failed.` : ''}`);
      setJsonInput('');
      onImportComplete();
    } catch (error) {
      console.error('Bulk import error:', error);
      toast.error('Invalid JSON format. Please check your data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-8">
      <div className="flex items-center gap-2 mb-4">
        <Upload className="size-5 text-purple-400" />
        <h3 className="text-white">Bulk Import Sounds</h3>
      </div>
      
      <p className="text-slate-400 mb-4">
        Paste JSON array of sounds to import multiple sounds at once.
      </p>

      <div className="space-y-4">
        <div>
          <Label className="text-white mb-2">Sound Data (JSON)</Label>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder={`[\n  {\n    "title": "Door Creak",\n    "audioUrl": "https://drive.google.com/file/d/YOUR_ID/view",\n    "tags": ["door", "creak", "horror"],\n    "equipment": "Rode NT1-A",\n    "format": "WAV"\n  }\n]`}
            className="w-full h-64 bg-white/5 border border-white/20 rounded-lg p-4 text-white placeholder:text-slate-500 font-mono text-sm"
          />
        </div>

        <Button
          onClick={handleBulkImport}
          disabled={loading || !jsonInput.trim()}
          className="w-full bg-purple-600 hover:bg-purple-700"
        >
          {loading ? 'Importing...' : 'Import Sounds'}
        </Button>
      </div>

      <div className="mt-6 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
        <p className="text-slate-400 text-sm mb-2">
          <strong className="text-white">Format Example:</strong>
        </p>
        <pre className="text-xs text-slate-400 overflow-x-auto">
{`[
  {
    "title": "Sound Title",
    "audioUrl": "https://drive.google.com/...",
    "tags": ["tag1", "tag2"],
    "equipment": "Microphone Name",
    "format": "WAV"
  }
]`}
        </pre>
      </div>
    </div>
  );
}