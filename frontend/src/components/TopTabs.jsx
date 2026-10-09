import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/Animation.css';

const TopTabs = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(null);
  const [status, setStatus] = useState('default'); // 'default', 'loading', 'success'

  const tabs = [
    { name: 'HOME', path: '/' },
    { name: 'REELS', path: '/reels' },
    { name: 'MESSENGER', path: '/messenger' },
    { name: 'SHOP', path: '/shop' },
    { name: 'PROFILE', path: '/profile' }
  ];

  const handleTabClick = (path, name) => {
    setActiveTab(name);
    setStatus('loading');

    // Video-r moto loading progress simulation (1.2 seconds)
    setTimeout(() => {
      setStatus('success');
      
      // Navigate after success checkmark shows up
      setTimeout(() => {
        navigate(path);
        setStatus('default');
        setActiveTab(null);
      }, 800);
    }, 1200);
  };

  return (
    <div className="container mt-3">
      <div className="d-flex justify-content-center bg-dark p-2 rounded-pill shadow-lg gap-2 overflow-auto" style={{ backdropFilter: 'blur(10px)' }}>
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path || (tab.path === '/' && location.pathname === '/home');
          const isCurrentClicked = activeTab === tab.name;

          return (
            <button
              key={tab.name}
              onClick={() => handleTabClick(tab.path, tab.name)}
              className={`btn px-4 py-2 rounded-pill fw-bold position-relative overflow-hidden transition-all ${
                isActive ? 'btn-light text-dark shadow' : 'btn-dark text-white opacity-75'
              }`}
              style={{
                minWidth: '110px',
                transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                transform: isCurrentClicked && status === 'loading' ? 'scale(0.96)' : 'scale(1)'
              }}
            >
              {isCurrentClicked && status === 'loading' ? (
                <span className="d-flex align-items-center justify-content-center gap-2">
                  <span className="spinner-border spinner-border-sm text-primary" role="status"></span>
                  <span>Loading...</span>
                </span>
              ) : isCurrentClicked && status === 'success' ? (
                <span className="text-success fw-bold d-flex align-items-center justify-content-center gap-1">
                  ✓ Done
                </span>
              ) : (
                tab.name
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TopTabs;
