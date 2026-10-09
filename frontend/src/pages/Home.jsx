import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import ProductCard from '../components/ProductCard';
import '../styles/Home.css';
import '../styles/Animation.css';

const Home = () => {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const response = await api.get('/products');
        setFeaturedProducts(response.data.slice(0, 8)); // Top 8 items
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchFeatured();
  }, []);

  return (
    <div className="home-page page-enter">
      {/* Hero Banner with Zoom & Fade Animation */}
      <section className="hero-section text-white py-5 mb-5 shimmer" style={{ background: 'linear-gradient(135deg, #1e1e2f 0%, #2a2a40 100%)', borderRadius: '15px' }}>
        <div className="container py-5 text-center zoom">
          <span className="badge bg-primary px-3 py-2 mb-3 rounded-pill pulse">NEW COLLECTION 2026</span>
          <h1 className="display-4 fw-bold mb-3 slide-left">Welcome to JR STORE</h1>
          <p className="lead mb-4 slide-right text-light">Discover premium products with high-end style, instant checkout, and real-time support.</p>
          <div className="d-flex justify-content-center gap-3">
            <Link to="/shop" className="btn btn-light btn-lg px-4 fw-bold btn-animate shadow">Shop Now</Link>
            <Link to="/reels" className="btn btn-outline-light btn-lg px-4 btn-animate">Explore Reels</Link>
          </div>
        </div>
      </section>

      {/* Featured Products Section */}
      <section className="container mb-5">
        <div className="d-flex justify-content-between align-items-center mb-4 fade-up">
          <h2 className="fw-bold text-dark">Trending Products</h2>
          <Link to="/shop" className="text-decoration-none fw-semibold text-primary">View All →</Link>
        </div>

        {loading ? (
          <div className="row">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="col-md-3 mb-4">
                <div className="card shimmer-loading" style={{ height: '300px', borderRadius: '12px' }}></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="row">
            {featuredProducts.map((product, index) => (
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
