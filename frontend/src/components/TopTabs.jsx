import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/Animation.css';

const TopTabs = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loadingState, setLoadingState] = useState({ active: false, tab: null, step: 'loading' });

  // Protiti tab-er jonno unique 3D visual theme, interactive features & descriptions
  const tabs = [
    { 
      name: 'HOME', 
      path: '/', 
      title: 'E Top Social Feed & Network', 
      desc: 'Connecting creators, sharing posts, and real-time community engagement.',
      primaryColor: '#6366f1',
      secondaryColor: '#a855f7',
      icon: '🌐',
      visualType: 'network-3d'
    },
    { 
      name: 'REELS', 
      path: '/reels', 
      title: 'E Top Immersive Reels', 
      desc: 'High-definition short videos, smooth swiping, and creator storytelling.',
      primaryColor: '#ec4899',
      secondaryColor: '#f43f5e',
      icon: '🎬',
      visualType: 'reels-3d'
    },
    { 
      name: 'MESSENGER', 
      path: '/messenger', 
      title: 'E Top Live Messenger', 
      desc: 'Instant peer-to-peer chats, voice calls, and secure encrypted messaging.',
      primaryColor: '#3b82f6',
      secondaryColor: '#06b6d4',
      icon: '💬',
      visualType: 'chat-3d'
    },
    { 
      name: 'SHOP', 
      path: '/shop', 
      title: 'E Top Social Store & Cart', 
      desc: 'Exclusive products, micro-interactions, and instant secure checkout.',
      primaryColor: '#f59e0b',
      secondaryColor: '#f97316',
      icon: '🛍️',
      visualType: 'shop-3d'
    },
    { 
      name: 'PROFILE', 
      path: '/profile', 
      title: 'Your E Top Dashboard', 
      desc: 'Managing your personal profile, activity history, settings, and orders.',
      primaryColor: '#10b981',
      secondaryColor: '#059669',
      icon: '👤',
      visualType: 'profile-3d'
    }
  ];

  const handleTabClick = (tabObj) => {
    setLoadingState({ active: true, tab: tabObj, step: 'loading' });

    // 5.5 seconds high-end 3D cinematic showcase duration
    setTimeout(() => {
      setLoadingState({ active: true, tab: tabObj, step: 'success' });

      setTimeout(() => {
        navigate(tabObj.path);
        setLoadingState({ active: false, tab: null, step: 'loading' });
      }, 1000); // 1s success checkmark transition
    }, 5500);
  };

  return (
    <>
      {/* Full Screen Cinematic 3D Interactive Showcase Overlay */}
      {loadingState.active && loadingState.tab && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: '#070b19',
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          
          {/* Animated Background Glowing Orbs */}
          <div style={{
            position: 'absolute',
            width: '600px',
            height: '600px',
            background: `radial-gradient(circle, ${loadingState.tab.primaryColor}33 0%, transparent 70%)`,
            borderRadius: '50%',
            animation: 'pulseGlow 4s infinite alternate',
            zIndex: 1
          }}></div>

          {/* Main Cinematic Card Container */}
          <div className="position-relative z-2 text-center p-5 rounded-5 shadow-2lg" style={{
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(30px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            maxWidth: '750px',
            width: '90%'
          }}>
            
            {/* Icon Badge */}
            <div className="display-3 mb-3 p-3 rounded-circle d-inline-flex align-items-center justify-content-center shadow-lg zoom" style={{
              background: `linear-gradient(135deg, ${loadingState.tab.primaryColor}, ${loadingState.tab.secondaryColor})`,
              width: '100px',
              height: '100px'
            }}>
              {loadingState.tab.icon}
            </div>

            {/* Title & Description clarifying the feature */}
            <h1 className="text-white fw-bold mb-3 display-6 slide-up">
              {loadingState.tab.title}
            </h1>
            <p className="text-light opacity-75 fs-5 mb-5 mx-auto" style={{ maxWidth: '550px' }}>
              {loadingState.tab.desc}
            </p>

            {/* 3D Visual Simulation Box based on tab type */}
            <div className="mb-4 position-relative mx-auto rounded-4 overflow-hidden shadow-inner d-flex align-items-center justify-content-center" style={{
              height: '120px',
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              {loadingState.tab.visualType === 'network-3d' && (
                <div className="d-flex align-items-center gap-4">
                  <div className="spinner-grow text-indigo" style={{ background: loadingState.tab.primaryColor, width: '3rem', height: '3rem' }}></div>
                  <div className="text-start">
                    <div className="text-white fw-bold">Syncing Global Feed...</div>
                    <div className="text-muted small">Loading posts, likes & comments</div>
                  </div>
                </div>
              )}

              {loadingState.tab.visualType === 'reels-3d' && (
                <div className="d-flex align-items-center gap-4">
                  <div className="spinner-border text-pink" style={{ color: loadingState.tab.primaryColor, width: '3rem', height: '3rem' }}></div>
                  <div className="text-start">
                    <div className="text-white fw-bold">Buffering 3D Reels...</div>
                    <div className="text-muted small">Optimizing short video streams</div>
                  </div>
                </div>
              )}

              {loadingState.tab.visualType === 'chat-3d' && (
                <div className="d-flex align-items-center gap-4">
                  <div className="spinner-grow text-blue" style={{ background: loadingState.tab.primaryColor, width: '3rem', height: '3rem' }}></div>
                  <div className="text-start">
                    <div className="text-white fw-bold">Connecting Messenger...</div>
                    <div className="text-muted small">Establishing secure socket connection</div>
                  </div>
                </div>
              )}

              {loadingState.tab.visualType === 'shop-3d' && (
                <div className="d-flex align-items-center gap-4">
                  <div className="spinner-border text-amber" style={{ color: loadingState.tab.primaryColor, width: '3rem', height: '3rem' }}></div>
                  <div className="text-start">
                    <div className="text-white fw-bold">Loading E-Commerce Store...</div>
                    <div className="text-muted small">Fetching products, cart & payment gateway</div>
                  </div>
                </div>
              )}

              {loadingState.tab.visualType === 'profile-3d' && (
                <div className="d-flex align-items-center gap-4">
                  <div className="spinner-grow text-emerald" style={{ background: loadingState.tab.primaryColor, width: '3rem', height: '3rem' }}></div>
                  <div className="text-start">
                    <div className="text-white fw-bold">Loading User Vault...</div>
                    <div className="text-muted small">Retrieving personal settings & stats</div>
                  </div>
                </div>
              )}
            </div>

            {/* Cinematic Capsule Progress Bar */}
            <div className="position-relative overflow-hidden shadow-lg mx-auto" style={{ width: '100%', maxWidth: '450px', height: '65px', borderRadius: '32.5px', background: loadingState.step === 'success' ? '#10b981' : '#1e293b' }}>
              
              {loadingState.step === 'loading' && (
                <>
                  <div className="position-absolute top-0 start-0 h-100 shimmer" style={{
                    width: '100%',
                    background: `linear-gradient(90deg, ${loadingState.tab.primaryColor}, ${loadingState.tab.secondaryColor})`,
                    animation: 'cinematicProgress 5.5s linear forwards'
                  }}></div>
                  <span className="position-absolute top-50 start-50 translate-middle text-white fw-bold fs-5 z-2" style={{ letterSpacing: '1px' }}>
                    Loading {loadingState.tab.name}...
                  </span>
                </>
              )}

              {loadingState.step === 'success' && (
                <div className="position-absolute top-50 start-50 translate-middle text-white fs-4 fw-bold zoom d-flex align-items-center gap-2">
                  ✓ Ready & Loaded
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Navigation Top Tabs */}
      <div className="container mt-3 position-relative">
        <div className="d-flex justify-content-center bg-dark p-2 rounded-pill shadow-lg gap-2 overflow-auto" style={{ backdropFilter: 'blur(10px)' }}>
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path || (tab.path === '/' && location.pathname === '/home');

            return (
              <button
                key={tab.name}
                onClick={() => handleTabClick(tab)}
                className={`btn px-4 py-2 rounded-pill fw-bold transition-all position-relative overflow-hidden ${
                  isActive ? 'btn-light text-dark shadow' : 'btn-dark text-white opacity-75'
                }`}
                style={{ transition: 'all 0.3s ease' }}
              >
                {tab.icon} {tab.name}
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes cinematicProgress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        @keyframes pulseGlow {
          0% { transform: scale(0.8); opacity: 0.4; }
          100% { transform: scale(1.2); opacity: 0.8; }
        }
      `}</style>
    </>
  );
};

export default TopTabs;
