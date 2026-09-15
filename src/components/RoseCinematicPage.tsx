import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RoseScene, RosePhase } from '../webgl/RoseScene';
import { NahwDemoTopic, NAHW_DEMO_TOPICS } from '../data/nahwTopics';
import { GardenAudio } from '../webgl/AudioAmbience';
import { ArrowRight, RotateCcw, X } from 'lucide-react';

interface RoseCinematicPageProps {
  onBack: () => void;
  audio: GardenAudio;
}

export const RoseCinematicPage: React.FC<RoseCinematicPageProps> = ({ onBack, audio }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const roseSceneRef = useRef<RoseScene | null>(null);
  const [phase, setPhase] = useState<RosePhase>('sprouting');
  const [showCouplet, setShowCouplet] = useState(false);
  const [showTopicCards, setShowTopicCards] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<NahwDemoTopic | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new RoseScene(containerRef.current);
    roseSceneRef.current = scene;

    scene.onPhaseChange = (newPhase) => {
      setPhase(newPhase);
      if (newPhase === 'blooming') {
        audio.playRoseBloom();
      } else if (newPhase === 'exploding') {
        audio.playRoseExplode();
      }
    };

    scene.onBlackout = () => {
      // Screen is now fully dark; reveal only the couplet first, then let
      // the reader tap through to the topic cards.
      setTimeout(() => setShowCouplet(true), 700);
    };

    return () => {
      scene.destroy();
      roseSceneRef.current = null;
    };
  }, [audio]);

  const handleReplay = () => {
    setShowCouplet(false);
    setShowTopicCards(false);
    setSelectedTopic(null);
    if (roseSceneRef.current) {
      roseSceneRef.current.replay();
    }
  };

  return (
    <div
      id="rose-cinematic-page"
      className="relative w-screen h-screen overflow-hidden bg-[#050106] select-none text-neutral-100"
    >
      {/* 3D WebGL Canvas Viewport */}
      <div
        id="rose-webgl-canvas"
        ref={containerRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* True blackout overlay: covers any residual WebGL frame the instant
          the scene reaches the blackout phase, so nothing but the couplet
          shows next. */}
      <AnimatePresence>
        {phase === 'blackout' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 z-10 bg-black pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Cinematic Vignette (only while the scene itself is visible) */}
      {phase !== 'blackout' && (
        <div className="cinematic-vignette fixed inset-0 pointer-events-none z-10" />
      )}

      {/* Top Bar Navigation */}
      <header className="absolute top-0 inset-x-0 z-30 flex items-center justify-between p-5 md:p-8 pointer-events-none">
        <button
          id="back-to-garden-button"
          type="button"
          onClick={onBack}
          className="pointer-events-auto flex items-center gap-2.5 px-4 py-2 rounded-full border border-neutral-800 bg-[#0d040e]/85 backdrop-blur-md text-xs sm:text-sm font-medium text-neutral-300 hover:text-white hover:border-rose-800/80 transition-all shadow-xl shadow-black/90 cursor-pointer"
        >
          <ArrowRight className="w-4 h-4 text-rose-400" />
          <span>واپس گلستان کی طرف</span>
        </button>
      </header>

      {/* Phase status subtle watermark indicator */}
      <div className="absolute bottom-6 left-6 md:bottom-8 md:left-8 z-30 pointer-events-none">
        <AnimatePresence mode="wait">
          {phase === 'sprouting' && (
            <motion.div
              key="sprouting"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 0.75, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="text-[11px] font-mono tracking-widest text-neutral-400 uppercase flex items-center gap-2"
            >
              <span className="animate-pulse w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span>پردۂ خاک سے نمو // EMERGENCE</span>
            </motion.div>
          )}
          {phase === 'blooming' && (
            <motion.div
              key="blooming"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 0.85, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="text-[11px] font-mono tracking-widest text-rose-300 uppercase flex items-center gap-2"
            >
              <span className="animate-pulse w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.9)]" />
              <span>شگفتگیٔ گلِ صدبرگ // DIVINE BLOOM</span>
            </motion.div>
          )}
          {phase === 'exploding' && (
            <motion.div
              key="exploding"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 0.9, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="text-[11px] font-mono tracking-widest text-pink-300 uppercase flex items-center gap-2"
            >
              <span className="animate-pulse w-2 h-2 rounded-full bg-pink-400 shadow-[0_0_10px_rgba(244,114,182,0.9)]" />
              <span>چاکِ گریباں: بکھرتی پنکھڑیاں // PETAL STORM</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Stage 4: Deep Blackout — only the two verses appear */}
      <AnimatePresence>
        {showCouplet && !showTopicCards && (
          <motion.div
            id="silver-couplet-container"
            initial={{ opacity: 0, scale: 0.94, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -15 }}
            transition={{ duration: 2.4, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center cursor-pointer"
            dir="rtl"
            onClick={() => setShowTopicCards(true)}
          >
            <div className="max-w-4xl mx-auto space-y-7 relative">
              <div className="absolute inset-0 -inset-x-8 bg-radial from-slate-100/10 via-rose-500/5 to-transparent blur-3xl pointer-events-none" />
              <div className="relative urdu-nastaliq text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-[2.5] md:leading-[2.8] tracking-wide font-normal radiant-silver-couplet">
                <p>الله رے اثر نالوں کا تیرے بلبل</p>
                <p className="mt-2">پردہ خاک سے گل چاک گریباں نکلا</p>
              </div>
              <div className="flex items-center justify-center gap-4 pt-2 opacity-75">
                <span className="w-16 h-px bg-gradient-to-l from-slate-200 via-slate-400 to-transparent shadow-[0_0_8px_#ffffff]" />
                <span className="w-2 h-2 rounded-full bg-white shadow-[0_0_12px_#ffffff] animate-ping" />
                <span className="w-16 h-px bg-gradient-to-r from-slate-200 via-slate-400 to-transparent shadow-[0_0_8px_#ffffff]" />
              </div>
              <p className="text-xs sm:text-sm font-mono tracking-widest text-slate-300/85 uppercase pt-1">
                نغمۂ بلبل، چاکِ گریباں، اور پردۂ خاک سے معانی و نحو کا ظہور
              </p>
              <p className="text-[10px] font-mono tracking-[0.3em] text-neutral-500 uppercase pt-4 animate-pulse">
                TAP TO CONTINUE
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stage 5: Nahw topic cards — arranged like a hand of cards the reader
          taps to open a topic, replacing the earlier floating-petal badges. */}
      <AnimatePresence>
        {showTopicCards && (
          <motion.div
            id="nahw-topic-cards"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-8 p-6 bg-black"
          >
            <h2 className="urdu-nastaliq text-2xl md:text-3xl text-rose-200 text-center" dir="rtl">
              مباحثِ علمِ نحو
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-w-4xl w-full">
              {NAHW_DEMO_TOPICS.map((topic, idx) => (
                <motion.button
                  key={topic.id}
                  type="button"
                  id={`nahw-topic-card-${topic.id}`}
                  initial={{ opacity: 0, y: 24, rotate: (idx % 2 === 0 ? -1 : 1) * 3 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  transition={{ delay: idx * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => setSelectedTopic(topic)}
                  className="group relative flex flex-col items-center justify-center gap-2 aspect-[3/4] rounded-2xl border border-rose-900/60 bg-gradient-to-b from-[#1c0817] to-[#0e030c] p-4 shadow-2xl shadow-black hover:border-rose-400/80 hover:-translate-y-1 transition-all cursor-pointer"
                  dir="rtl"
                >
                  <span className="absolute top-2 left-2 text-[9px] font-mono text-rose-500/70">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="font-arabic text-2xl md:text-3xl text-rose-100 group-hover:text-white text-center">
                    {topic.titleArabic}
                  </span>
                  <span className="text-[10px] font-mono text-rose-400/80 px-2 py-0.5 rounded-full bg-rose-950/60">
                    {topic.category}
                  </span>
                </motion.button>
              ))}
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                id="replay-bloom-button"
                type="button"
                onClick={handleReplay}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-neutral-600 bg-[#120512]/90 hover:bg-[#200820] hover:border-slate-300 text-xs sm:text-sm text-slate-100 transition-all shadow-2xl shadow-black cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-rose-400" />
                <span>دوبارہ مشاہدہ کریں // REPLAY</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected Topic Detail Card */}
      <AnimatePresence>
        {selectedTopic && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setSelectedTopic(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-md w-full rounded-2xl border border-rose-500/40 bg-gradient-to-b from-[#1c0817]/95 to-[#0e030c]/95 p-6 shadow-2xl shadow-rose-950/80 text-right"
              dir="rtl"
            >
              <button
                id="close-topic-modal-button"
                type="button"
                onClick={() => setSelectedTopic(null)}
                className="absolute top-4 left-4 p-1 rounded-full border border-neutral-700 hover:border-rose-400 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 mb-3">
                <span className="px-2.5 py-0.5 rounded-full bg-rose-950 border border-rose-800/60 text-[11px] font-mono text-rose-300">
                  {selectedTopic.category}
                </span>
                <span className="text-xs font-mono text-neutral-400" dir="ltr">
                  {selectedTopic.meaning}
                </span>
              </div>

              <h3 className="urdu-nastaliq text-3xl font-medium text-transparent bg-clip-text bg-gradient-to-r from-rose-200 via-white to-rose-300 drop-shadow-[0_0_12px_rgba(255,100,150,0.5)]">
                {selectedTopic.titleArabic}
              </h3>

              <div className="mt-4 p-3.5 rounded-xl border border-rose-900/40 bg-[#2b0c22]/50 text-center">
                <div className="text-xs font-mono text-rose-300/80 mb-1 tracking-wider uppercase">
                  مثالِ نحوی // Grammatical Example
                </div>
                <div className="font-arabic text-2xl text-white tracking-wide">
                  {selectedTopic.exampleArabic}
                </div>
              </div>

              <p className="urdu-nastaliq text-lg text-neutral-300 leading-relaxed mt-4">
                {selectedTopic.exampleUrdu}
              </p>

              <div className="mt-5 pt-3 border-t border-rose-950 flex items-center justify-between text-[11px] text-neutral-400 font-mono" dir="ltr">
                <span>Part of Nahw Garden Taxonomy</span>
                <button
                  type="button"
                  onClick={() => setSelectedTopic(null)}
                  className="text-rose-400 hover:text-rose-300 underline cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
