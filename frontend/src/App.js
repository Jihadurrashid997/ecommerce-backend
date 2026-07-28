import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

function App() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false); 
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [userRole, setUserRole] = useState('customer');
  const [activePage, setActivePage] = useState('home'); 

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('customer');
  const [isLoading, setIsLoading] = useState(false);

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null, type: 'danger' });

  // সার্চ এবং মেসেজিং স্টেট
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState([
    { sender: 'Seller Support', text: 'Hello! Welcome to JR Store. How can I help you today?', time: '10:00 AM' }
  ]);
  const [newMessage, setNewMessage] = useState('');

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3500);
  };

  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  const [isCurrentPasswordValid, setIsCurrentPasswordValid] = useState(false);

  const [productTitle, setProductTitle] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productImage, setProductImage] = useState('');

  const presetAvatars = [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150"
  ];

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 4000);

    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('userInfo');
    const storedRole = localStorage.getItem('userRole');

    if (token && storedUser) {
      setIsLoggedIn(true);
      const parsedUser = JSON.parse(storedUser);
      setUserInfo(parsedUser);
      setUserRole(storedRole || 'customer');
      
      setEditName(parsedUser.name || '');
      setEditPhone(parsedUser.phone || '');
      setEditPhoto(parsedUser.photo || ''); // ফিক্সড: লগইন বা রিলোডের পর যাতে পিকচার হারিয়ে না যায়
    }

    return () => clearTimeout(timer);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
    localStorage.removeItem('userRole');
    setIsLoggedIn(false);
    setUserInfo(null);
    setUserRole('customer');
    setActivePage('home');
    showToast("Logged out successfully!", "success");
  };

  const handleDeactivateAccount = () => {
    setConfirmModal({
      show: true,
      title: 'Deactivate Account',
      message: 'Are you sure you want to temporarily deactivate your account? You can log back in anytime to reactivate it.',
      type: 'warning',
      onConfirm: () => {
        setConfirmModal({ show: false, title: '', message: '', onConfirm: null, type: 'danger' });
        showToast("Account deactivated temporarily.", "info");
        handleLogout();
      }
    });
  };

  const handleDeleteAccount = () => {
    setConfirmModal({
      show: true,
      title: 'Delete Account Permanently',
      message: 'WARNING: This will permanently delete your account and all data. This action cannot be undone!',
      type: 'danger',
      onConfirm: () => {
        setConfirmModal({ show: false, title: '', message: '', onConfirm: null, type: 'danger' });
        localStorage.clear();
        setIsLoggedIn(false);
        setUserInfo(null);
        setActivePage('home');
        showToast("Account deleted permanently.", "danger");
      }
    });
  };

  const handleImageUploadFromFile = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditPhoto(reader.result); 
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVerifyCurrentPassword = () => {
    const storedPass = userInfo?.password; 
    if (!currentPassword) {
      showToast("Please enter your current password first!", "danger");
      setIsCurrentPasswordValid(false);
      return;
    }
    if (storedPass && currentPassword !== storedPass) {
      setIsCurrentPasswordValid(false);
      showToast("Incorrect current password!", "danger");
      return;
    }
    setIsCurrentPasswordValid(true);
    showToast("Current password verified!", "success");
  };

  const handleUpdateProfile = (e) => {
    e.preventDefault();
    if (newPassword && !isCurrentPasswordValid) {
      showToast("Verify current password before changing password!", "danger");
      return;
    }

    const updatedUser = {
      ...userInfo,
      name: editName,
      phone: editPhone,
      photo: editPhoto // পার্মানেন্টলি ছবি সেভ রাখা হলো
    };

    if (newPassword) {
      updatedUser.password = newPassword;
    }

    localStorage.setItem('userInfo', JSON.stringify(updatedUser));
    setUserInfo(updatedUser);
    setCurrentPassword('');
    setNewPassword('');
    setIsCurrentPasswordValid(false);

    showToast("Profile updated successfully!", "success");
    setActivePage('profile');
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const newMsgObj = { sender: userInfo?.name || 'Customer', text: newMessage, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages([...messages, newMsgObj]);
    setNewMessage('');
    showToast("Message sent!", "success");
  };

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
        showToast("Product uploaded successfully!", "success");
        setProductTitle(''); setProductPrice(''); setProductCategory(''); setProductDescription(''); setProductImage('');
      } else {
        showToast(data.message || "Failed to upload product", "danger");
      }
    } catch (err) {
      showToast("Server error during product upload!", "danger");
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const baseUrl = 'https://ecommerce-api-9wc9.onrender.com';
    const endpoint = isRegisterMode ? '/api/users/register' : '/api/users/login';

    const payload = isRegisterMode 
      ? { name, email, password, role: selectedRole } 
      : { email, password };

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      setIsLoading(false);

      if (!response.ok) {
        showToast(data.message || data.error || "Authentication failed!", "danger");
        return;
      }

      showToast(isRegisterMode ? "Registration Successful!" : "Login Successful!", "success");
      localStorage.setItem('token', data.token || 'dummy-token');
      
      const userData = data.user || { name: name || 'User', email, password };
      if (!userData.password) userData.password = password; 
      
      localStorage.setItem('userInfo', JSON.stringify(userData));
      const role = isRegisterMode ? selectedRole : (data.role || data.user?.role || 'customer');
      localStorage.setItem('userRole', role);

      setIsLoggedIn(true);
      setUserInfo(userData);
      setUserRole(role);
      setShowLoginModal(false);
      setName(''); setEmail(''); setPassword('');

    } catch (err) {
      setIsLoading(false);
      showToast("Network or Server error!", "danger");
    }
  };

  if (showWelcome) {
    return (
      <div style={splashStyles.container}>
        <AnimatePresence mode="wait">
          {showWelcome && (
            <motion.div
              key="splash-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)", transition: { duration: 1.2, ease: "easeInOut" }}}
              style={splashStyles.content}
            >
              <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3, duration: 0.8, type: "spring", bounce: 0.4 }} style={splashStyles.logoWrapper}>
                <div style={splashStyles.logoGlow}></div>
                <span style={splashStyles.logoText}>JR</span>
              </motion.div>
              <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2, duration: 0.5 }} style={splashStyles.title}>Welcome to JR STORE</motion.h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.8 }} transition={{ delay: 2, duration: 0.8 }} style={splashStyles.subtitle}>The Art of Shopping</motion.p>
              <motion.div initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ delay: 1.5, duration: 2.5, ease: "linear" }} style={splashStyles.progressBar} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }} style={{ backgroundColor: '#111', minHeight: '100vh', color: '#fff', position: 'relative' }}>
      
      {toast.show && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999 }}>
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.9 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            exit={{ opacity: 0, y: -20 }}
            className={`alert ${toast.type === 'success' ? 'alert-success' : toast.type === 'danger' ? 'alert-danger' : 'alert-info'} shadow-lg text-dark fw-bold px-4 py-3 rounded-pill d-flex align-items-center gap-2`}
            style={{ minWidth: '250px', border: '1px solid #444' }}
          >
            <span>{toast.message}</span>
          </motion.div>
        </div>
      )}

      {confirmModal.show && (
        <div style={modalStyles.overlay}>
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ ...modalStyles.box, textAlign: 'center' }}>
            <h4 className="fw-bold text-white mb-3">{confirmModal.title}</h4>
            <p className="text-light mb-4" style={{ fontSize: '15px', opacity: 0.9 }}>{confirmModal.message}</p>
            <div className="d-flex justify-content-center gap-3">
              <button className="btn btn-outline-light rounded-pill px-4" onClick={() => setConfirmModal({ show: false, title: '', message: '', onConfirm: null, type: 'danger' })}>Cancel</button>
              <button className={`btn ${confirmModal.type === 'danger' ? 'btn-danger' : 'btn-warning'} rounded-pill px-4 fw-bold`} onClick={confirmModal.onConfirm}>Confirm</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ন্যাভবার */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-black p-3 sticky-top border-bottom border-secondary">
        <div className="container">
          <a className="navbar-brand fw-bold fs-3 text-white" href="#home" onClick={(e) => { e.preventDefault(); setActivePage('home'); }} style={{ letterSpacing: '2px', cursor: 'pointer' }}>
            <span style={{color:'#ddd'}}>JR</span> STORE
          </a>
          
          {/* সার্চ ইনপুট ফিল্ড (প্রোডাক্ট বা প্রোফাইল খোঁজার জন্য) */}
          <div className="d-none d-md-flex mx-auto" style={{ width: '300px' }}>
            <input 
              type="text" 
              className="form-control bg-dark text-white border-secondary rounded-pill px-3" 
              placeholder="Search products or profiles..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
            <span className="navbar-toggler-icon"></span>
          </button>
          
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav ms-auto align-items-center py-2 py-lg-0">
              <li className="nav-item"><a className="nav-link text-light" href="#home" onClick={(e) => { e.preventDefault(); setActivePage('home'); }}>Home</a></li>
              
              {/* মেসেজিং অপশন */}
              {isLoggedIn && (
                <li className="nav-item">
                  <a className="nav-link text-light position-relative" href="#messages" onClick={(e) => { e.preventDefault(); setActivePage('messages'); }}>
                    Messages
                    <span className="position-absolute top-2 start-100 translate-middle p-1 bg-primary border border-light rounded-circle"></span>
                  </a>
                </li>
              )}

              <li className="nav-item mt-2 mt-lg-0">
                {isLoggedIn ? (
                  <div className="dropdown ms-lg-3">
                    <button className="btn btn-outline-light rounded-pill px-4 dropdown-toggle d-flex align-items-center gap-2 position-relative" type="button" data-bs-toggle="dropdown">
                      <span style={{
                        position: 'absolute', top: '6px', left: '10px', width: '10px', height: '10px',
                        backgroundColor: isLoggedIn ? '#0d6efd' : '#dc3545', borderRadius: '50%', border: '2px solid #000'
                      }}></span>
                      
                      {userInfo?.photo ? (
                        <img src={userInfo.photo} alt="Profile" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', marginLeft: '8px' }} />
                      ) : null}
                      <span style={{ marginLeft: userInfo?.photo ? '0' : '10px' }}>{userInfo?.name || 'My Account'}</span>
                    </button>
                    <ul className="dropdown-menu dropdown-menu-dark bg-black border-secondary">
                      <li><button className="dropdown-item text-light" onClick={() => setActivePage('profile')}>My Profile</button></li>
                      {(userRole === 'seller' || userRole === 'admin') && (
                        <li><button className="dropdown-item text-light" onClick={() => setActivePage('upload')}>Upload Product</button></li>
                      )}
                      <li><button className="dropdown-item text-light" onClick={() => setActivePage('messages')}>Messages</button></li>
                      <li><hr className="dropdown-divider border-secondary" /></li>
                      <li><button className="dropdown-item text-danger" onClick={handleLogout}>Logout</button></li>
                    </ul>
                  </div>
                ) : (
                  <button className="btn btn-outline-light ms-lg-3 px-4 rounded-pill w-100 w-lg-auto" onClick={() => { setIsRegisterMode(false); setShowLoginModal(true); }}>
                    Sign In
                  </button>
                )}
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* সাইন ইন / রেজিস্ট্রেশন মডাল */}
      {showLoginModal && (
        <div style={modalStyles.overlay}>
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={modalStyles.box}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3 className="fw-bold m-0 text-white" style={{ letterSpacing: '1px' }}>{isRegisterMode ? 'REGISTER' : 'SIGN IN'}</h3>
              <button className="btn-close btn-close-white" onClick={() => setShowLoginModal(false)}></button>
            </div>
            
            <form onSubmit={handleAuthSubmit}>
              {isRegisterMode && (
                <>
                  <div className="mb-3 text-start">
                    <label className="form-label text-light fw-semibold">Full Name</label>
                    <input type="text" className="form-control bg-dark text-white border-secondary" placeholder="Enter your name" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="mb-3 text-start">
                    <label className="form-label text-light fw-semibold">Select Account Type</label>
                    <select className="form-select bg-dark text-white border-secondary" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                      <option value="customer">Customer Account</option>
                      <option value="seller">Seller Account</option>
                    </select>
                  </div>
                </>
              )}
              <div className="mb-3 text-start">
                <label className="form-label text-light fw-semibold">Email address</label>
                <input type="email" className="form-control bg-dark text-white border-secondary" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="mb-4 text-start">
                <label className="form-label text-light fw-semibold">Password</label>
                <input type="password" className="form-control bg-dark text-white border-secondary" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              
              <button type="submit" className="btn btn-light w-100 rounded-pill fw-bold py-2 text-uppercase mb-3 d-flex justify-content-center align-items-center gap-2" style={{ letterSpacing: '1px' }} disabled={isLoading}>
                {isLoading && <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>}
                {isLoading ? 'Processing...' : (isRegisterMode ? 'Sign Up' : 'Login')}
              </button>

              <div className="text-center">
                <p className="small mb-0 text-light" style={{ opacity: 0.8 }}>
                  {isRegisterMode ? "Already have an account?" : "Don't have an account?"}{" "}
                  <span style={{ color: '#fff', cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' }} onClick={() => setIsRegisterMode(!isRegisterMode)}>
                    {isRegisterMode ? "Sign In" : "Register here"}
                  </span>
                </p>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* মেসেজিং বা চ্যাট পেজ (কাস্টমার ও সেলারের যোগাযোগের জন্য) */}
      {isLoggedIn && activePage === 'messages' && (
        <div className="container py-5">
          <div className="row justify-content-center">
            <div className="col-md-8 bg-black p-4 border border-secondary rounded-4 shadow-lg text-start">
              <h3 className="fw-bold text-white mb-3">💬 Customer & Seller Chat</h3>
              <p className="text-muted small mb-4">Direct messaging for orders, custom requests, and support.</p>
              
              <div className="bg-dark p-3 rounded-3 mb-3 overflow-auto" style={{ height: '350px', border: '1px solid #444' }}>
                {messages.map((msg, index) => (
                  <div key={index} className={`mb-3 p-3 rounded-3 ${msg.sender === (userInfo?.name || 'Customer') ? 'ms-auto bg-primary text-white' : 'bg-secondary text-dark'}`} style={{ maxWidth: '75%' }}>
                    <div className="d-flex justify-content-between small fw-bold mb-1">
                      <span>{msg.sender}</span>
                      <span className="opacity-75" style={{ fontSize: '10px' }}>{msg.time}</span>
                    </div>
                    <p className="mb-0">{msg.text}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendMessage} className="input-group">
                <input 
                  type="text" 
                  className="form-control bg-dark text-white border-secondary" 
                  placeholder="Type a message to seller/customer..." 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <button type="submit" className="btn btn-light px-4 fw-bold">Send</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* প্রোফাইল পেজ */}
      {isLoggedIn && activePage === 'profile' && (
        <div className="container py-5 text-start">
          <div className="row justify-content-center">
            <div className="col-md-8 bg-black p-5 border border-secondary rounded-4 shadow-lg">
              <div className="d-flex align-items-center mb-4 gap-4">
                <div style={{ position: 'relative', width: '90px', height: '90px' }}>
                  <div style={{ width: '100%', height: '100%', borderRadius: '50%', backgroundColor: '#222', overflow: 'hidden', border: '2px solid #555', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {userInfo?.photo ? (
                      <img src={userInfo.photo} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span className="fs-1 text-light">{userInfo?.name?.charAt(0) || 'U'}</span>
                    )}
                  </div>
                  <span title={isLoggedIn ? "Online" : "Offline"} style={{
                    position: 'absolute', bottom: '5px', right: '5px', width: '16px', height: '16px',
                    backgroundColor: isLoggedIn ? '#0d6efd' : '#dc3545', borderRadius: '50%', border: '3px solid #000'
                  }}></span>
                </div>
                <div>
                  <h2 className="fw-bold mb-1 text-white d-flex align-items-center gap-2" style={{ letterSpacing: '1px' }}>
                    {userInfo?.name}
                    <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '20px', backgroundColor: isLoggedIn ? 'rgba(13, 110, 253, 0.2)' : 'rgba(220, 53, 69, 0.2)', color: isLoggedIn ? '#0d6efd' : '#dc3545', border: `1px solid ${isLoggedIn ? '#0d6efd' : '#dc3545'}` }}>
                      {isLoggedIn ? '● Active Now' : '● Offline'}
                    </span>
                  </h2>
                  <p className="text-light mb-0" style={{ opacity: 0.8 }}>{userInfo?.email}</p>
                  <span className="badge bg-light text-dark text-uppercase mt-2">{userRole}</span>
                </div>
              </div>

            <hr className="border-secondary mb-4" />
             
            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <p className="text-light fw-semibold mb-1" style={{ opacity: 0.8 }}>Phone Number</p>
                <h5 className="text-white">{userInfo?.phone || 'Not Added Yet'}</h5>
              </div>
              <div className="col-md-6">
                <p className="text-light fw-semibold mb-1" style={{ opacity: 0.8 }}>Account Type</p>
                <h5 className="text-white text-uppercase">{userRole}</h5>
              </div>
            </div>
             
            <div className="d-flex flex-wrap gap-3 align-items-center">
              <button className="btn btn-light rounded-pill px-4 fw-bold" onClick={() => { setEditName(userInfo?.name || ''); setActivePage('edit-profile'); }}>
                Edit Profile & Security
              </button>
              {(userRole === 'seller' || userRole === 'admin') && (
                <button className="btn btn-outline-light rounded-pill px-4" onClick={() => setActivePage('upload')}>
                  Upload New Product
                </button>
              )}
              <button className="btn btn-outline-warning rounded-pill px-3" onClick={handleDeactivateAccount}>
                Deactivate
              </button>
              <button className="btn btn-outline-danger rounded-pill px-3" onClick={handleDeleteAccount}>
                Delete Account
              </button>
              <button className="btn btn-outline-secondary rounded-pill px-4 ms-auto" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* প্রফাইল এডিট পেজ */}
    {isLoggedIn && activePage === 'edit-profile' && (
      <div className="container py-5 text-start">
        <div className="row justify-content-center">
          <div className="col-md-8 bg-black p-5 border border-secondary rounded-4 shadow-lg">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3 className="fw-bold m-0 text-white" style={{ letterSpacing: '1px' }}>EDIT PROFILE & PASSWORD</h3>
              <button className="btn btn-sm btn-outline-light" onClick={() => setActivePage('profile')}>Cancel</button>
          </div>
          <hr className="border-secondary mb-4" />

          <form onSubmit={handleUpdateProfile}>
            <div className="mb-3">
              <label className="form-label text-light fw-semibold">Full Name</label>
              <input type="text" className="form-control bg-dark text-white border-secondary" value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
             
            <div className="mb-3">
              <label className="form-label text-light fw-semibold">Phone Number</label>
              <input type="text" className="form-control bg-dark text-white border-secondary" placeholder="Enter your phone number" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            </div>

          <div className="mb-3">
            <label className="form-label text-light fw-semibold">Profile Photo</label>
            <input type="file" accept="image/*" className="form-control bg-dark text-white border-secondary mb-2" onChange={handleImageUploadFromFile} />
            <div className="d-flex gap-3 my-2 flex-wrap align-items-center">
              <span className="text-muted small">Or select preset:</span>
              {presetAvatars.map((url, idx) => (
                <img 
                  key={idx} 
                  src={url} 
                  alt="Avatar Preset" 
                  onClick={() => setEditPhoto(url)} 
                  style={{ width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', border: editPhoto === url ? '3px solid #fff' : '2px solid #555', objectFit: 'cover' }} 
                />
              ))}
            </div>
          </div>

          <hr className="border-secondary my-4" />
          <h5 className="text-white mb-3">Change Password Security</h5>

          <div className="mb-3">
            <label className="form-label text-light fw-semibold">Current Password</label>
            <div className="input-group">
              <input 
                type="password" 
                className="form-control bg-dark text-white border-secondary" 
                placeholder="Enter current password" 
                value={currentPassword} 
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setIsCurrentPasswordValid(false); 
                }} 
              />
              <button type="button" className="btn btn-outline-light" onClick={handleVerifyCurrentPassword}>Verify</button>
            </div>
            {isCurrentPasswordValid && <small className="text-success mt-1 d-block">✓ Current password verified successfully!</small>}
          </div>

          <div className="mb-4">
            <label className="form-label text-light fw-semibold">New Password</label>
            <input 
              type="password" 
              className="form-control bg-dark text-white border-secondary" 
              placeholder={isCurrentPasswordValid ? "Enter new password (min 8 chars)" : "Verify current password first..."} 
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)} 
              disabled={!isCurrentPasswordValid} 
            />
          </div>

          <button type="submit" className="btn btn-light w-100 rounded-pill fw-bold py-2 text-uppercase">Save All Changes</button>
        </form>
      </div>
      </div>
    </div>
   )}

    {/* প্রোডাক্ট আপলোড পেজ */}
    {isLoggedIn && activePage === 'upload' && (userRole === 'seller' || userRole === 'admin') && (
      <div className="container py-5 text-start">
        <div className="row justify-content-center">
          <div className="col-md-8 bg-black p-5 border border-secondary rounded-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3 className="fw-bold m-0 text-white" style={{ letterSpacing: '1px' }}>UPLOAD PRODUCT</h3>
              <button className="btn btn-sm btn-outline-light" onClick={() => setActivePage('profile')}>Back to Profile</button>
          </div>
          <hr className="border-secondary mb-4" />

          <form onSubmit={handleProductUpload}>
            <div className="mb-3">
              <label className="form-label text-light fw-semibold">Product Title</label>
              <input type="text" className="form-control bg-dark text-white border-secondary" value={productTitle} onChange={(e) => setProductTitle(e.target.value)} required />
            </div>
            <div className="mb-3">
              <label className="form-label text-light fw-semibold">Price ($)</label>
              <input type="number" className="form-control bg-dark text-white border-secondary" value={productPrice} onChange={(e) => setProductPrice(e.target.value)} required />
            </div>
            <div className="mb-3">
              <label className="form-label text-light fw-semibold">Category</label>
              <input type="text" className="form-control bg-dark text-white border-secondary" value={productCategory} onChange={(e) => setProductCategory(e.target.value)} required />
            </div>
            <div className="mb-3">
              <label className="form-label text-light fw-semibold">Description</label>
              <textarea className="form-control bg-dark text-white border-secondary" rows="3" value={productDescription} onChange={(e) => setProductDescription(e.target.value)} required></textarea>
            </div>
            <div className="mb-4">
              <label className="form-label text-light fw-semibold">Image URL</label>
              <input type="text" className="form-control bg-dark text-white border-secondary" value={productImage} onChange={(e) => setProductImage(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-light w-100 rounded-pill fw-bold py-2 text-uppercase">Publish Product</button>
          </form>
        </div>
        </div>
      </div>
   )}

    {/* হোমপেজ */}
    {activePage === 'home' && (
      <>
        <header className="container-fluid text-center py-5" style={{ minHeight: '60vh', display:'flex', flexDirection:'column', justifyContent:'center', background: 'radial-gradient(circle, #222 0%, #000 100%)' }}>
          <motion.h1 initial={{y: 30, opacity: 0}} animate={{y:0, opacity:1}} transition={{delay: 0.2, duration: 0.8}} className="display-1 fw-bold mb-3 text-white" style={{textTransform: 'uppercase', letterSpacing: '5px'}}>
            Pure Elegance
          </motion.h1>
          <motion.p initial={{opacity: 0}} animate={{opacity: 0.9}} transition={{delay: 0.6, duration: 0.8}} className="lead fs-3 text-light" style={{opacity: 0.8}}>Discover our exclusive premium collection.</motion.p>
          <motion.div initial={{scale: 0.9, opacity: 0}} animate={{scale: 1, opacity:1}} transition={{delay: 1, duration: 0.5}}>
            <button className="btn btn-light btn-lg mt-4 px-5 py-3 rounded-pill fw-bold text-uppercase" style={{letterSpacing: '1px'}}>Shop Now</button>
          </motion.div>
        </header>

        <div className="container py-5">
          {searchQuery && (
            <div className="mb-4 text-start text-white">
              <h5>Search results for: "{searchQuery}"</h5>
              <hr className="border-secondary" />
            </div>
          )}
          <div className="row g-4">
            {[1, 2, 3].map((i) => (
              <div className="col-md-4" key={i}>
                <motion.div initial={{y: 50, opacity: 0}} whileInView={{y: 0, opacity: 1}} viewport={{once: true}} transition={{duration: 0.5, delay: i * 0.2}} className="card h-100 bg-black border border-secondary rounded-0 p-3">
                  <div className="bg-dark d-flex align-items-center justify-content-center" style={{ height: '300px', color:'#aaa' }}>
                    Image {i}
                  </div>
                  <div className="card-body text-center">
                    <h5 className="card-title fw-bold text-uppercase text-white mt-2" style={{letterSpacing: '2px'}}>Signature Item {i}</h5>
                    <p className="text-light mb-4" style={{opacity: 0.8}}>$999.00</p>
                    <button className="btn btn-outline-light w-100 rounded-0 text-uppercase" style={{letterSpacing: '1px'}} onClick={() => {
                      if(!isLoggedIn) {
                        setShowLoginModal(true);
                      } else {
                        setActivePage('messages');
                      }
                    }}>Contact Seller</button>
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

const modalStyles = {
  overlay: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 },
  box: { backgroundColor: '#161616', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '400px', border: '1px solid #444', boxShadow: '0 10px 30px rgba(0,0,0,0.7)' }
};

const splashStyles = {
  container: { height: '100vh', width: '100vw', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#000', overflow: 'hidden', position: 'fixed', top: 0, left: 0, zIndex: 1000 },
  content: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', width: '100%', height: '100%' },
  logoWrapper: { position: 'relative', width: '120px', height: '120px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '40px' },
  logoGlow: { position: 'absolute', width: '100%', height: '100%', background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(15px)' },
  logoText: { fontSize: '60px', fontWeight: '100', color: '#fff', fontFamily: 'Helvetica Neue, Arial, sans-serif', letterSpacing: '2px', position: 'relative', zIndex: 1 },
  title: { fontSize: '40px', fontWeight: '300', color: '#fff', textTransform: 'uppercase', letterSpacing: '8px', margin: '0 0 15px 0', fontFamily: 'Helvetica Neue, sans-serif' },
  subtitle: { fontSize: '18px', color: '#fff', fontWeight: '200', letterSpacing: '4px', opacity: 0.8, marginBottom: '60px' },
  progressBar: { height: '1px', background: 'linear-gradient(90deg, transparent, #fff, transparent)', position: 'absolute', bottom: '10%', width: '0%', left: 0 }
};

export default App;
