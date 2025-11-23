import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner@2.0.3';
import { Shield } from 'lucide-react';
import * as api from '../utils/api';

export function SuggestSoundFormSection() {
  const [soundName, setSoundName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [honeypot, setHoneypot] = useState(''); // Bot trap
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const formLoadTime = useRef<number>(Date.now());
  const interactionCount = useRef<number>(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!soundName.trim()) {
      toast.error('Please enter a sound effect name');
      return;
    }

    // Bot Protection: Honeypot field check
    if (honeypot) {
      console.warn('Bot detected: Honeypot field filled');
      toast.error('Submission failed. Please try again.');
      return;
    }

    // Bot Protection: Minimum interaction count
    if (interactionCount.current < 3) {
      toast.error('Please fill out the form fields');
      return;
    }

    // Bot Protection: Minimum time on form
    const currentTime = Date.now();
    const timeDifference = currentTime - formLoadTime.current;
    if (timeDifference < 3000) { // Minimum 3 seconds
      toast.error('Please take your time filling out the form');
      return;
    }

    // Rate Limiting: Check last submission time
    const lastSubmissionTime = localStorage.getItem('lastSuggestionSubmission');
    if (lastSubmissionTime) {
      const timeSinceLastSubmission = currentTime - parseInt(lastSubmissionTime);
      if (timeSinceLastSubmission < 60000) { // 1 minute cooldown
        const remainingSeconds = Math.ceil((60000 - timeSinceLastSubmission) / 1000);
        toast.error(`Please wait ${remainingSeconds} seconds before submitting again`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Create suggestion in database
      const result = await api.createSuggestion({
        soundName: soundName.trim(),
        category: category.trim(),
        description: description.trim(),
        submittedAt: new Date().toISOString(),
        isRead: false
      });

      if (result) {
        // Store last submission time for rate limiting
        localStorage.setItem('lastSuggestionSubmission', currentTime.toString());
        
        toast.success('Thank you for your suggestion!');
        
        // Reset form
        setSoundName('');
        setCategory('');
        setDescription('');
        setHoneypot('');
        setHasInteracted(false);
        formLoadTime.current = Date.now();
        interactionCount.current = 0;
      } else {
        toast.error('Failed to submit suggestion. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting suggestion:', error);
      toast.error('Failed to submit suggestion. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = () => {
    if (!hasInteracted) {
      setHasInteracted(true);
    }
    interactionCount.current++;
  };

  return (
    <div id="suggest-form" className="max-w-2xl mx-auto w-full px-4 sm:px-0">
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 sm:p-6 lg:p-8">
        <div className="mb-4 sm:mb-6">
          <h2 className="text-white mb-2 text-xl sm:text-2xl">Suggest A Sound Effect</h2>
          <p className="text-slate-400 text-sm sm:text-base">
            Can't find what you're looking for? Let us know what sound effect you'd like to see added to the library.
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div className="space-y-2">
            <Label htmlFor="soundName" className="text-white text-sm sm:text-base">Sound Effect Name *</Label>
            <Input
              id="soundName"
              placeholder="e.g., Door creak, Explosion, Footsteps"
              value={soundName}
              onChange={(e) => {
                setSoundName(e.target.value);
                handleInputChange();
              }}
              onFocus={handleInputChange}
              className="bg-white/5 border-white/20 text-white placeholder:text-slate-400 h-10 sm:h-12 text-sm sm:text-base"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category" className="text-white text-sm sm:text-base">Category</Label>
            <Input
              id="category"
              placeholder="e.g., Nature, Urban, Fantasy"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                handleInputChange();
              }}
              onFocus={handleInputChange}
              className="bg-white/5 border-white/20 text-white placeholder:text-slate-400 h-10 sm:h-12 text-sm sm:text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-white text-sm sm:text-base">Additional Details</Label>
            <Textarea
              id="description"
              placeholder="Describe the sound effect in more detail..."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                handleInputChange();
              }}
              onFocus={handleInputChange}
              className="bg-white/5 border-white/20 text-white placeholder:text-slate-400 min-h-24 sm:min-h-32 text-sm sm:text-base"
            />
          </div>

          {/* Honeypot field - hidden from real users, visible to bots */}
          <div className="absolute opacity-0 pointer-events-none" aria-hidden="true">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 h-10 sm:h-12 text-sm sm:text-base"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Suggestion'}
          </Button>

          {/* Security indicator */}
          <div className="flex items-center justify-center gap-2 pt-2">
            <Shield className="size-3 text-green-400" />
            <p className="text-xs text-slate-500">
              Protected against spam and bots
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}