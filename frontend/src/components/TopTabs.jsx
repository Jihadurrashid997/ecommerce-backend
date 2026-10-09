import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/Animation.css';

const TopTabs = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loadingState, setLoadingState] = useState({ active: false, tab: null });

  // Protiti tab-er jonno unique 3D animation video path
  const tabs = [
    { name: 'HOME', path: '/', video: '/videos/home-3d.mp4' },
    { name: 'REELS', path: '/reels', video: '/videos/reels-3d.mp4' },
    { name: 'MESSENGER', path: '/messenger', video: '/videos/messenger-3d.mp4' },
    { name: 'SHOP', path: '/shop', video: '/videos/shop-3d.mp4' },
    { name: 'PROFILE', path: '/profile', video: '/videos/profile-3d.mp4' }
  ];

  const handleTabClick = (tabObj) => {
    setLoadingState({ active: true, tab: tabObj });

    // Exactly 5+ seconds full-screen 3D video playback duration before navigation
    setTimeout(() => {
      navigate(tabObj.path);
      setLoadingState({ active: false, tab: null });
    }, 5500); // 5.5 seconds 3D animation duration
  };

  return (
    <>
      {/* Full Screen 3D Animation Video Overlay */}
      {loadingState.active && loadingState.tab && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: '#000000',
          zIndex: 999999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden'
        }}>
          <video 
            src={loadingState.tab.video} 
            autoPlay 
            muted 
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        </div>
      )}

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
                {tab.name}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default TopTabs;
