import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/Animation.css';

const TopTabs = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loadingState, setLoadingState] = useState({ active: false, tab: null, status: 'default' });

  // Protiti tab-er jonno unique releted info ebong color theme
  const tabs = [
    { 
      name: 'HOME', 
      path: '/', 
      title: 'Welcome to E Top Home', 
      subtitle: 'Discovering trending posts & feeds', 
      accentColor: '#6366f1',
      icon: '🏠'
    },
    { 
      name: 'REELS', 
      path: '/reels', 
      title: 'Loading E Top Reels', 
      subtitle: 'Preparing short videos & creator stories', 
      accentColor: '#ec4899',
      icon: '🎬'
    },
    { 
      name: 'MESSENGER', 
      path: '/messenger', 
      title: 'Connecting Messenger', 
      subtitle: 'Syncing chats, calls & real-time messages', 
      accentColor: '#3b82f6',
      icon: '💬'
    },
    { 
      name: 'SHOP', 
      path: '/shop', 
      title: 'Opening E Top Shop', 
      subtitle: 'Loading products, cart & instant checkout', 
      accentColor: '#f59e0b',
      icon: '🛍️'
    },
    { 
      name: 'PROFILE', 
      path: '/profile', 
      title: 'Loading Your Profile', 
      subtitle: 'Fetching your account, posts & settings', 
      accentColor: '#10b981',
      icon: '👤'
    }
  ];

  const handleTabClick = (tabObj) => {
    setLoadingState({ active: true, tab: tabObj, status: 'loading' });

    // 5+ seconds professional video-style progress animation
    setTimeout(() => {
      setLoadingState({ active: true, tab: tabObj, status: 'success' });

      setTimeout(() => {
        navigate(tabObj.path);
        setLoadingState({ active: false, tab: null, status: 'default' });
      }, 1200); // 1.2s delay after success checkmark
    }, 5200); // 5.2 seconds duration
  };

  return (
    <>
      {/* Full Screen Professional Video-Style Interactive Overlay */}
      {loadingState.active && loadingState.tab && (
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
          backdropFilter: 'blur(25px)'
        }}>
          
          <div className="text-center mb-4 zoom">
            <div className="fs-1 mb-2">{loadingState.tab.icon}</div>
            <h1 className="text-white fw-bold mb-2 display-5">{loadingState.tab.title}</h1>
            <p className="text-muted fs-4">{loadingState.tab.subtitle}</p>
          </div>

          {/* Video style big capsule loading bar in full screen */}
          <div className="position-relative overflow-hidden shadow-lg" style={{ width: '420px', height: '85px', borderRadius: '42px', background: loadingState.status === 'success' ? '#10b981' : '#1e293b', transition: 'background 0.5s ease' }}>
            
            {loadingState.status === 'loading' && (
              <>
                <div className="position-absolute top-0 start-0 h-100 shimmer" style={{ width: '100%', background: loadingState.tab.accentColor, animation: 'videoProgressFill 5.2s linear forwards' }}></div>
                <span className="position-absolute top-50 start-50 translate-middle text-white fw-bold fs-4 z-2">
                  Processing {loadingState.tab.name}...
                </span>
              </>
            )}

            {loadingState.status === 'success' && (
              <div className="position-absolute top-50 start-50 translate-middle text-white fs-2 fw-bold zoom d-flex align-items-center gap-2">
                ✓ Ready
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
        @keyframes videoProgressFill {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </>
  );
};

export default TopTabs;
