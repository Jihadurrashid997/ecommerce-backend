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

    // 5+ seconds full screen video-style progress animation
    setTimeout(() => {
      setLoadingState({ active: true, name, status: 'success' });

      setTimeout(() => {
        navigate(path);
        setLoadingState({ active: false, name: '', status: 'default' });
      }, 1200);
    }, 5200);
  };

  return (
    <>
      {/* Full Screen Video-Style Interactive Overlay (Fixed with high z-index and explicit viewport sizing) */}
      {loadingState.active && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(11, 15, 25, 0.98)',
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backdropFilter: 'blur(20px)'
        }}>
          
          <div className="text-center mb-4 zoom">
            <h1 className="text-white fw-bold mb-2 display-5">Opening {loadingState.name}...</h1>
            <p className="text-muted fs-4">E Top Premium Social Experience</p>
          </div>

          {/* Video style big capsule loading bar in full screen */}
          <div className="position-relative overflow-hidden shadow-lg" style={{ width: '400px', height: '85px', borderRadius: '42px', background: loadingState.status === 'success' ? '#10b981' : '#1e293b', transition: 'background 0.5s ease' }}>
            
            {loadingState.status === 'loading' && (
              <>
                <div className="position-absolute top-0 start-0 h-100 bg-primary shimmer" style={{ width: '100%', animation: 'videoProgressFill 5.2s linear forwards' }}></div>
                <span className="position-absolute top-50 start-50 translate-middle text-white fw-bold fs-4 z-2">
                  Processing...
                </span>
              </>
            )}

            {loadingState.status === 'success' && (
              <div className="position-absolute top-50 start-50 translate-middle text-white fs-2 fw-bold zoom d-flex align-items-center gap-2">
                ✓ Done
              </div>
            )}
          </div>

        </div>
      )}

      <div className="container mt-3 position-relative">
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
      </div>

      <style>{`
        @keyframes videoProgressFill {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </>
  );
};

export default TopTabs;
