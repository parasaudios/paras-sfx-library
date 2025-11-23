import { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner@2.0.3';

export function SuggestSoundForm() {
  const [open, setOpen] = useState(false);
  const [soundName, setSoundName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!soundName.trim()) {
      toast.error('Please enter a sound effect name');
      return;
    }

    // Mock submission - in a real app, this would send to an API
    console.log('Suggestion submitted:', { soundName, category, description });
    
    toast.success('Thank you for your suggestion!');
    
    // Reset form and close dialog
    setSoundName('');
    setCategory('');
    setDescription('');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-white/20 text-white hover:bg-white/10"
        >
          <Lightbulb className="size-4 mr-2" />
          Suggest A Sound Effect
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-white/20 text-white">
        <DialogHeader>
          <DialogTitle>Suggest A Sound Effect</DialogTitle>
          <DialogDescription className="text-slate-400">
            Can't find what you're looking for? Let us know what sound effect you'd like to see added to the library.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="soundName">Sound Effect Name *</Label>
            <Input
              id="soundName"
              placeholder="e.g., Door creak, Explosion, Footsteps"
              value={soundName}
              onChange={(e) => setSoundName(e.target.value)}
              className="bg-white/5 border-white/20 text-white placeholder:text-slate-400"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              placeholder="e.g., Nature, Urban, Fantasy"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-white/5 border-white/20 text-white placeholder:text-slate-400"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Additional Details</Label>
            <Textarea
              id="description"
              placeholder="Describe the sound effect in more detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-white/5 border-white/20 text-white placeholder:text-slate-400 min-h-24"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1 border-white/20 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              Submit Suggestion
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
