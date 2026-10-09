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
    }, 400); // Smooth micro-animation delay matching the video style
  };

  return (
    <div className="container mt-3">
      <div className="d-flex justify-content-center bg-dark p-2 rounded-pill shadow-lg gap-2 overflow-auto" style={{ backdropFilter: 'blur(10px)' }}>
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path || (tab.path === '/' && location.pathname === '/home');
          const isAnimating = animatingTab === tab.name;

          return (
            <button
              key={tab.name}
              onClick={() => handleTabClick(tab.path, tab.name)}
              className={`btn px-4 py-2 rounded-pill fw-bold transition-all position-relative overflow-hidden ${
                isActive ? 'btn-light text-dark shadow' : 'btn-dark text-white opacity-75'
              }`}
              style={{
                transform: isAnimating ? 'scale(0.95)' : 'scale(1)',
                transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
              }}
            >
              {tab.name}
              {isAnimating && (
                <span className="position-absolute top-0 start-0 w-100 h-100 bg-primary opacity-25 shimmer"></span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TopTabs;
