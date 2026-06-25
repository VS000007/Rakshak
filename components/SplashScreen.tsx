"use client";

import { useEffect, useState } from "react";

export default function SplashScreen() {
  const [show, setShow] = useState(true);
  const [isFading, setIsFading] = useState(false);
  // Generate particle data client-side only to avoid SSR/client hydration mismatch
  const [particles, setParticles] = useState<Array<{size: number; left: number; duration: number; delay: number}>>([]);

  useEffect(() => {
    // Generate particles on client only
    setParticles(
      Array.from({ length: 25 }, () => ({
        size: Math.random() * 2 + 2,
        left: Math.random() * 100,
        duration: Math.random() * 3 + 3,
        delay: Math.random() * 2,
      }))
    );
    // Fade out after 3.2 seconds
    const fadeTimer = setTimeout(() => setIsFading(true), 3200);
    // Unmount after fade out completes
    const unmountTimer = setTimeout(() => setShow(false), 3600);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(unmountTimer);
    };
  }, []);

  if (!show) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center pointer-events-none"
      style={{ 
        backgroundColor: '#0a0a0a', 
        opacity: isFading ? 0 : 1, 
        transition: 'opacity 0.4s ease-out',
        willChange: 'opacity'
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes rotateSlow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulseGlow {
          0% { filter: drop-shadow(0 0 30px rgba(212,160,23,0.4)); }
          50% { filter: drop-shadow(0 0 60px rgba(212,160,23,0.7)); }
          100% { filter: drop-shadow(0 0 30px rgba(212,160,23,0.4)); }
        }
        @keyframes bloom {
          0% { transform: scale(0) rotate(calc(var(--target-angle) - 20deg)); opacity: 0; }
          100% { transform: scale(1) rotate(var(--target-angle)); opacity: 1; }
        }
        @keyframes floatUp {
          0% { transform: translateY(100vh) translateX(0px); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(-20vh) translateX(20px); opacity: 0; }
        }
        @keyframes fadeInMantra {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes fadeInApp {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}} />

      {/* Floating Particles — rendered only after client mount to avoid hydration mismatch */}
      {particles.map((p, i) => (
        <div 
          key={i}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: '#d4a017',
            left: `${p.left}%`,
            bottom: 0,
            opacity: 0,
            animation: `floatUp ${p.duration}s ease-in ${p.delay}s infinite`,
            willChange: 'transform, opacity'
          }}
        />
      ))}

      {/* Center Wrapper */}
      <div className="relative flex flex-col items-center justify-center">
        
        {/* Divine Light Rays */}
        <div className="absolute w-[300px] h-[300px]" style={{ animation: 'rotateSlow 20s linear infinite', willChange: 'transform' }}>
          {[...Array(12)].map((_, i) => (
            <div 
              key={i}
              className="absolute top-0 left-1/2 -translate-x-1/2 origin-bottom"
              style={{
                width: '2px',
                height: '150px',
                backgroundColor: 'rgba(212,160,23,0.15)',
                transform: `rotate(${i * 30}deg)`
              }}
            />
          ))}
        </div>

        {/* Trishul */}
        <div className="relative z-10" style={{ animation: 'pulseGlow 2s ease-in-out infinite', willChange: 'filter' }}>
          <svg width="60" height="120" viewBox="0 0 60 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <g id="trishul">
                {/* Center prong */}
                <path d="M28 95 L29 18 L30 10 L31 18 L32 95 Z" fill="#d4a017" stroke="#d4a017" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" />
                {/* Left prong */}
                <path d="M28.5 55 C 15 55, 12 40, 10 20 L 12 18 C 15 35, 20 48, 28.5 48 Z" fill="#d4a017" stroke="#d4a017" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" />
                {/* Right prong */}
                <path d="M31.5 55 C 45 55, 48 40, 50 20 L 48 18 C 45 35, 40 48, 31.5 48 Z" fill="#d4a017" stroke="#d4a017" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" />
                {/* Cross-bar (bindu) */}
                <path d="M14 58 Q 30 66 46 58 Q 30 62 14 58 Z" fill="#d4a017" stroke="#d4a017" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" />
                {/* Base */}
                <path d="M24 95 C 20 105, 40 105, 36 95 Q 30 92 24 95 Z" fill="#d4a017" stroke="#d4a017" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            </defs>
            {/* Shadow duplicate */}
            <use href="#trishul" x="1.5" y="1.5" opacity="0.15" />
            {/* Main Trishul */}
            <use href="#trishul" x="0" y="0" />
          </svg>
        </div>

        {/* Lotus */}
        <div className="relative mt-2 w-32 h-16 flex justify-center items-end">
          <svg width="0" height="0">
            <defs>
              <linearGradient id="lotusGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ff8c00" />
                <stop offset="100%" stopColor="#d4a017" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute bottom-0 w-5 h-5 bg-[#d4a017] rounded-full z-20" style={{ filter: 'blur(3px)', transform: 'translateY(5px)' }}></div>
          {[...Array(8)].map((_, i) => {
            const angle = (i - 3.5) * 20; 
            const delay = 0.3 + Math.abs(i - 3.5) * 0.1; 
            return (
              <svg 
                key={i}
                className="absolute bottom-0"
                width="24" height="48" viewBox="0 0 24 48"
                style={{
                  transformOrigin: 'bottom center',
                  opacity: 0,
                  '--target-angle': `${angle}deg`,
                  animation: `bloom 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) ${delay}s forwards`,
                  willChange: 'transform, opacity'
                } as React.CSSProperties}
              >
                <path d="M12 0 C 2 15, 2 40, 12 48 C 22 40, 22 15, 12 0 Z" fill="url(#lotusGrad)" stroke="rgba(255,200,50,0.3)" strokeWidth="0.5" />
              </svg>
            );
          })}
        </div>

        {/* Mantra Text */}
        <div 
          className="mt-6 font-serif"
          style={{
            fontSize: '1.1rem',
            color: '#fff8e7',
            letterSpacing: '3px',
            opacity: 0,
            animation: 'fadeInMantra 0.8s ease-out 1.5s forwards',
            willChange: 'opacity'
          }}
        >
          ॐ दुर्गाय नमः
        </div>

        {/* App Name */}
        <div 
          className="mt-3 font-sans uppercase"
          style={{
            fontSize: '0.7rem',
            color: '#d4a017',
            letterSpacing: '8px',
            fontWeight: 300,
            opacity: 0,
            animation: 'fadeInApp 0.6s ease-out 2.2s forwards',
            willChange: 'transform, opacity'
          }}
        >
          RAKSHAK
        </div>
      </div>
    </div>
  );
}
