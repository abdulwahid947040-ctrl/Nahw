import React, { useState } from 'react';
import { Volume2, VolumeX, ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';
import { GardenAudio } from '../webgl/AudioAmbience';

export const AudioToggle: React.FC<{ audio: GardenAudio }> = ({ audio }) => {
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const handleToggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    const muted = audio.toggleMute();
    setIsMuted(muted);
  };

  return (
    <button
      id="audio-toggle-button"
      onClick={handleToggleSound}
      className="fixed top-6 left-6 z-50 p-3 rounded-full bg-black/50 hover:bg-black/75 border border-rose-500/20 hover:border-rose-400/40 text-rose-200 hover:text-white transition-all duration-300 backdrop-blur-md cursor-pointer shadow-lg active:scale-95 pointer-events-auto"
      aria-label="Audio"
    >
      {isMuted ? (
        <VolumeX className="w-5 h-5 opacity-70" />
      ) : (
        <Volume2 className="w-5 h-5 text-rose-300" />
      )}
    </button>
  );
};

export const HeroTitle: React.FC<{ mousePos: { x: number; y: number } }> = ({ mousePos }) => {
  // Subtle interactive parallax for the title
  const tiltX = mousePos.x * 10;
  const tiltY = mousePos.y * -6;

  return (
    <section
      id="hero-title-section"
      className="min-h-screen w-full flex flex-col items-center justify-between py-12 px-6 relative pointer-events-none"
    >
      <div className="h-10 w-full" />

      {/* Main Title "نحو زار" */}
      <motion.div
        id="title-motion-wrapper"
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
        style={{
          transform: `perspective(1000px) rotateY(${tiltX}deg) rotateX(${tiltY}deg)`,
        }}
        className="relative transition-transform duration-300 ease-out text-center"
      >
        <h1
          id="main-web-title"
          dir="rtl"
          className="arabic-title text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-bold tracking-normal leading-tight relative cursor-default select-none"
        >
          نحو زار
        </h1>
      </motion.div>

      {/* Scroll Down Invitation */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 1.4 }}
        className="flex flex-col items-center gap-2 text-rose-300/70 pointer-events-auto"
      >
        <span className="text-xs tracking-widest font-mono uppercase text-rose-300/50">
          سکرول کیجیے / SCROLL
        </span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 2.0, ease: 'easeInOut' }}
        >
          <ChevronDown className="w-5 h-5 text-rose-400/70" />
        </motion.div>
      </motion.div>
    </section>
  );
};
