import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Shield, X } from 'lucide-react';
import { Button } from './ui/button';

interface AgeVerificationProps {
  isOpen: boolean;
  onVerify: () => void;
  onDecline: () => void;
}

export function AgeVerification({ isOpen, onVerify, onDecline }: AgeVerificationProps) {
  const [isClosing, setIsClosing] = useState(false);

  const handleDecline = () => {
    setIsClosing(true);
    setTimeout(() => {
      onDecline();
      setIsClosing(false);
    }, 200);
  };

  const handleVerify = () => {
    setIsClosing(true);
    setTimeout(() => {
      onVerify();
      setIsClosing(false);
    }, 200);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
            onClick={handleDecline}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ 
                opacity: isClosing ? 0 : 1, 
                scale: isClosing ? 0.9 : 1, 
                y: isClosing ? 20 : 0 
              }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md bg-gradient-to-br from-slate-900 to-purple-900 border-2 border-red-500/50 rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={handleDecline}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 text-slate-400 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="size-5 sm:size-6" />
              </button>

              <div className="p-6 sm:p-8">
                {/* Warning Icon */}
                <div className="flex justify-center mb-4 sm:mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full" />
                    <div className="relative bg-red-500/10 p-3 sm:p-4 rounded-full border-2 border-red-500/30">
                      <AlertTriangle className="size-8 sm:size-10 text-red-400" />
                    </div>
                  </div>
                </div>

                {/* Title */}
                <h2 className="text-white text-center mb-3 sm:mb-4 text-xl sm:text-2xl">
                  Age Verification Required
                </h2>

                {/* Description */}
                <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                  <p className="text-slate-300 text-center text-sm sm:text-base">
                    You are attempting to access content that may contain mature or explicit audio.
                  </p>
                  
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 sm:p-4">
                    <p className="text-red-300 text-xs sm:text-sm text-center">
                      <strong>Warning:</strong> This content is marked as NSFW (Not Safe For Work) and is intended for adults only.
                    </p>
                  </div>

                  <p className="text-white text-center text-sm sm:text-base">
                    Are you 18 years of age or older?
                  </p>
                </div>

                {/* Buttons */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
                  <Button
                    onClick={handleDecline}
                    variant="outline"
                    className="h-11 sm:h-12 bg-slate-800/50 border-slate-600 hover:bg-slate-700 text-white text-sm sm:text-base"
                  >
                    No, I'm Under 18
                  </Button>
                  <Button
                    onClick={handleVerify}
                    className="h-11 sm:h-12 bg-purple-600 hover:bg-purple-700 text-white text-sm sm:text-base"
                  >
                    Yes, I'm 18+
                  </Button>
                </div>

                {/* Privacy Notice */}
                <div className="flex items-start gap-2 pt-3 sm:pt-4 border-t border-white/10">
                  <Shield className="size-3 sm:size-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-slate-400">
                    Your age verification status will be stored locally on your device. No personal information is collected.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
