import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import * as api from '../utils/api';

interface LoginProps {
  onLogin: () => void;
}

export function Login({ onLogin }: LoginProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.signIn(identifier, password);
      toast.success('Login successful!');
      onLogin();
    } catch (error: any) {
      const msg = error?.message || '';
      const safeMsg = msg.includes('admin privileges') ? msg : 'Invalid credentials';
      toast.error(safeMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1017] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-[#141820] border border-[#252a35] rounded-lg p-6 sm:p-8">
          <h1 className="text-white text-center mb-6 sm:mb-8 text-2xl sm:text-3xl">Admin Login</h1>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div className="space-y-2">
              <Label htmlFor="identifier" className="text-white text-sm sm:text-base">Username or Email</Label>
              <Input
                id="identifier"
                type="text"
                autoComplete="username"
                placeholder="Enter username or email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="bg-[#0f1218] border-[#252a35] text-white placeholder:text-[#6b7280] h-10 sm:h-12 text-sm sm:text-base"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white text-sm sm:text-base">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-[#0f1218] border-[#252a35] text-white placeholder:text-[#6b7280] h-10 sm:h-12 text-sm sm:text-base"
                required
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-[#10b981] hover:bg-[#0d9668] h-10 sm:h-12 text-sm sm:text-base"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Login'}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
