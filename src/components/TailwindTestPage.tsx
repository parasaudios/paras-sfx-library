export function TailwindTestPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 shadow-2xl">
          <h1 className="text-4xl font-bold text-white mb-4">Tailwind CSS Test Page</h1>
          <p className="text-white/80 text-lg">Testing if all Tailwind utilities are loading correctly</p>
        </div>

        {/* Grid Layout Test */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Card 1 - Colors & Backgrounds */}
          <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl p-6 shadow-lg">
            <h2 className="text-2xl font-semibold text-white mb-3">Colors Test</h2>
            <div className="space-y-2">
              <div className="bg-red-500 text-white px-4 py-2 rounded">Red</div>
              <div className="bg-blue-500 text-white px-4 py-2 rounded">Blue</div>
              <div className="bg-green-500 text-white px-4 py-2 rounded">Green</div>
              <div className="bg-yellow-500 text-white px-4 py-2 rounded">Yellow</div>
            </div>
          </div>

          {/* Card 2 - Spacing & Sizing */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <h2 className="text-2xl font-semibold text-white mb-3">Spacing Test</h2>
            <div className="space-y-4">
              <div className="w-full h-8 bg-purple-600 rounded"></div>
              <div className="w-3/4 h-8 bg-purple-500 rounded"></div>
              <div className="w-1/2 h-8 bg-purple-400 rounded"></div>
              <div className="w-1/4 h-8 bg-purple-300 rounded"></div>
            </div>
          </div>

          {/* Card 3 - Flexbox */}
          <div className="bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl p-6">
            <h2 className="text-2xl font-semibold text-white mb-3">Flexbox Test</h2>
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 bg-white/20 p-4 rounded text-white text-center">1</div>
              <div className="flex-1 bg-white/20 p-4 rounded text-white text-center">2</div>
              <div className="flex-1 bg-white/20 p-4 rounded text-white text-center">3</div>
            </div>
          </div>

        </div>

        {/* Typography Test */}
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8">
          <h2 className="text-3xl font-bold text-white mb-6">Typography Test</h2>
          <div className="space-y-4 text-white">
            <p className="text-xs">Extra Small Text (text-xs)</p>
            <p className="text-sm">Small Text (text-sm)</p>
            <p className="text-base">Base Text (text-base)</p>
            <p className="text-lg">Large Text (text-lg)</p>
            <p className="text-xl">Extra Large Text (text-xl)</p>
            <p className="text-2xl font-bold">2XL Bold Text (text-2xl font-bold)</p>
            <p className="text-3xl font-extrabold">3XL Extra Bold (text-3xl font-extrabold)</p>
          </div>
        </div>

        {/* Buttons & Interactive */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-8">
          <h2 className="text-3xl font-bold text-white mb-6">Buttons & Hover Effects</h2>
          <div className="flex flex-wrap gap-4">
            <button className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl">
              Primary Button
            </button>
            <button className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-lg border border-white/30 transition-all duration-200">
              Secondary Button
            </button>
            <button className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white px-6 py-3 rounded-lg transition-all duration-200">
              Gradient Button
            </button>
            <button className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-all duration-200">
              Destructive Button
            </button>
          </div>
        </div>

        {/* Borders & Shadows */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white/10 p-6 rounded-lg border-2 border-purple-500 text-white text-center">
            Border 2px
          </div>
          <div className="bg-white/10 p-6 rounded-lg shadow-sm text-white text-center">
            Shadow SM
          </div>
          <div className="bg-white/10 p-6 rounded-lg shadow-lg text-white text-center">
            Shadow LG
          </div>
          <div className="bg-white/10 p-6 rounded-lg shadow-2xl text-white text-center">
            Shadow 2XL
          </div>
        </div>

        {/* Opacity & Blur */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-purple-500/25 backdrop-blur-sm p-6 rounded-lg text-white text-center">
            Opacity 25% + Blur SM
          </div>
          <div className="bg-purple-500/50 backdrop-blur-md p-6 rounded-lg text-white text-center">
            Opacity 50% + Blur MD
          </div>
          <div className="bg-purple-500/75 backdrop-blur-lg p-6 rounded-lg text-white text-center">
            Opacity 75% + Blur LG
          </div>
        </div>

        {/* Animations & Transitions */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-8">
          <h2 className="text-3xl font-bold text-white mb-6">Transitions Test</h2>
          <div className="flex gap-4">
            <div className="bg-purple-600 w-20 h-20 rounded-lg transition-transform duration-300 hover:scale-110 hover:rotate-12 cursor-pointer"></div>
            <div className="bg-pink-600 w-20 h-20 rounded-lg transition-all duration-500 hover:scale-125 hover:rounded-full cursor-pointer"></div>
            <div className="bg-blue-600 w-20 h-20 rounded-lg animate-pulse cursor-pointer"></div>
            <div className="bg-green-600 w-20 h-20 rounded-lg transition-all duration-300 hover:shadow-2xl hover:shadow-green-500/50 cursor-pointer"></div>
          </div>
        </div>

        {/* Responsive Test Info */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-8 text-white">
          <h2 className="text-3xl font-bold mb-4">Responsive Breakpoints</h2>
          <div className="space-y-2">
            <p className="block sm:hidden">📱 Currently: Mobile ({'<'} 640px)</p>
            <p className="hidden sm:block md:hidden">📱 Currently: SM (640px - 768px)</p>
            <p className="hidden md:block lg:hidden">💻 Currently: MD (768px - 1024px)</p>
            <p className="hidden lg:block xl:hidden">🖥️ Currently: LG (1024px - 1280px)</p>
            <p className="hidden xl:block">🖥️ Currently: XL ({'>'} 1280px)</p>
          </div>
        </div>

        {/* CSS File Size Info */}
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-8">
          <h2 className="text-3xl font-bold text-yellow-200 mb-4">⚠️ Diagnostic Info</h2>
          <div className="text-yellow-100 space-y-2">
            <p className="text-lg">Open DevTools → Network tab → Look for "globals.css"</p>
            <p className="text-sm">• If CSS is ~1.81kb → Tailwind is NOT generating utilities ❌</p>
            <p className="text-sm">• If CSS is {'>'} 10kb → Tailwind is working correctly ✅</p>
            <p className="text-sm mt-4">• If you see colors and effects on this page → Tailwind works ✅</p>
            <p className="text-sm">• If everything is black/white/unstyled → Tailwind broken ❌</p>
          </div>
        </div>

      </div>
    </div>
  );
}