import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RoseScene, RosePhase } from '../webgl/RoseScene';
import { NahwDemoTopic, NAHW_DEMO_TOPICS } from '../data/nahwTopics';
import { GardenAudio } from '../webgl/AudioAmbience';
import { ArrowRight, X } from 'lucide-react';

interface RoseCinematicPageProps {
  onBack: () => void;
  audio: GardenAudio;
}

export const RoseCinematicPage: React.FC<RoseCinematicPageProps> = ({ onBack, audio }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const roseSceneRef = useRef<RoseScene | null>(null);
  const [phase, setPhase] = useState<RosePhase>('sprouting');
  const [showCouplet, setShowCouplet] = useState(false);
  const [focusedTopic, setFocusedTopic] = useState<NahwDemoTopic | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<NahwDemoTopic | null>(null);

  const dragState = useRef<{ dragging: boolean; startX: number; moved: boolean } | null>(null);

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
      setTimeout(() => setShowCouplet(true), 700);
    };

    scene.onPathFocusChange = (index) => {
      setFocusedTopic(index >= 0 ? NAHW_DEMO_TOPICS[index] : null);
    };

    return () => {
      scene.destroy();
      roseSceneRef.current = null;
    };
  }, [audio]);

  const handleEnterPath = useCallback(() => {
    setShowCouplet(false);
    roseSceneRef.current?.enterTopicPath();
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (phase !== 'path') return;
    dragState.current = { dragging: true, startX: e.clientX, moved: false };
  }, [phase]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (phase !== 'path' || !dragState.current?.dragging) return;
    const dx = e.clientX - dragState.current.startX;
    if (Math.abs(dx) > 3) dragState.current.moved = true;
    dragState.current.startX = e.clientX;
    roseSceneRef.current?.scrubTopicPath(-dx * 0.0035);
  }, [phase]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (phase !== 'path') return;
    const wasTap = dragState.current && !dragState.current.moved;
    dragState.current = null;

    if (wasTap && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const topic = roseSceneRef.current?.raycastPath(ndcX, ndcY);
      if (topic) setSelectedTopic(topic);
    }
  }, [phase]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (phase !== 'path') return;
    roseSceneRef.current?.scrubTopicPath(e.deltaY * 0.0006);
  }, [phase]);

  return (
    <div
      id="rose-cinematic-page"
      className="relative w-screen h-screen overflow-hidden bg-[#0a0704] select-none text-neutral-100"
    >
      {/* 3D WebGL Canvas Viewport */}
      <div
        id="rose-webgl-canvas"
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
        className={`absolute inset-0 w-full h-full ${phase === 'path' ? 'cursor-grab active:cursor-grabbing' : ''}`}
      />

      {/* True blackout overlay: covers any residual WebGL frame the instant
          the scene reaches blackout, so nothing but the couplet shows next. */}
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

      {phase !== 'blackout' && phase !== 'path' && (
        <div className="cinematic-vignette fixed inset-0 pointer-events-none z-10" />
      )}

      {/* Back Navigation */}
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

      {/* Blackout: only the two-verse couplet appears, tap to continue */}
      <AnimatePresence>
        {showCouplet && (
          <motion.div
            id="silver-couplet-container"
            initial={{ opacity: 0, scale: 0.94, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -15 }}
            transition={{ duration: 2.4, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center cursor-pointer"
            dir="rtl"
            onClick={handleEnterPath}
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Path phase: minimal focused-topic readout, tap the glowing petal
          underneath (rendered by the 3D scene) to open it. */}
      {phase === 'path' && !showCouplet && (
        <div className="absolute inset-x-0 bottom-10 z-20 flex items-center justify-center pointer-events-none">
          <AnimatePresence mode="wait">
            {focusedTopic && (
              <motion.button
                key={focusedTopic.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                onClick={() => setSelectedTopic(focusedTopic)}
                className="pointer-events-auto flex flex-col items-center gap-1 px-6 py-2.5 rounded-full border border-rose-800/60 bg-black/60 hover:border-rose-400 transition-all cursor-pointer"
                dir="rtl"
              >
                <span className="font-arabic text-lg text-rose-100">{focusedTopic.titleArabic}</span>
                <span className="text-[10px] font-mono text-neutral-400">{focusedTopic.category}</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}

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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
