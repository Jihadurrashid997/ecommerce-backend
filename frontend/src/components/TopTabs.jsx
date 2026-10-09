import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/Animation.css';

const TopTabs = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [animatingTab, setAnimatingTab] = useState(null);

  const tabs = [
    { name: 'HOME', path: '/' },
    { name: 'REELS', path: '/reels' },
    { name: 'MESSENGER', path: '/messenger' },
    { name: 'SHOP', path: '/shop' },
    { name: 'PROFILE', path: '/profile' }
  ];

  const handleTabClick = (path, name) => {
    setAnimatingTab(name);
    setTimeout(() => {
      navigate(path);
      setAnimatingTab(null);
    }, 500); // Video-r moto smooth timing delay
  };

  return (
    <div className="container mt-3 position-relative">
      {/* Video-style Sliding / Loading Overlay on Click */}
      {animatingTab && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style={{ background: 'rgba(15, 23, 42, 0.7)', zIndex: 9999, backdropFilter: 'blur(8px)' }}>
          <div className="bg-white p-4 rounded-pill shadow-lg d-flex align-items-center gap-3 zoom">
            <div className="spinner-border text-primary" role="status"></div>
            <span className="fw-bold text-dark">Loading {animatingTab}...</span>
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
              style={{ transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}
            >
              {tab.name}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TopTabs;
