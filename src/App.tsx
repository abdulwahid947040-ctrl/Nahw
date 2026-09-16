/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { GardenScene } from './webgl/GardenScene';
import { GardenAudio } from './webgl/AudioAmbience';
import { AudioToggle, HeroTitle } from './components/CinematicOverlay';
import { PoeticNarrative } from './components/PoeticNarrative';
import { RoseCinematicPage } from './components/RoseCinematicPage';

export default function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const gardenSceneRef = useRef<GardenScene | null>(null);
  const audioRef = useRef<GardenAudio>(new GardenAudio());
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [activePage, setActivePage] = useState<'narrative' | 'rose'>('narrative');

  useEffect(() => {
    // Check initial hash
    if (window.location.hash === '#rose') {
      setActivePage('rose');
    }

    const handleHashChange = () => {
      if (window.location.hash === '#rose') {
        setActivePage('rose');
      } else {
        setActivePage('narrative');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (activePage !== 'narrative') {
      if (gardenSceneRef.current) {
        gardenSceneRef.current.destroy();
        gardenSceneRef.current = null;
      }
      return;
    }

    if (!containerRef.current) return;

    // Initialize 3D WebGL Flower Garden
    const scene = new GardenScene(containerRef.current, audioRef.current);
    gardenSceneRef.current = scene;

    const handleMouseMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      setMousePos({ x: nx, y: ny });
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      scene.destroy();
      gardenSceneRef.current = null;
    };
  }, [activePage]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll > 0 && gardenSceneRef.current) {
      const progress = el.scrollTop / maxScroll;
      gardenSceneRef.current.setScrollProgress(progress);
    }
  };

  const handleEnterRosePage = () => {
    audioRef.current.playSeedAwaken();
    window.location.hash = 'rose';
    setActivePage('rose');
  };

  const handleBackToNarrative = () => {
    window.location.hash = '';
    setActivePage('narrative');
  };

  return (
    <main
      id="cinematic-garden-app"
      className="relative w-screen h-screen overflow-hidden bg-[#060206]"
    >
      {activePage === 'narrative' ? (
        <>
          {/* 3D WebGL Canvas Viewport (Fixed background) */}
          <div
            id="webgl-canvas-container"
            ref={containerRef}
            className="fixed inset-0 w-full h-full pointer-events-none"
          />

          {/* Cinematic Exposure & Atmospheric Lighting Layers */}
          <div id="cinematic-vignette-layer" className="cinematic-vignette fixed" />
          <div id="cinematic-grain-layer" className="cinematic-grain fixed" />

          {/* Floating Minimal Sound Toggle */}
          <AudioToggle audio={audioRef.current} />

          {/* Scrollable Poetic Journey */}
          <div
            id="main-scroll-container"
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="relative z-30 w-full h-screen overflow-y-auto overflow-x-hidden custom-scrollbar"
          >
            {/* Screen 1: Hero view with Web Name "نحو زار" */}
            <HeroTitle mousePos={mousePos} />

            {/* Screen 2..N: Dynamic typing code prose, flowing couplets & interactive Seed gateway */}
            <PoeticNarrative onEnterRosePage={handleEnterRosePage} />
          </div>
        </>
      ) : (
        <RoseCinematicPage onBack={handleBackToNarrative} audio={audioRef.current} />
      )}
    </main>
  );
}
