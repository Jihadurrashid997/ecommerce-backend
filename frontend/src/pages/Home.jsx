import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import ProductCard from '../components/ProductCard';
import '../styles/Home.css';
import '../styles/Animation.css';

const Home = () => {
  const [feedItems, setFeedItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        const response = await api.get('/products');
        setFeedItems(response.data.slice(0, 8));
      } catch (error) {
        console.error("Error fetching feed:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchFeed();
  }, []);

  return (
    <div className="home-page page-enter container py-4">
      {/* E Top Brand Hero Banner with High-End Glassmorphism & Animation */}
      <section className="hero-section text-white p-5 mb-5 rounded-4 position-relative overflow-hidden shimmer" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
        <div className="position-relative z-2 text-center py-4 zoom">
          <span className="badge bg-gradient px-4 py-2 mb-3 rounded-pill pulse fs-6" style={{ background: 'linear-gradient(45deg, #6366f1, #a855f7)' }}>✨ E TOP SOCIAL STORE</span>
          <h1 className="display-3 fw-bold mb-3 slide-left text-glow">Connect, Share & Shop</h1>
          <p className="lead mb-4 slide-right text-light opacity-8 mx-auto" style={{ maxWidth: '600px' }}>
            Explore trending reels, connect with creators on messenger, and shop exclusive products instantly with micro-animations.
          </p>
          <div className="d-flex justify-content-center gap-3">
            <Link to="/shop" className="btn btn-light btn-lg px-4 fw-bold btn-animate shadow-lg rounded-pill">Explore Shop</Link>
            <Link to="/reels" className="btn btn-outline-light btn-lg px-4 btn-animate rounded-pill glass-panel">Watch Reels 🎬</Link>
          </div>
        </div>
      </section>

      {/* Social & Trending Products Section */}
      <section className="mb-5">
        <div className="d-flex justify-content-between align-items-center mb-4 fade-up">
          <h3 className="fw-bold text-dark m-0">🔥 Trending on E Top</h3>
          <Link to="/shop" className="text-decoration-none fw-semibold text-primary hover-lift">View All Feed →</Link>
        </div>

        {loading ? (
          <div className="row">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="col-md-3 mb-4">
                <div className="card shimmer-loading border-0 shadow-sm" style={{ height: '320px', borderRadius: '16px' }}></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="row">
            {feedItems.map((product, index) => (
              <div key={product._id || index} className={`col-md-3 mb-4 fade-up delay-${(index % 5) + 1}`}>
                <div className="card-animate h-100">
                  <ProductCard product={product} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Home;
