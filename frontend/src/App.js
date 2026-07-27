import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js'; // মোবাইল মেনু টগল করার জন্য এটি জরুরি

function App() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false); 
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // লগইন স্টেট এবং ইউজার ডাটা হ্যান্ডেল করার জন্য
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [userRole, setUserRole] = useState('customer');
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' অথবা 'upload'

  // ইনপুট ফিল্ডের স্টেটগুলো (অথেন্টিকেশন)
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // প্রোডাক্ট আপলোড ফর্মের স্টেটগুলো
  const [productTitle, setProductTitle] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productImage, setProductImage] = useState('');

  useEffect(() => {
    // ৪ সেকেন্ডের প্রিমিয়াম ট্রানজিশন
    const timer = setTimeout(() => setShowWelcome(false), 4000);

    // লোকাল স্টোরেজ থেকে ইউজারের লগইন তথ্য চেক করা
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('userInfo');
    const storedRole = localStorage.getItem('userRole');

    if (token && storedUser) {
      setIsLoggedIn(true);
      setUserInfo(JSON.parse(storedUser));
      setUserRole(storedRole || 'customer');
    }

    return () => clearTimeout(timer);
  }, []);

  // --- লগআউট হ্যান্ডলার ---
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
    localStorage.removeItem('userRole');
    setIsLoggedIn(false);
    setUserInfo(null);
    setUserRole('customer');
    window.location.reload();
  };

  // --- প্রোডাক্ট আপলোড হ্যান্ডলার ---
  const handleProductUpload = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');

    const productData = {
      title: productTitle,
      price: productPrice,
      category: productCategory,
      description: productDescription,
      image: productImage
    };

    try {
      const baseUrl = 'https://ecommerce-api-9wc9.onrender.com';
      const response = await fetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(productData)
      });

      const data = await response.json();

      if (response.ok) {
        alert("Product uploaded successfully!");
        setProductTitle('');
        setProductPrice('');
        setProductCategory('');
        setProductDescription('');
        setProductImage('');
      } else {
        alert(data.message || "Failed to upload product");
      }
    } catch (err) {
      console.error("Product Upload Error:", err);
      alert("Server error during product upload!");
    }
  };

  // --- ব্যাকএন্ড API কানেকশন ও ভ্যালিডেশন হ্যান্ডলার ---
  const handleAuthSubmit = async (e) => {
    e.preventDefault(); 

    // ফ্রন্টএন্ডে পাসওয়ার্ড ৮ ডিজিটের কম কি না চেক করা
    if (password.length < 8) {
      alert("Password must be at least 8 characters long!");
      return;
    }

    // লাইভ ব্যাকএন্ডের সঠিক রেন্ডার লিংক
    const baseUrl = 'https://ecommerce-api-9wc9.onrender.com';

    const endpoint = isRegisterMode 
      ? `${baseUrl}/api/auth/register` 
      : `${baseUrl}/api/auth/login`;

    const payload = isRegisterMode 
      ? { name, email, password } 
      : { email, password };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        alert(data.message); // সফল মেসেজ দেখাবে

        if (data.token) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('userInfo', JSON.stringify(data.user || data.userInfo));
          localStorage.setItem('userRole', data.role || data.user?.role || 'customer');
        }

        setShowLoginModal(false);
        setName('');
        setEmail('');
        setPassword('');
        window.location.reload();
      } else {
        alert(data.message); 
      }
    } catch (err) {
      console.error("Connection Error:", err);
      alert("Server error or backend is not running!");
    }
  };

  // --- প্রিমিয়াম ওয়েলকাম স্ক্রিন (নিউ ডিজাইন) ---
  if (showWelcome) {
    return (
      <div style={splashStyles.container}>
        <AnimatePresence mode="wait">
          {showWelcome && (
            <motion.div
              key="splash-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ 
                opacity: 0, 
                scale: 1.1, 
                filter: "blur(10px)", 
                transition: { duration: 1.2, ease: "easeInOut" }
              }}
              style={splashStyles.content}
            >
              {/* লোগো উইথ গ্লো ইফেক্ট */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.8, type: "spring", bounce: 0.4 }}
                style={splashStyles.logoWrapper}
              >
                <div style={splashStyles.logoGlow}></div>
                <span style={splashStyles.logoText}>JR</span>
              </motion.div>

              {/* টাইপরাইটার স্টাইল মেইন টাইটেল */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2, duration: 0.5 }}
                style={splashStyles.title}
              >
                Welcome to JR STORE
              </motion.h1>

              {/* সাব-টাইটেল */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                transition={{ delay: 2, duration: 0.8 }}
                style={splashStyles.subtitle}
              >
                The Art of Shopping
              </motion.p>

              {/* ছোট লোডিং বার */}
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ delay: 1.5, duration: 2.5, ease: "linear" }}
                style={splashStyles.progressBar}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // --- মেইন ওয়েবসাইট ---
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
      style={{ backgroundColor: '#111', minHeight: '100vh', color: '#fff', position: 'relative' }}
    >
      <nav className="navbar navbar-expand-lg navbar-dark bg-black p-3 sticky-top border-bottom border-secondary">
        <div className="container">
          <a className="navbar-brand fw-bold fs-3" href="#" style={{ letterSpacing: '2px' }}>
            <span style={{color:'#aaa'}}>JR</span> STORE
          </a>
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav ms-auto align-items-center py-2 py-lg-0">
              <li className="nav-item"><a className="nav-link active" href="#">New Arrivals</a></li>
              <li className="nav-item"><a className="nav-link" href="#">Collections</a></li>
              <li className="nav-item"><a className="nav-link" href="#">Accessories</a></li>
              
              <li className="nav-item mt-2 mt-lg-0">
                {isLoggedIn ? (
                  <div className="dropdown ms-lg-3">
                    <button className="btn btn-outline-light rounded-pill px-4 dropdown-toggle" type="button" data-bs-toggle="dropdown">
                      {userInfo?.name || 'My Profile'}
                    </button>
                    <ul className="dropdown-menu dropdown-menu-dark bg-black border-secondary">
                      <li><button className="dropdown-item" onClick={() => setActiveTab('profile')}>Dashboard</button></li>
                      {(userRole === 'seller' || userRole === 'admin') && (
                        <li><button className="dropdown-item" onClick={() => setActiveTab('upload')}>Upload Product</button></li>
                      )}
                      <li><hr className="dropdown-divider border-secondary" /></li>
                      <li><button className="dropdown-item text-danger" onClick={handleLogout}>Logout</button></li>
                    </ul>
                  </div>
                ) : (
                  <button 
                    className="btn btn-outline-light ms-lg-3 px-4 rounded-pill w-100 w-lg-auto" 
                    onClick={() => { setIsRegisterMode(false); setShowLoginModal(true); }}
                  >
                    Sign In
                  </button>
                )}
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* সাইন ইন / রেজিস্ট্রেশন মডাল (পপআপ) */}
      {showLoginModal && (
        <div style={modalStyles.overlay}>
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={modalStyles.box}
          >
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3 className="fw-bold m-0" style={{ letterSpacing: '1px' }}>
                {isRegisterMode ? 'REGISTER' : 'SIGN IN'}
              </h3>
              <button 
                className="btn-close btn-close-white" 
                onClick={() => setShowLoginModal(false)}
              ></button>
            </div>
            
            <form onSubmit={handleAuthSubmit}>
              {isRegisterMode && (
                <div className="mb-3 text-start">
                  <label className="form-label text-muted">Full Name</label>
                  <input 
                    type="text" 
                    className="form-control bg-dark text-white border-secondary" 
                    placeholder="Enter your name" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required 
                  />
                </div>
              )}

              <div className="mb-3 text-start">
                <label className="form-label text-muted">Email address</label>
                <input 
                  type="email" 
                  className="form-control bg-dark text-white border-secondary" 
                  placeholder="Enter your email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>

              <div className="mb-4 text-start">
                <label className="form-label text-muted">Password (Min 8 characters)</label>
                <input 
                  type="password" 
                  className="form-control bg-dark text-white border-secondary" 
                  placeholder="Password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </div>

              <button type="submit" className="btn btn-light w-100 rounded-pill fw-bold py-2 text-uppercase mb-3" style={{ letterSpacing: '1px' }}>
                {isRegisterMode ? 'Sign Up' : 'Login'}
              </button>

              <div className="text-center">
                <p className="text-muted small mb-0">
                  {isRegisterMode ? "Already have an account?" : "Don't have an account?"}{" "}
                  <span 
                    style={{ color: '#fff', cursor: 'pointer', textDecoration: 'underline' }} 
                    onClick={() => setIsRegisterMode(!isRegisterMode)}
                  >
                    {isRegisterMode ? "Sign In" : "Register here"}
                  </span>
                </p>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* যদি ইউজার লগইন করা থাকে এবং ড্যাশবোর্ড ট্যাব সিলেক্ট করে তবে প্রফাইল বা আপলোড সেকশন দেখাবে */}
      {isLoggedIn && activeTab === 'profile' && (
        <div className="container py-5 text-start">
          <div className="row justify-content-center">
            <div className="col-md-8 bg-black p-5 border border-secondary rounded-4">
              <h2 className="fw-bold mb-4" style={{ letterSpacing: '2px' }}>USER DASHBOARD</h2>
              <hr className="border-secondary mb-4" />
              <p><strong>Name:</strong> {userInfo?.name || 'N/A'}</p>
              <p><strong>Email:</strong> {userInfo?.email || 'N/A'}</p>
              <p><strong>Account Role:</strong> <span className="badge bg-light text-dark text-uppercase">{userRole}</span></p>
              
              <div className="mt-4 d-flex gap-3">
                {(userRole === 'seller' || userRole === 'admin') && (
                  <button className="btn btn-outline-light rounded-pill px-4" onClick={() => setActiveTab('upload')}>
                    Upload New Product
                  </button>
                )}
                <button className="btn btn-danger rounded-pill px-4" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* বিক্রেতা বা Admin দের জন্য প্রোডাক্ট আপলোড ফর্ম */}
      {isLoggedIn && activeTab === 'upload' && (userRole === 'seller' || userRole === 'admin') && (
        <div className="container py-5 text-start">
          <div className="row justify-content-center">
            <div className="col-md-8 bg-black p-5 border border-secondary rounded-4">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h3 className="fw-bold m-0" style={{ letterSpacing: '1px' }}>UPLOAD PRODUCT</h3>
                <button className="btn btn-sm btn-outline-light" onClick={() => setActiveTab('profile')}>Back to Profile</button>
              </div>
              <hr className="border-secondary mb-4" />

              <form onSubmit={handleProductUpload}>
                <div className="mb-3">
                  <label className="form-label text-muted">Product Title</label>
                  <input type="text" className="form-control bg-dark text-white border-secondary" value={productTitle} onChange={(e) => setProductTitle(e.target.value)} required />
                </div>
                <div className="mb-3">
                  <label className="form-label text-muted">Price ($)</label>
                  <input type="number" className="form-control bg-dark text-white border-secondary" value={productPrice} onChange={(e) => setProductPrice(e.target.value)} required />
                </div>
                <div className="mb-3">
                  <label className="form-label text-muted">Category</label>
                  <input type="text" className="form-control bg-dark text-white border-secondary" value={productCategory} onChange={(e) => setProductCategory(e.target.value)} required />
                </div>
                <div className="mb-3">
                  <label className="form-label text-muted">Description</label>
                  <textarea className="form-control bg-dark text-white border-secondary" rows="3" value={productDescription} onChange={(e) => setProductDescription(e.target.value)} required></textarea>
                </div>
                <div className="mb-4">
                  <label className="form-label text-muted">Image URL</label>
                  <input type="text" className="form-control bg-dark text-white border-secondary" value={productImage} onChange={(e) => setProductImage(e.target.value)} required />
                </div>
                <button type="submit" className="btn btn-light w-100 rounded-pill fw-bold py-2 text-uppercase">Publish Product</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ডিফল্ট হোমপেজ কন্টেন্ট */}
      {(!isLoggedIn || activeTab === 'home') && (
        <>
          <header className="container-fluid text-center py-5" style={{ minHeight: '60vh', display:'flex', flexDirection:'column', justifyContent:'center', background: 'radial-gradient(circle, #222 0%, #000 100%)' }}>
            <motion.h1 
              initial={{y: 30, opacity: 0}}
              animate={{y:0, opacity:1}}
              transition={{delay: 0.2, duration: 0.8}}
              className="display-1 fw-bold mb-3" style={{textTransform: 'uppercase', letterSpacing: '5px'}}>
              Pure Elegance
            </motion.h1>
            <motion.p 
              initial={{opacity: 0}}
              animate={{opacity: 0.7}}
              transition={{delay: 0.6, duration: 0.8}}
              className="lead fs-3">Discover our exclusive premium collection.</motion.p>
            <motion.div
               initial={{scale: 0.9, opacity: 0}}
               animate={{scale: 1, opacity:1}}
               transition={{delay: 1, duration: 0.5}}
            >
                <button className="btn btn-light btn-lg mt-4 px-5 py-3 rounded-pill fw-bold text-uppercase" style={{letterSpacing: '1px'}}>Shop Now</button>
            </motion.div>
          </header>

          <div className="container py-5">
            <div className="row g-4">
              {[1, 2, 3].map((i) => (
                <div className="col-md-4" key={i}>
                  <motion.div 
                    initial={{y: 50, opacity: 0}}
                    whileInView={{y: 0, opacity: 1}}
                    viewport={{once: true}}
                    transition={{duration: 0.5, delay: i * 0.2}}
                    className="card h-100 bg-black border border-secondary rounded-0 p-3"
                  >
                    <div className="bg-dark d-flex align-items-center justify-content-center" style={{ height: '300px', color:'#555' }}>
                      Image {i}
                    </div>
                    <div className="card-body text-center">
                      <h5 className="card-title fw-bold text-uppercase mt-2" style={{letterSpacing: '2px'}}>Signature Item</h5>
                      <p className="text-muted mb-4">$999.00</p>
                      <button className="btn btn-outline-light w-100 rounded-0 text-uppercase" style={{letterSpacing: '1px'}}>View</button>
                    </div>
                  </motion.div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}

// মডাল বা পপআপ এর স্টাইল
const modalStyles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  box: {
    backgroundColor: '#161616',
    padding: '30px',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '400px',
    border: '1px solid #333',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
  }
};

// স্প্ল্যাশ স্ক্রিন স্টাইল অবজেক্ট
const splashStyles = {
  container: {
    height: '100vh',
    width: '100vw',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: '#000',
    overflow: 'hidden',
    position: 'fixed',
    top: 0,
    left: 0,
    zIndex: 1000,
  },
  content: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  logoWrapper: {
    position: 'relative',
    width: '120px',
    height: '120px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '40px',
  },
  logoGlow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, rgba(0,0,0,0) 70%)',
    filter: 'blur(15px)',
  },
  logoText: {
    fontSize: '60px',
    fontWeight: '100',
    color: '#fff',
    fontFamily: 'Helvetica Neue, Arial, sans-serif',
    letterSpacing: '2px',
    position: 'relative',
    zIndex: 1,
  },
  title: {
    fontSize: '40px',
    fontWeight: '300',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: '8px',
    margin: '0 0 15px 0',
    fontFamily: 'Helvetica Neue, sans-serif',
  },
  subtitle: {
    fontSize: '18px',
    color: '#fff',
    fontWeight: '200',
    letterSpacing: '4px',
    opacity: 0.6,
    marginBottom: '60px',
  },
  progressBar: {
    height: '1px',
    background: 'linear-gradient(90deg, transparent, #fff, transparent)',
    position: 'absolute',
    bottom: '10%',
    width: '0%',
    left: 0,
  }
};

export default App;
