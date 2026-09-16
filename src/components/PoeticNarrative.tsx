import React from 'react';
import { motion } from 'motion/react';
import { CodeTypewriter } from './CodeTypewriter';
import { Compass, Flame, Moon, Feather, Lamp, Wind, ShieldCheck } from 'lucide-react';

interface PoeticNarrativeProps {
  onScrollProgress?: (progress: number) => void;
  onEnterRosePage?: () => void;
}

export const PoeticNarrative: React.FC<PoeticNarrativeProps> = ({ onEnterRosePage }) => {
  return (
    <div
      id="poetic-narrative-container"
      className="relative z-20 w-full text-neutral-100 selection:bg-rose-900/60 selection:text-rose-100"
      dir="rtl"
    >
      {/* 1. Dynamic Coding Style Text 1 */}
      <section
        id="section-coding-text-1"
        className="min-h-[80vh] flex items-center justify-center px-6 py-24"
      >
        <div className="w-full max-w-3xl">
          <CodeTypewriter
            id="code-block-1"
            tag="bidaari.exe"
            speed={45}
            delay={250}
            variant="terminal"
            text="اے صاحب الطاف! کب تک اپنے خاب وخیال میں ڈوبے رہوگے ،اٹھو کہ  تمہاری بیداری کا وقت آچکا، اٹھو لله اٹھو۔ دیکھو کہ ان دریچوں سے آواز آتی ہے۔"
          />
        </div>
      </section>

      {/* 2. Ethereal Cloud Sanctuary for Musaddas-e-Hali - Crisp & Legible */}
      <section
        id="section-hali-couplet"
        className="min-h-[90vh] flex flex-col items-center justify-center px-6 py-28 text-center relative overflow-hidden"
      >
        {/* The Cloud Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 35 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, margin: '-12%' }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative max-w-3xl w-full mx-auto"
        >
          {/* Calm, dark organic misty cloud shape without blinding glow */}
          <div className="cloud-container relative px-8 py-12 sm:px-14 sm:py-16 bg-[#120613]/95 border border-rose-900/40 shadow-2xl shadow-black/90">
            {/* Cloud Calligraphy Heading Accent */}
            <div className="flex items-center justify-center gap-3 mb-6 opacity-70">
              <span className="w-8 h-px bg-neutral-700" />
              <span className="text-[11px] font-mono tracking-widest text-neutral-300 uppercase">
                سحابِ فکر // MUSADDAS-E-HALI
              </span>
              <span className="w-8 h-px bg-neutral-700" />
            </div>

            {/* Verses written inside the cloud - Crisp, sharp, easy to read */}
            <div className="urdu-nastaliq text-2xl sm:text-3xl md:text-4xl text-white leading-[2.6] md:leading-[2.9] font-normal relative z-10 space-y-2">
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="hover:text-rose-200 transition-colors"
              >
                پستی کا کوئی حد سے گزرنا دیکھے
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="hover:text-rose-200 transition-colors"
              >
                اسلام کا گر کر نہ اُبھرنا دیکھے
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="hover:text-rose-200 transition-colors mt-3"
              >
                مانے نہ کبھی کہ مَد ہے ہر جزر کے بعد
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.8 }}
                className="hover:text-rose-200 transition-colors"
              >
                دریا کا ہمارے جو اُترنا دیکھے
              </motion.p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* 3. Dynamic Coding Text 2: Crimson Pulse Telemetry */}
      <section
        id="section-coding-text-2"
        className="min-h-[80vh] flex items-center justify-center px-6 py-24"
      >
        <div className="w-full max-w-3xl">
          <CodeTypewriter
            id="code-block-2"
            tag="lahu_pulse.sh"
            speed={48}
            delay={200}
            variant="heartbeat"
            text="ہاں! اے دلدار جو اپنے خرابے میں درد ودرماں لئے پھرتا ہے تجھے اپنا لہو گرمانا ہوگا."
          />
        </div>
      </section>

      {/* 4. Couplet (Faiz) with Clean Dark Card & Sharp Typography */}
      <section
        id="section-glowing-couplet"
        className="min-h-[80vh] flex items-center justify-center px-6 py-24 text-center"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, margin: '-15%' }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative max-w-2xl mx-auto p-8 sm:p-12 rounded-3xl bg-[#110512]/95 border border-neutral-800 shadow-2xl shadow-black/90"
        >
          <div className="urdu-nastaliq glowing-couplet text-2xl sm:text-3xl md:text-4xl text-white font-medium leading-[2.6] md:leading-[2.8]">
            <p className="hover:text-rose-100 transition-colors">
              چشم نم جان شوریدہ کافی نہیں
            </p>
            <p className="hover:text-rose-100 transition-colors mt-2">
              تہمت عشق پوشیدہ کافی نہیں
            </p>
          </div>
        </motion.div>
      </section>

      {/* 5. "تو بس چلتے چلو" & The 6 Couplets - Clean, High-Contrast Cards */}
      <section
        id="section-long-couplets"
        className="min-h-screen flex flex-col items-center justify-center px-6 py-28"
      >
        {/* Transitional Header: تو بس چلتے چلو */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 1.0 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full border border-neutral-700 bg-[#0d040e]/95 shadow-xl shadow-black/80">
            <Compass className="w-4 h-4 text-rose-400" />
            <span className="urdu-nastaliq text-xl sm:text-2xl text-neutral-200 tracking-wider">
              تو بس چلتے چلو...
            </span>
          </div>
        </motion.div>

        {/* 6 Clean Art Cards for the Stanzas */}
        <div className="w-full max-w-2xl mx-auto flex flex-col gap-10 text-center">
          {/* Stanza 1: Fiery Torch (مشعلِ جاں) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-12%' }}
            transition={{ duration: 1.0 }}
            className="relative p-6 sm:p-8 rounded-2xl border border-amber-900/40 bg-[#120706]/95 shadow-2xl shadow-black/90"
          >
            <div className="absolute top-4 right-4 text-amber-500/60">
              <Flame className="w-4 h-4" />
            </div>
            <div className="urdu-nastaliq text-xl sm:text-2xl md:text-3xl text-amber-100 leading-[2.6]">
              <p>جلا کے مشعل جاں ہم جنوں صفات چلے</p>
              <p>جو گھر کو آگ لگائے ہمارے ساتھ چلے</p>
            </div>
          </motion.div>

          {/* Stanza 2: Twilight (دیارِ شام) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-12%' }}
            transition={{ duration: 1.0 }}
            className="relative p-6 sm:p-8 rounded-2xl border border-indigo-950/50 bg-[#080714]/95 shadow-2xl shadow-black/90"
          >
            <div className="absolute top-4 left-4 text-indigo-400/60">
              <Moon className="w-4 h-4" />
            </div>
            <div className="urdu-nastaliq text-xl sm:text-2xl md:text-3xl text-indigo-100 leading-[2.6]">
              <p>دیار شام نہیں منزل سحر بھی نہیں</p>
              <p>عجب نگر ہے یہاں دن چلے نہ رات چلے</p>
            </div>
          </motion.div>

          {/* Stanza 3: Ink Flourish (دہانِ زخم) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-12%' }}
            transition={{ duration: 1.0 }}
            className="relative p-6 sm:p-8 rounded-2xl border border-rose-950/50 bg-[#0f040b]/95 shadow-2xl shadow-black/90"
          >
            <div className="absolute top-4 right-4 text-rose-400/60">
              <Feather className="w-4 h-4" />
            </div>
            <div className="urdu-nastaliq text-xl sm:text-2xl md:text-3xl text-rose-100 leading-[2.6]">
              <p>ہمارے لب نہ سہی وہ دہان زخم سہی</p>
              <p>وہیں پہنچتی ہے یارو کہیں سے بات چلے</p>
            </div>
          </motion.div>

          {/* Stanza 4: Gallows Lanterns (سروں کے چراغ) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-12%' }}
            transition={{ duration: 1.0 }}
            className="relative p-6 sm:p-8 rounded-2xl border border-yellow-950/40 bg-[#0d0904]/95 shadow-2xl shadow-black/90"
          >
            <div className="absolute top-4 left-4 text-yellow-500/60">
              <Lamp className="w-4 h-4" />
            </div>
            <div className="urdu-nastaliq text-xl sm:text-2xl md:text-3xl text-yellow-100 leading-[2.6]">
              <p>ستون دار پہ رکھتے چلو سروں کے چراغ</p>
              <p>جہاں تلک یہ ستم کی سیاہ رات چلے</p>
            </div>
          </motion.div>

          {/* Stanza 5: Drifting Wind (طرزِ نوا) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-12%' }}
            transition={{ duration: 1.0 }}
            className="relative p-6 sm:p-8 rounded-2xl border border-teal-950/50 bg-[#040c0c]/95 shadow-2xl shadow-black/90"
          >
            <div className="absolute top-4 right-4 text-teal-400/60">
              <Wind className="w-4 h-4" />
            </div>
            <div className="urdu-nastaliq text-xl sm:text-2xl md:text-3xl text-teal-100 leading-[2.6]">
              <p>ہوا اسیر کوئی ہم نوا تو دور تلک</p>
              <p>بپاس طرز نوا ہم بھی ساتھ ساتھ چلے</p>
            </div>
          </motion.div>

          {/* Stanza 6: Golden Shield (نقدِ وفا) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-12%' }}
            transition={{ duration: 1.0 }}
            className="relative p-6 sm:p-8 rounded-2xl border border-neutral-800 bg-[#0e060d]/95 shadow-2xl shadow-black/90"
          >
            <div className="absolute top-4 left-4 text-neutral-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="urdu-nastaliq text-xl sm:text-2xl md:text-3xl text-white leading-[2.6]">
              <p>بچا کے لائے ہم اے یار پھر بھی نقد وفا</p>
              <p>اگرچہ لٹتے رہے رہزنوں کے ہاتھ چلے</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 6. "کیونکہ" Transition & Allama Iqbal Couplet */}
      <section
        id="section-iqbal-couplet"
        className="min-h-[85vh] flex flex-col items-center justify-center px-6 py-28 text-center"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 25 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, margin: '-15%' }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-3xl mx-auto flex flex-col items-center gap-7"
        >
          {/* Transition: کیونکہ */}
          <div className="relative flex items-center justify-center">
            <span className="urdu-nastaliq text-2xl sm:text-3xl text-rose-300 font-semibold px-5 py-1 rounded-full bg-[#120512] border border-neutral-800 shadow-lg shadow-black/80">
              کیونکہ...
            </span>
          </div>

          <div className="urdu-nastaliq text-2xl sm:text-3xl md:text-4xl text-white leading-[2.7] md:leading-[3.0] font-normal">
            <p className="hover:text-rose-200 transition-colors">
              نہیں ہے ناامید اقبالؔ اپنی کشتِ ویراں سے
            </p>
            <p className="hover:text-rose-200 transition-colors mt-2">
              ذرا نم ہو تو یہ مٹی بہت زرخیز ہے ساقی
            </p>
          </div>
        </motion.div>
      </section>

      {/* 7. Finale: The Sacred Ayah ONLY - Sharp, Reverent, High-Contrast */}
      <section
        id="section-quranic-ayah"
        className="min-h-screen flex flex-col items-center justify-center px-6 py-32 text-center"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-5xl mx-auto flex flex-col items-center justify-center py-12"
        >
          {/* Sacred Ayah ONLY - Crisp, high-contrast, razor-sharp on dark background */}
          <h2
            id="sacred-ayah-text"
            className="silverglow-ayah text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-[2.2] md:leading-[2.4] tracking-wide select-none cursor-default"
          >
            وَالَّذِينَ جَاهَدُوا فِينَا لَنَهْدِيَنَّهُمْ سُبُلَنَا
          </h2>
        </motion.div>
      </section>

      {/* 8. The Interactive Seed: Gateway to the 3D Cinematic Rose Page */}
      <section
        id="section-dormant-seed-gateway"
        className="min-h-[85vh] flex flex-col items-center justify-center px-6 py-28 text-center"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 30 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-xl mx-auto flex flex-col items-center gap-7"
        >
          {/* Subtle preamble tag */}
          <div className="flex items-center gap-2 px-4 py-1 rounded-full border border-neutral-800 bg-neutral-950/60 text-xs font-mono tracking-widest text-neutral-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>بذرۂ بصیرت // THE DORMANT SEED</span>
          </div>

          {/* Interactive 3D/Organic Seed Button */}
          <button
            id="enter-rose-page-seed-button"
            type="button"
            onClick={onEnterRosePage}
            className="group relative flex flex-col items-center cursor-pointer focus:outline-none"
            aria-label="اس بیج کو چھوئیں اور داخل ہوں"
          >
            {/* Ambient Soil Mound Base */}
            <div className="relative w-36 h-44 sm:w-44 sm:h-52 flex items-center justify-center">
              {/* Pulsing Earthen Core Shadow */}
              <div className="absolute inset-x-4 bottom-2 h-12 bg-rose-950/40 rounded-full blur-xl group-hover:bg-rose-900/60 transition-colors" />

              {/* The Organic Sculpted Seed Silhouette */}
              <div className="relative w-24 h-36 sm:w-28 sm:h-40 rounded-[50%_50%_50%_50%/65%_65%_35%_35%] bg-gradient-to-b from-[#2a1320] via-[#160813] to-[#0d040a] border border-rose-900/40 shadow-2xl shadow-black group-hover:scale-105 group-hover:border-rose-500/60 group-hover:shadow-[0_15px_40px_rgba(244,63,94,0.25)] transition-all duration-500 flex flex-col items-center justify-center p-3">
                {/* Organic seed ribbing / vein lines */}
                <div className="w-0.5 h-20 bg-gradient-to-b from-rose-400/40 via-rose-700/20 to-transparent rounded-full" />
                <div className="absolute top-5 w-3 h-3 rounded-full bg-rose-500/30 blur-xs group-hover:bg-rose-400/60 transition-colors" />

                {/* Gentle pulsing inner embryo glow */}
                <div className="absolute inset-3 rounded-[50%_50%_50%_50%/65%_65%_35%_35%] border border-rose-400/10 pointer-events-none" />
              </div>

              {/* Emerging root tendril hints */}
              <svg className="absolute -bottom-2 w-32 h-8 text-neutral-700/50 stroke-current fill-none pointer-events-none" viewBox="0 0 120 30">
                <path d="M60 0 Q62 15 75 25 M60 0 Q58 12 45 22 M60 0 Q60 18 60 28" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </div>

            {/* Invitation Text */}
            <div className="mt-4 flex flex-col items-center gap-2 text-center">
              <span className="urdu-nastaliq text-2xl sm:text-3xl text-neutral-200 group-hover:text-white transition-colors font-medium">
                اس بیج کو چھوئیں اور داخل ہوں...
              </span>
              <span className="text-xs font-mono tracking-widest text-neutral-400 group-hover:text-rose-300 transition-colors">
                [ TOUCH TO AWAKEN &amp; ENTER ]
              </span>
            </div>
          </button>
        </motion.div>
      </section>

      {/* Bottom padding spacer */}
      <div className="h-24 w-full" />
    </div>
  );
};
