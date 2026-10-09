import React, { useState } from 'react';

const VideoStyleButton = ({ onComplete, buttonText = "Complete Order" }) => {
  const [status, setStatus] = useState('default'); // 'default', 'loading', 'success'

  const handleClick = () => {
    if (status !== 'default') return;
    setStatus('loading');

    // Video-r moto 4-5 second er smooth progress animation delay
    setTimeout(() => {
      setStatus('success');
      
      if (onComplete) {
        setTimeout(() => {
          onComplete();
        }, 1500);
      }
    }, 4500); // 4.5+ seconds duration as you requested
  };

  return (
    <div className="d-flex justify-content-center align-items-center py-4">
      <button
        onClick={handleClick}
        className={`position-relative border-0 text-white fw-bold overflow-hidden shadow-lg transition-all ${
          status === 'loading' ? 'loading-state' : status === 'success' ? 'success-state' : 'default-state'
        }`}
        style={{
          width: status === 'default' ? '240px' : '70px',
          height: '60px',
          borderRadius: '30px',
          background: status === 'success' ? '#10b981' : '#1e293b',
          cursor: status === 'default' ? 'pointer' : 'default',
          transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1), background 0.4s ease'
        }}
      >
        {status === 'default' && (
          <span className="position-absolute top-50 start-50 translate-middle w-100 text-center fs-6 tracking-wide">
            {buttonText}
          </span>
        )}

        {status === 'loading' && (
          <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center">
            {/* Video-r style sliding progress bar */}
            <div className="position-absolute top-0 start-0 h-100 bg-primary opacity-50 shimmer" style={{ width: '100%', animation: 'progressFill 4.5s linear forwards' }}></div>
            <div className="spinner-border text-light spinner-border-sm position-relative z-2" role="status"></div>
          </div>
        )}

        {status === 'success' && (
          <div className="position-absolute top-50 start-50 translate-middle text-white fs-4 zoom">
            ✓
          </div>
        )}
      </button>

      <style>{`
        @keyframes progressFill {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default VideoStyleButton;
