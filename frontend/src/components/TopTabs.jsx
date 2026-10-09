import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/Animation.css';

const TopTabs = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loadingState, setLoadingState] = useState({ active: false, name: '', status: 'default' });

  const tabs = [
    { name: 'HOME', path: '/' },
    { name: 'REELS', path: '/reels' },
    { name: 'MESSENGER', path: '/messenger' },
    { name: 'SHOP', path: '/shop' },
    { name: 'PROFILE', path: '/profile' }
  ];

  const handleTabClick = (path, name) => {
    setLoadingState({ active: true, name, status: 'loading' });

    // Exactly 5+ seconds full screen video-style progress animation
    setTimeout(() => {
      setLoadingState({ active: true, name, status: 'success' });

      setTimeout(() => {
        navigate(path);
        setLoadingState({ active: false, name: '', status: 'default' });
      }, 1200); // 1.2s delay after success checkmark
    }, 5200); // 5.2 seconds duration matching your video requirement
  };

  return (
    <div className="container mt-3 position-relative">
      {/* Full Screen Video-Style Interactive Overlay */}
      {loadingState.active && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column justify-content-center align-items-center" style={{ background: 'rgba(11, 15, 25, 0.96)', zIndex: 99999, backdropFilter: 'blur(20px)' }}>
          
          <div className="text-center mb-4 zoom">
            <h2 className="text-white fw-bold mb-2">Opening {loadingState.name}...</h2>
            <p className="text-muted fs-5">E Top Premium Experience</p>
          </div>

          {/* Video style big capsule loading bar in full screen */}
          <div className="position-relative overflow-hidden shadow-lg" style={{ width: '360px', height: '75px', borderRadius: '38px', background: loadingState.status === 'success' ? '#10b981' : '#1e293b', transition: 'background 0.5s ease' }}>
            
            {loadingState.status === 'loading' && (
              <>
                <div className="position-absolute top-0 start-0 h-100 bg-primary shimmer" style={{ width: '100%', animation: 'videoProgressFill 5.2s linear forwards' }}></div>
                <span className="position-absolute top-50 start-50 translate-middle text-white fw-bold fs-5 z-2">
                  Processing...
                </span>
              </>
            )}

            {loadingState.status === 'success' && (
              <div className="position-absolute top-50 start-50 translate-middle text-white fs-3 fw-bold zoom d-flex align-items-center gap-2">
                ✓ Done
              </div>
            )}
          </div>

        </div>
      )}

      <div className="d-flex justify-content-center bg-dark p-2 rounded-pill shadow-lg gap-2 overflow-auto" style={{ backdropFilter: 'blur(10px)' }}>
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path || (tab.path === '/' && location.pathname === '/home');

          return (
            <button
              key={tab.name}
              onClick={() => handleTabClick(tab.path, tab.name)}
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

      <style>{`
        @keyframes videoProgressFill {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default TopTabs;
