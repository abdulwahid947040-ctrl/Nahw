import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RoseScene, RosePhase, TrackedPetalInfo, NahwDemoTopic, NAHW_DEMO_TOPICS } from '../webgl/RoseScene';
import { GardenAudio } from '../webgl/AudioAmbience';
import { ArrowRight, RotateCcw, Sparkles, BookOpen, X } from 'lucide-react';

interface RoseCinematicPageProps {
  onBack: () => void;
  audio: GardenAudio;
}

export const RoseCinematicPage: React.FC<RoseCinematicPageProps> = ({ onBack, audio }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const roseSceneRef = useRef<RoseScene | null>(null);
  const [phase, setPhase] = useState<RosePhase>('sprouting');
  const [showCouplet, setShowCouplet] = useState(false);
  const [trackedPetals, setTrackedPetals] = useState<TrackedPetalInfo[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<NahwDemoTopic | null>(null);
  const [showTopicDrawer, setShowTopicDrawer] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize 3D Realistic Rose Scene with divine Godray and glowing petals
    const scene = new RoseScene(containerRef.current);
    roseSceneRef.current = scene;

    scene.onPhaseChange = (newPhase) => {
      setPhase(newPhase);
      if (newPhase === 'blooming') {
        audio.playRoseBloom();
      } else if (newPhase === 'exploding') {
        audio.playRoseExplode();
      } else if (newPhase === 'darkness') {
        setTimeout(() => {
          setShowCouplet(true);
        }, 800);
      }
    };

    scene.onUpdateTrackedPetals = (petals) => {
      // Throttle/update state for screen-space floating topic badges
      setTrackedPetals([...petals]);
    };

    return () => {
      scene.destroy();
      roseSceneRef.current = null;
    };
  }, [audio]);

  const handleReplay = () => {
    setShowCouplet(false);
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

      {/* Cinematic Vignette */}
      <div className="cinematic-vignette fixed inset-0 pointer-events-none z-10" />

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

        {/* Topic of Nahw Minimal Badge & Drawer Toggle */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            id="toggle-nahw-drawer-button"
            type="button"
            onClick={() => setShowTopicDrawer((prev) => !prev)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-rose-900/60 bg-neutral-950/80 hover:bg-rose-950/40 hover:border-rose-500/70 backdrop-blur-md text-xs font-mono tracking-wider text-rose-200 transition-all cursor-pointer shadow-lg"
          >
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <BookOpen className="w-3.5 h-3.5 text-rose-400" />
            <span>مباحثِ نحو ({NAHW_DEMO_TOPICS.length})</span>
          </button>
        </div>
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
              <span>پردۂ خاک سے نمو // EMERGENCE</span>
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
              <Sparkles className="w-3.5 h-3.5 text-pink-400 animate-spin" />
              <span>چاکِ گریباں: بکھرتی پنکھڑیاں // PETAL SCATTER</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Glowing Topic Badges on Drifting Petals in 3D */}
      <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
        {trackedPetals.map((item) => {
          if (!item.inView || item.opacity < 0.15) return null;

          return (
            <div
              key={item.topic.id}
              style={{
                left: `${item.screenX}%`,
                top: `${item.screenY}%`,
                opacity: item.opacity,
                transform: 'translate(-50%, -50%)',
              }}
              className="absolute pointer-events-auto transition-all duration-300"
            >
              <button
                id={`petal-topic-badge-${item.topic.id}`}
                type="button"
                onClick={() => setSelectedTopic(item.topic)}
                className="group relative flex items-center gap-1.5 px-3 py-1 rounded-full glowing-petal-badge cursor-pointer hover:scale-110 active:scale-95 transition-transform"
                title={`${item.topic.titleArabic} - ${item.topic.meaning}`}
              >
                {/* Glowing center spark */}
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 group-hover:bg-rose-300 shadow-[0_0_8px_#ff4d79]" />

                {/* Arabic Title */}
                <span className="font-arabic text-xs font-semibold text-rose-100 group-hover:text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                  {item.topic.titleArabic}
                </span>

                {/* Category tiny pill */}
                <span className="text-[9px] font-mono text-rose-300/80 px-1 py-0.2 rounded bg-rose-950/60">
                  {item.topic.category}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Selected Petal Topic Modal Card */}
      <AnimatePresence>
        {selectedTopic && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
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
              {/* Close button */}
              <button
                id="close-topic-modal-button"
                type="button"
                onClick={() => setSelectedTopic(null)}
                className="absolute top-4 left-4 p-1 rounded-full border border-neutral-700 hover:border-rose-400 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Tag header */}
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2.5 py-0.5 rounded-full bg-rose-950 border border-rose-800/60 text-[11px] font-mono text-rose-300">
                  {selectedTopic.category}
                </span>
                <span className="text-xs font-mono text-neutral-400" dir="ltr">
                  {selectedTopic.meaning}
                </span>
              </div>

              {/* Topic Title */}
              <h3 className="urdu-nastaliq text-3xl font-medium text-transparent bg-clip-text bg-gradient-to-r from-rose-200 via-white to-rose-300 drop-shadow-[0_0_12px_rgba(255,100,150,0.5)]">
                {selectedTopic.titleArabic}
              </h3>

              {/* Classic Arabic Example */}
              <div className="mt-4 p-3.5 rounded-xl border border-rose-900/40 bg-[#2b0c22]/50 text-center">
                <div className="text-xs font-mono text-rose-300/80 mb-1 tracking-wider uppercase">
                  مثالِ نحوی // Grammatical Example
                </div>
                <div className="font-arabic text-2xl text-white tracking-wide">
                  {selectedTopic.exampleArabic}
                </div>
              </div>

              {/* Urdu Explanation */}
              <p className="urdu-nastaliq text-lg text-neutral-300 leading-relaxed mt-4">
                {selectedTopic.exampleUrdu}
              </p>

              {/* Bottom hint */}
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

      {/* Nahw Topics Drawer (all 8 demo topics on the petals) */}
      <AnimatePresence>
        {showTopicDrawer && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="fixed top-20 right-5 bottom-20 z-40 w-80 max-w-[85vw] rounded-2xl border border-rose-900/60 bg-[#120510]/95 backdrop-blur-xl shadow-2xl p-5 overflow-y-auto custom-scrollbar flex flex-col gap-4 text-right"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-rose-950 pb-3">
              <h4 className="urdu-nastaliq text-xl text-rose-200">
                مباحثِ علمِ نحو (پنکھڑیوں کے نمونے)
              </h4>
              <button
                type="button"
                onClick={() => setShowTopicDrawer(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-400 font-mono">
              گلاب کی پنکھڑیوں پر عیاں ہونے والے نحوی مباحث:
            </p>

            <div className="flex flex-col gap-2">
              {NAHW_DEMO_TOPICS.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => {
                    setSelectedTopic(topic);
                    setShowTopicDrawer(false);
                  }}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-rose-950 hover:border-rose-700/60 bg-rose-950/20 hover:bg-rose-900/30 transition-all text-right cursor-pointer group"
                >
                  <div className="flex flex-col">
                    <span className="font-arabic text-base font-medium text-rose-100 group-hover:text-white">
                      {topic.titleArabic}
                    </span>
                    <span className="text-[11px] font-mono text-neutral-400" dir="ltr">
                      {topic.meaning}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-900/40 text-rose-300">
                    {topic.category}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stage 4 Finale: The Deep Darkness & Radiant Glowing Silver Couplet */}
      <AnimatePresence>
        {showCouplet && (
          <motion.div
            id="silver-couplet-container"
            initial={{ opacity: 0, scale: 0.94, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -15 }}
            transition={{ duration: 2.4, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center pointer-events-none"
            dir="rtl"
          >
            {/* The Couplet with Radiant Glowing Silver Starlight Aesthetics */}
            <div className="max-w-4xl mx-auto space-y-7 relative">
              {/* Ethereal Silver Halo aura behind text */}
              <div className="absolute inset-0 -inset-x-8 bg-radial from-slate-100/10 via-rose-500/5 to-transparent blur-3xl pointer-events-none" />

              {/* Couplet Verses in Sacred Nastaliq with Radiant Glow */}
              <div className="relative urdu-nastaliq text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-[2.5] md:leading-[2.8] tracking-wide font-normal radiant-silver-couplet">
                {/* Verse 1 */}
                <p>
                  الله رے اثر نالوں کا تیرے بلبل
                </p>
                {/* Verse 2 */}
                <p className="mt-2">
                  پردہ خاک سے گل چاک گریباں نکلا
                </p>
              </div>

              {/* Minimal Silver Light Divider */}
              <div className="flex items-center justify-center gap-4 pt-2 opacity-75">
                <span className="w-16 h-px bg-gradient-to-l from-slate-200 via-slate-400 to-transparent shadow-[0_0_8px_#ffffff]" />
                <span className="w-2 h-2 rounded-full bg-white shadow-[0_0_12px_#ffffff] animate-ping" />
                <span className="w-16 h-px bg-gradient-to-r from-slate-200 via-slate-400 to-transparent shadow-[0_0_8px_#ffffff]" />
              </div>

              {/* Poetic Nahw Epilogue Note */}
              <p className="text-xs sm:text-sm font-mono tracking-widest text-slate-300/85 uppercase pt-1">
                نغمۂ بلبل، چاکِ گریباں، اور پردۂ خاک سے معانی و نحو کا ظہور
              </p>
            </div>

            {/* Bottom Actions: Replay & Browse Topics */}
            <div className="absolute bottom-10 inset-x-0 flex items-center justify-center gap-3 pointer-events-auto px-4">
              <button
                id="replay-bloom-button"
                type="button"
                onClick={handleReplay}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-neutral-600 bg-[#120512]/90 hover:bg-[#200820] hover:border-slate-300 text-xs sm:text-sm text-slate-100 transition-all shadow-2xl shadow-black cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-rose-400" />
                <span>دوبارہ مشاہدہ کریں // REPLAY</span>
              </button>

              <button
                id="view-nahw-topics-button"
                type="button"
                onClick={() => setShowTopicDrawer(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-rose-700/60 bg-[#1f061b]/90 hover:bg-rose-950 hover:border-rose-400 text-xs sm:text-sm text-rose-200 transition-all shadow-2xl shadow-black cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-rose-400" />
                <span>نحوی مباحث دیکھیں</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
