import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { convertGoogleDriveUrl } from '../utils/audioUtils';
import { CheckCircle, XCircle } from 'lucide-react';

export function AudioUrlTest() {
  const [testUrl, setTestUrl] = useState('');
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [convertedUrl, setConvertedUrl] = useState('');

  const handleTest = () => {
    const converted = convertGoogleDriveUrl(testUrl);
    setConvertedUrl(converted);
    
    const audio = new Audio();
    audio.src = converted;
    
    audio.addEventListener('canplay', () => {
      setTestResult('success');
      audio.remove();
    });
    
    audio.addEventListener('error', () => {
      setTestResult('error');
      audio.remove();
    });
    
    audio.load();
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6 mb-6">
      <h3 className="text-white mb-4">Test Audio URL</h3>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="testUrl" className="text-white">Test URL</Label>
          <div className="flex gap-2">
            <Input
              id="testUrl"
              placeholder="Paste your audio URL here to test"
              value={testUrl}
              onChange={(e) => {
                setTestUrl(e.target.value);
                setTestResult(null);
              }}
              className="bg-white/5 border-white/20 text-white placeholder:text-slate-400 flex-1"
            />
            <Button
              onClick={handleTest}
              disabled={!testUrl}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Test
            </Button>
          </div>
        </div>

        {testResult && (
          <div className={`flex items-center gap-2 p-3 rounded ${
            testResult === 'success' 
              ? 'bg-green-500/20 text-green-200' 
              : 'bg-red-500/20 text-red-200'
          }`}>
            {testResult === 'success' ? (
              <>
                <CheckCircle className="size-5" />
                <span>URL is valid and audio can be loaded!</span>
              </>
            ) : (
              <>
                <XCircle className="size-5" />
                <span>Unable to load audio from this URL. Try a different hosting service.</span>
              </>
            )}
          </div>
        )}

        {convertedUrl && convertedUrl !== testUrl && (
          <div className="text-slate-300 text-sm">
            <p className="mb-1">Converted URL:</p>
            <code className="bg-black/30 px-2 py-1 rounded text-xs break-all block">
              {convertedUrl}
            </code>
          </div>
        )}
      </div>
    </div>
  );
}
