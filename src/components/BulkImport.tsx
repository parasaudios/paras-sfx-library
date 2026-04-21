import { useState } from 'react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { toast } from 'sonner';
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
            tags: Array.isArray(sound.tags) ? sound.tags : [],
            microphone: sound.microphone || sound.equipment,
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
    <div className="bg-[#141820] border border-[#252a35] rounded-lg p-8">
      <div className="flex items-center gap-2 mb-4">
        <Upload className="size-5 text-[#10b981]" />
        <h3 className="text-white">Bulk Import Sounds</h3>
      </div>
      
      <p className="text-[#9ca3af] mb-4">
        Paste JSON array of sounds to import multiple sounds at once.
      </p>

      <div className="space-y-4">
        <div>
          <Label className="text-white mb-2">Sound Data (JSON)</Label>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder={`[\n  {\n    "title": "Door Creak",\n    "tags": ["door", "creak", "horror"],\n    "microphone": "Rode NT1-A",\n    "format": "WAV"\n  }\n]`}
            className="w-full h-64 bg-[#0f1218] border border-[#252a35] rounded-lg p-4 text-white placeholder:text-[#6b7280] font-mono text-sm"
          />
        </div>

        <Button
          onClick={handleBulkImport}
          disabled={loading || !jsonInput.trim()}
          className="w-full bg-[#10b981] hover:bg-[#0d9668]"
        >
          {loading ? 'Importing...' : 'Import Sounds'}
        </Button>
      </div>

      <div className="mt-6 p-4 bg-[#0f1218] rounded-lg border border-[#252a35]">
        <p className="text-[#9ca3af] text-sm mb-2">
          <strong className="text-white">Format Example:</strong>
        </p>
        <pre className="text-xs text-[#9ca3af] overflow-x-auto">
{`[
  {
    "title": "Sound Title",
    "tags": ["tag1", "tag2"],
    "microphone": "Microphone Name",
    "format": "WAV"
  }
]`}
        </pre>
      </div>
    </div>
  );
}