import React, { useEffect, useState, useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { Terminal } from 'lucide-react';

interface CodeTypewriterProps {
  id?: string;
  text: string;
  tag?: string;
  speed?: number;
  delay?: number;
  className?: string;
  glowColor?: string;
  variant?: 'terminal' | 'heartbeat';
}

export const CodeTypewriter: React.FC<CodeTypewriterProps> = ({
  id,
  text,
  tag = 'script.ur',
  speed = 42,
  delay = 200,
  className = '',
  glowColor = 'rgba(255, 130, 180, 0.25)',
  variant = 'terminal',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: '-10% 0px' });
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (!isInView) return;

    const timeout = setTimeout(() => {
      setIsTyping(true);
      let currentIndex = 0;

      const interval = setInterval(() => {
        if (currentIndex < text.length) {
          setDisplayedText(text.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          clearInterval(interval);
          setIsTyping(false);
          setIsCompleted(true);
        }
      }, speed);

      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(timeout);
  }, [isInView, text, speed, delay]);

  if (variant === 'heartbeat') {
    return (
      <div
        id={id}
        ref={containerRef}
        className={`relative rounded-2xl overflow-hidden border border-red-900/40 bg-[#0f0408]/95 shadow-2xl p-6 md:p-8 max-w-3xl mx-auto ${className}`}
      >
        {/* Heartbeat pulse line & telemetry header */}
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-red-900/30 text-xs select-none">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span className="font-mono text-[11px] font-semibold tracking-wider text-red-200">
              نبضِ جاں // BLOOD_PULSE
            </span>
          </div>

          {/* Animated SVG EKG wave */}
          <div className="hidden sm:flex items-center gap-1.5 opacity-60">
            <svg className="w-24 h-4 text-red-400 stroke-current fill-none" viewBox="0 0 100 20">
              <path
                d="M0 10 L30 10 L35 3 L40 17 L45 7 L50 13 L55 10 L100 10"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="font-mono text-[10px] tracking-widest text-red-400 uppercase">
            {tag}
          </div>
        </div>

        {/* Dynamic Typed Text - Crisp & High-Contrast */}
        <div className="flex items-start gap-3" dir="rtl">
          <span className="font-mono text-red-400 text-lg md:text-xl select-none pt-0.5">⚡</span>
          <p className="urdu-code text-white text-lg sm:text-xl md:text-2xl leading-relaxed md:leading-loose tracking-wide font-medium flex-1">
            {displayedText}
            <motion.span
              animate={{ opacity: isCompleted ? [1, 0] : [1, 0.2] }}
              transition={{ duration: 0.55, repeat: Infinity, ease: 'linear' }}
              className="inline-block w-2.5 h-5 md:h-6 bg-red-400 mr-1.5 align-middle"
            />
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      id={id}
      ref={containerRef}
      className={`relative rounded-xl overflow-hidden border border-neutral-800 bg-[#09050c]/95 shadow-2xl p-5 md:p-7 max-w-3xl mx-auto ${className}`}
    >
      {/* Terminal Window Chrome / Header */}
      <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-neutral-800 text-xs text-neutral-400 select-none">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
          <span className="ml-2 font-mono text-[11px] tracking-wider text-neutral-400">{tag}</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-neutral-400">
          <Terminal className="w-3.5 h-3.5 text-neutral-400" />
          <span>LIVE_STREAM</span>
        </div>
      </div>

      {/* Code / Command Prompt Line with dynamic typed text - Crisp & High-Contrast */}
      <div className="flex items-start gap-3" dir="rtl">
        <span className="font-mono text-rose-400 text-base md:text-lg select-none pt-0.5">&gt;</span>
        <p className="urdu-code text-white text-lg sm:text-xl md:text-2xl leading-relaxed md:leading-loose tracking-wide font-normal flex-1">
          {displayedText}
          <motion.span
            animate={{ opacity: isCompleted ? [1, 0] : [1, 0.15] }}
            transition={{ duration: 0.65, repeat: Infinity, ease: 'linear' }}
            className="inline-block w-2.5 h-5 md:h-6 bg-rose-400 mr-1.5 align-middle"
          />
        </p>
      </div>
    </div>
  );
};
