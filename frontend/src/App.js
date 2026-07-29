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

  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null, type: 'danger' });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('all'); 
  
  // সম্পূর্ণ ফ্রেশ রেজিস্ট্রেশন সিস্টেম (শুধুমাত্র সুপার অ্যাডমিন থাকবে)
  const defaultSuperAdmin = { 
    name: 'Jihadur Rashid', 
    role: 'admin', 
    email: 'jihadurrashid997@gmail.com', 
    phone: '01700000000', 
    photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    isVerified: true 
  };

  const [profilesList, setProfilesList] = useState([defaultSuperAdmin]);

  const [allProductsList, setAllProductsList] = useState([
    { id: 1, title: 'Signature Luxury Item', price: '999.00', category: 'Luxury', seller: 'Jihadur Rashid', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300' },
    { id: 2, title: 'Classic Gold Watch', price: '1,499.00', category: 'Accessories', seller: 'Jihadur Rashid', image: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=300' }
  ]);

  const [adminMessages, setAdminMessages] = useState([]);
  const [newAdminMessage, setNewAdminMessage] = useState('');

  const [chatTargetUser, setChatTargetUser] = useState(null); 
  const [directMessages, setDirectMessages] = useState({}); 
  const [newDirectMessage, setNewDirectMessage] = useState('');
  const [selectedProfileModalUser, setSelectedProfileModalUser] = useState(null);

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

  const FacebookBlueTick = () => (
    <span 
      title="Verified Original Master Admin" 
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '15px',
        height: '15px',
        backgroundColor: '#1877F2',
        borderRadius: '50%',
        color: '#fff',
        fontSize: '9px',
        fontWeight: '900',
        marginLeft: '4px',
        verticalAlign: 'middle',
        boxShadow: '0 0 2px rgba(24, 119, 242, 0.6)'
      }}
    >
      ✓
    </span>
  );

  const EmailBadge = ({ email }) => {
    const isOriginal = email === 'jihadurrashid997@gmail.com' || email.endsWith('@jrstore.com') || email.includes('admin');
    return (
      <span className={`badge ${isOriginal ? 'bg-success' : 'bg-warning text-dark'} ms-2`} style={{ fontSize: '10px' }}>
        {isOriginal ? '✓ Original Official' : '⚡ Registered User'}
      </span>
    );
  };

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 2500);

    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('userInfo');
    const storedRole = localStorage.getItem('userRole');
    const savedProfiles = localStorage.getItem('profilesList');
    const savedMessages = localStorage.getItem('directMessages');
    const savedProducts = localStorage.getItem('allProductsList');
    const savedAdminMsgs = localStorage.getItem('adminMessages');

    if (savedProfiles) { try { setProfilesList(JSON.parse(savedProfiles)); } catch (e) {} }
    if (savedMessages) { try { setDirectMessages(JSON.parse(savedMessages)); } catch (e) {} }
    if (savedProducts) { try { setAllProductsList(JSON.parse(savedProducts)); } catch (e) {} }
    if (savedAdminMsgs) { try { setAdminMessages(JSON.parse(savedAdminMsgs)); } catch (e) {} }

    if (token && storedUser) {
      setIsLoggedIn(true);
      const parsedUser = JSON.parse(storedUser);
      setUserInfo(parsedUser);
      setUserRole(storedRole || 'customer');
      
      setEditName(parsedUser.name || '');
      setEditPhone(parsedUser.phone || '');
      setEditPhoto(parsedUser.photo || ''); 
    }

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => { localStorage.setItem('profilesList', JSON.stringify(profilesList)); }, [profilesList]);
  useEffect(() => { localStorage.setItem('directMessages', JSON.stringify(directMessages)); }, [directMessages]);
  useEffect(() => { localStorage.setItem('allProductsList', JSON.stringify(allProductsList)); }, [allProductsList]);
  useEffect(() => { localStorage.setItem('adminMessages', JSON.stringify(adminMessages)); }, [adminMessages]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
    localStorage.removeItem('userRole');
    setIsLoggedIn(false);
    setUserInfo(null);
    setUserRole('customer');
    setActivePage('home');
    showToast("Logged out successfully!", "success");
    setTimeout(() => { window.location.reload(); }, 400);
  };

  const handleDeactivateAccount = () => {
    setConfirmModal({
      show: true,
      title: 'Deactivate Account',
      message: 'Are you sure you want to temporarily deactivate your account?',
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
      title: 'Delete Account',
      message: 'Are you sure you want to permanently delete your account?',
      type: 'danger',
      onConfirm: () => {
        if (userInfo?.email === 'jihadurrashid997@gmail.com') {
          showToast("Cannot delete Super Admin account!", "danger");
          setConfirmModal({ show: false, title: '', message: '', onConfirm: null, type: 'danger' });
          return;
        }
        setProfilesList(profilesList.filter(p => p.email !== userInfo?.email));
        setConfirmModal({ show: false, title: '', message: '', onConfirm: null, type: 'danger' });
        showToast("Account deleted successfully!", "success");
        handleLogout();
      }
    });
  };

  const handleImageUploadFromFile = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setEditPhoto(reader.result); };
      reader.readAsDataURL(file);
    }
  };

  const handleProductFile = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setProductImage(reader.result); };
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
      photo: editPhoto 
    };

    if (newPassword) { updatedUser.password = newPassword; }

    localStorage.setItem('userInfo', JSON.stringify(updatedUser));
    setUserInfo(updatedUser);
    
    setProfilesList(prev => prev.map(p => p.email === updatedUser.email ? { ...p, name: editName, phone: editPhone, photo: editPhoto } : p));

    setCurrentPassword('');
    setNewPassword('');
    setIsCurrentPasswordValid(false);

    showToast("Profile updated successfully!", "success");
    setActivePage('profile');
  };

  const handleDeleteUserByAdmin = (emailToDelete) => {
    if (emailToDelete === 'jihadurrashid997@gmail.com') {
      showToast("Cannot delete Super Admin account!", "danger");
      return;
    }
    setProfilesList(profilesList.filter(p => p.email !== emailToDelete));
    showToast("User profile deleted by Admin!", "success");
  };

  const handleDeleteProductByAdmin = (productId) => {
    setAllProductsList(allProductsList.filter(p => p.id !== productId));
    showToast("Product removed by Admin!", "success");
  };

  const handleSendAdminMessage = (e) => {
    e.preventDefault();
    if (!newAdminMessage.trim()) return;

    const newMsgObj = { 
      sender: userInfo?.name || 'User', 
      senderEmail: userInfo?.email || 'user@store.com',
      senderPhoto: userInfo?.photo || presetAvatars[0],
      text: newAdminMessage, 
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    };
    setAdminMessages([...adminMessages, newMsgObj]);
    setNewAdminMessage('');
    showToast("Message sent to Admin Panel successfully!", "success");
  };

  const handleSendDirectMessage = (e) => {
    e.preventDefault();
    if (!newDirectMessage.trim() || !chatTargetUser) return;

    const userEmails = [userInfo.email, chatTargetUser.email].sort();
    const chatKey = `${userEmails[0]}_${userEmails[1]}`;
    const currentMsgs = directMessages[chatKey] || [];

    const newMsgObj = {
      sender: userInfo.name,
      senderEmail: userInfo.email,
      senderPhoto: userInfo.photo || presetAvatars[0],
      text: newDirectMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setDirectMessages({
      ...directMessages,
      [chatKey]: [...currentMsgs, newMsgObj]
    });
    setNewDirectMessage('');
  };

  const handleProductUpload = async (e) => {
    e.preventDefault();
    if (!productTitle || !productPrice || !productCategory) {
      showToast("Please fill all required product fields!", "danger");
      return;
    }

    const newProd = {
      id: Date.now(),
      title: productTitle,
      price: productPrice,
      category: productCategory,
      description: productDescription,
      image: productImage || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300',
      seller: userInfo?.name || 'Admin'
    };

    setAllProductsList([newProd, ...allProductsList]);
    showToast("Product uploaded successfully!", "success");
    setProductTitle(''); setProductPrice(''); setProductCategory(''); setProductDescription(''); setProductImage('');
    setActivePage('home');
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();

    if (isRegisterMode && selectedRole === 'admin' && email !== 'jihadurrashid997@gmail.com') {
      showToast("Admin account registration is restricted!", "danger");
      return;
    }

    if (!isRegisterMode && email === 'jihadurrashid997@gmail.com') {
      if (password !== '252002051') {
        showToast("Incorrect Password for Super Admin!", "danger");
        return;
      }
    }

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      showToast(isRegisterMode ? "Registration Successful!" : "Login Successful!", "success");
      localStorage.setItem('token', 'jr-secure-token-2026');
      
      const role = (email === 'jihadurrashid997@gmail.com' && password === '252002051') ? 'admin' : (isRegisterMode ? selectedRole : 'customer');
      const userData = { 
        name: name || (role === 'admin' ? 'Jihadur Rashid' : email.split('@')[0]), 
        email, 
        password, 
        role, 
        phone: '01700000000',
        photo: presetAvatars[0],
        isVerified: true
      };
      
      localStorage.setItem('userInfo', JSON.stringify(userData));
      localStorage.setItem('userRole', role);

      setIsLoggedIn(true);
      setUserInfo(userData);
      setUserRole(role);
      setShowLoginModal(false);
      setName(''); setEmail(''); setPassword('');

      setProfilesList(prev => {
        if (!prev.some(p => p.email === userData.email)) {
          return [...prev, userData];
        }
        return prev.map(p => p.email === userData.email ? userData : p);
      });
    }, 600);
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
              exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)", transition: { duration: 0.8, ease: "easeInOut" }}}
              style={splashStyles.content}
            >
              <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, duration: 0.5, type: "spring", bounce: 0.4 }} style={splashStyles.logoWrapper}>
                <div style={splashStyles.logoGlow}></div>
                <span style={splashStyles.logoText}>JR</span>
              </motion.div>
              <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.4 }} style={splashStyles.title}>Welcome to JR STORE</motion.h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.9 }} transition={{ delay: 0.9, duration: 0.4 }} style={splashStyles.subtitle}>Official Online Marketplace</motion.p>
              <motion.div initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ delay: 0.8, duration: 1.4, ease: "linear" }} style={splashStyles.progressBar} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} style={{ backgroundColor: '#111', minHeight: '100vh', color: '#fff', position: 'relative' }}>
      
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

      {selectedProfileModalUser && (
        <div style={modalStyles.overlay}>
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ ...modalStyles.box, textAlign: 'center', position: 'relative' }}>
            <button className="btn-close btn-close-white position-absolute top-0 end-0 m-3" onClick={() => setSelectedProfileModalUser(null)}></button>
            
            <div className="my-3">
              <img src={selectedProfileModalUser.photo || presetAvatars[0]} alt="Profile" style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #555' }} />
            </div>
            <h4 className="fw-bold text-white d-flex align-items-center justify-content-center gap-2">
              {selectedProfileModalUser.name}
              {selectedProfileModalUser.role === 'admin' && <FacebookBlueTick />}
            </h4>
            <p className="text-light small mb-1">Email: {selectedProfileModalUser.email}</p>
            <div className="mb-2"><EmailBadge email={selectedProfileModalUser.email} /></div>
            <p className="text-light small mb-3">Phone: {selectedProfileModalUser.phone || 'N/A'}</p>
            <span className="badge bg-secondary text-uppercase mb-4">{selectedProfileModalUser.role}</span>
            
            <div className="d-flex justify-content-center gap-2">
              {isLoggedIn && selectedProfileModalUser.email !== userInfo?.email && (
                <button className="btn btn-warning rounded-pill px-4 fw-bold text-dark" onClick={() => {
                  const target = selectedProfileModalUser;
                  setSelectedProfileModalUser(null);
                  setChatTargetUser(target);
                  setActivePage('messenger');
                }}>💬 Chat Now</button>
              )}
              <button className="btn btn-outline-light rounded-pill px-4" onClick={() => setSelectedProfileModalUser(null)}>Close</button>
            </div>
          </motion.div>
        </div>
      )}

      <nav className="navbar navbar-expand-lg navbar-dark bg-black p-3 sticky-top border-bottom border-secondary">
        <div className="container">
          <a className="navbar-brand fw-bold fs-3 text-white" href="#home" onClick={(e) => { e.preventDefault(); setActivePage('home'); setSearchQuery(''); }} style={{ letterSpacing: '2px', cursor: 'pointer' }}>
            <span style={{color:'#fff'}}>JR</span> STORE
          </a>
          
          <div className="d-none d-md-flex mx-auto align-items-center gap-2" style={{ width: '480px' }}>
            <select 
              className="form-select bg-dark text-white border-secondary rounded-pill text-center" 
              style={{ width: '130px', fontSize: '13px' }}
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
            >
              <option value="all">Search All</option>
              <option value="product">Products</option>
              <option value="profile">Profiles</option>
            </select>
            <div className="position-relative flex-grow-1">
              <input 
                type="text" 
                className="form-control bg-dark text-white border-secondary rounded-pill px-3" 
                placeholder={searchType === 'profile' ? "Search profile..." : searchType === 'product' ? "Search product..." : "Search product & profile..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
            <span className="navbar-toggler-icon"></span>
          </button>
          
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav ms-auto align-items-center py-2 py-lg-0">
              <li className="nav-item"><a className="nav-link text-light" href="#home" onClick={(e) => { e.preventDefault(); setActivePage('home'); setSearchQuery(''); }}>Home</a></li>
              
              {isLoggedIn && userRole === 'admin' && (
                <li className="nav-item">
                  <a className="nav-link text-danger fw-bold" href="#admin-dashboard" onClick={(e) => { e.preventDefault(); setActivePage('admin-dashboard'); }}>
                    ⚡ Admin Master Panel
                  </a>
                </li>
              )}

              {isLoggedIn && (
                <li className="nav-item">
                  <a className="nav-link text-warning fw-semibold" href="#messenger" onClick={(e) => { 
                    e.preventDefault(); 
                    const otherProfile = profilesList.find(p => p.email !== userInfo?.email) || profilesList[0];
                    setChatTargetUser(otherProfile);
                    setActivePage('messenger'); 
                  }}>
                    💬 Messenger
                  </a>
                </li>
              )}

              <li className="nav-item mt-2 mt-lg-0">
                {isLoggedIn ? (
                  <div className="dropdown ms-lg-3">
                    <button className="btn btn-outline-light rounded-pill px-4 dropdown-toggle d-flex align-items-center gap-2 position-relative" type="button" data-bs-toggle="dropdown">
                      <span style={{
                        position: 'absolute', top: '6px', left: '10px', width: '10px', height: '10px',
                        backgroundColor: '#0d6efd', borderRadius: '50%', border: '2px solid #000'
                      }}></span>
                      
                      {userInfo?.photo ? (
                        <img src={userInfo.photo} alt="Profile" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', marginLeft: '8px' }} />
                      ) : null}
                      <span style={{ marginLeft: userInfo?.photo ? '0' : '10px', color: '#fff' }}>{userInfo?.name || 'My Account'}</span>
                    </button>
                    <ul className="dropdown-menu dropdown-menu-dark bg-black border-secondary">
                      <li><button className="dropdown-item text-light" onClick={() => setActivePage('profile')}>My Profile</button></li>
                      {userRole === 'admin' && (
                        <li><button className="dropdown-item text-danger fw-bold" onClick={() => setActivePage('admin-dashboard')}>⚡ Admin Master Panel</button></li>
                      )}
                      {(userRole === 'seller' || userRole === 'admin') && (
                        <li><button className="dropdown-item text-light" onClick={() => setActivePage('upload')}>Upload Product</button></li>
                      )}
                      <li><button className="dropdown-item text-warning" onClick={() => {
                        const otherProfile = profilesList.find(p => p.email !== userInfo?.email) || profilesList[0];
                        setChatTargetUser(otherProfile);
                        setActivePage('messenger');
                      }}>💬 Messenger</button></li>
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
                <small className="text-info mt-1 d-block" style={{ fontSize: '11px' }}>* Official emails like admin are verified automatically.</small>
              </div>
              <div className="mb-4 text-start">
                <label className="form-label text-light fw-semibold">Password</label>
                <div className="input-group">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    className="form-control bg-dark text-white border-secondary" 
                    placeholder="Password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                  />
                  <button 
                    type="button" 
                    className="btn btn-outline-secondary text-light" 
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>
              
              <button type="submit" className="btn btn-light w-100 rounded-pill fw-bold py-2 text-uppercase mb-3 d-flex justify-content-center align-items-center gap-2" style={{ letterSpacing: '1px' }} disabled={isLoading}>
                {isLoading && <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>}
                {isLoading ? 'Processing...' : (isRegisterMode ? 'Sign Up' : 'Login')}
              </button>

              <div className="text-center">
                <p className="small mb-0 text-light" style={{ opacity: 0.9 }}>
                  {isRegisterMode ? "Already have an account?" : "Don't have an account?"}{" "}
                  <span style={{ color: '#ffc107', cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' }} onClick={() => setIsRegisterMode(!isRegisterMode)}>
                    {isRegisterMode ? "Sign In" : "Register here"}
                  </span>
                </p>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {isLoggedIn && userRole === 'admin' && activePage === 'admin-dashboard' && (
        <div className="container py-5 text-start">
          <div className="bg-black p-4 border border-danger rounded-4 shadow-lg mb-5">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div>
                <h2 className="fw-bold text-danger m-0 d-flex align-items-center gap-2">
                  ⚡ Super Admin Master Dashboard 
                  <FacebookBlueTick />
                </h2>
                <p className="text-light small mb-0">Control all user registrations, products, and direct messages.</p>
              </div>
              <button className="btn btn-outline-light btn-sm" onClick={() => setActivePage('profile')}>Back to Profile</button>
            </div>

            <div className="row g-4 mb-5">
              <div className="col-md-4">
                <div className="bg-dark p-3 rounded-3 border border-secondary text-center">
                  <h6 className="text-light text-uppercase">Total Profiles</h6>
                  <h2 className="text-white fw-bold">{profilesList.length}</h2>
                </div>
              </div>
              <div className="col-md-4">
                <div className="bg-dark p-3 rounded-3 border border-secondary text-center">
                  <h6 className="text-light text-uppercase">Total Products</h6>
                  <h2 className="text-white fw-bold">{allProductsList.length}</h2>
                </div>
              </div>
              <div className="col-md-4">
                <div className="bg-dark p-3 rounded-3 border border-secondary text-center">
                  <h6 className="text-light text-uppercase">Direct Messages</h6>
                  <h2 className="text-info fw-bold">{adminMessages.length}</h2>
                </div>
              </div>
            </div>

            <h4 className="text-white mb-3">🛡️ Incoming Messages from Profiles</h4>
            <div className="bg-dark p-3 rounded-3 mb-5 overflow-auto shadow-inner" style={{ height: '300px', border: '1px solid #444' }}>
              {adminMessages.length === 0 ? (
                <p className="text-light text-center mt-5 small">No incoming messages from users.</p>
              ) : (
                adminMessages.map((msg, index) => (
                  <div key={index} className="mb-3 p-3 rounded-3 bg-secondary text-white border border-secondary" style={{ maxWidth: '85%' }}>
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <div className="d-flex align-items-center gap-2">
                        <img src={msg.senderPhoto || presetAvatars[0]} alt="Sender" style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }} />
                        <span className="fw-bold text-warning">{msg.sender}</span>
                        <span className="small text-light">({msg.senderEmail})</span>
                      </div>
                      <span className="text-light" style={{ fontSize: '11px' }}>{msg.time}</span>
                    </div>
                    <p className="mb-0 text-white" style={{ fontSize: '15px' }}>{msg.text}</p>
                  </div>
                ))
              )}
            </div>

            <h4 className="text-white mb-3">👥 User Profiles Management</h4>
            <div className="table-responsive mb-5">
              <table className="table table-dark table-striped border border-secondary align-middle">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email & Status</th>
                    <th>Role</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {profilesList.map((prof, idx) => (
                    <tr key={idx}>
                      <td className="d-flex align-items-center gap-2 text-white" style={{ cursor: 'pointer' }} onClick={() => setSelectedProfileModalUser(prof)}>
                        <img src={prof.photo || presetAvatars[0]} alt="Avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                        <span className="text-decoration-underline fw-bold">{prof.name}</span>
                        {prof.role === 'admin' && <FacebookBlueTick />}
                      </td>
                      <td>
                        <span className="text-white">{prof.email}</span>
                        <EmailBadge email={prof.email} />
                      </td>
                      <td><span className="badge bg-secondary text-uppercase">{prof.role}</span></td>
                      <td>
                        {prof.email !== 'jihadurrashid997@gmail.com' && (
                          <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteUserByAdmin(prof.email)}>Delete Profile</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h4 className="text-white mb-3">🛍️ Product Assets Control</h4>
            <div className="table-responsive">
              <table className="table table-dark table-striped border border-secondary align-middle">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Seller</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allProductsList.map((prod) => (
                    <tr key={prod.id}>
                      <td className="fw-bold text-white">{prod.title}</td>
                      <td className="text-light">{prod.category}</td>
                      <td className="text-light">${prod.price}</td>
                      <td className="text-light">{prod.seller || 'Admin'}</td>
                      <td>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteProductByAdmin(prod.id)}>Remove Product</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {isLoggedIn && activePage === 'messenger' && (
        <div className="container py-5">
          <div className="row justify-content-center">
            <div className="col-md-10 bg-black p-4 border border-warning rounded-4 shadow-lg text-start">
              
              <div className="d-flex align-items-center justify-content-between mb-4 pb-3 border-bottom border-secondary">
                <div className="d-flex align-items-center gap-3">
                  <div className="d-flex align-items-center justify-content-center shadow" style={{
                    width: '64px', height: '64px', borderRadius: '16px',
                    background: 'linear-gradient(135deg, #ffc107 0%, #b38600 100%)',
                    border: '2px solid rgba(255, 193, 7, 0.4)', fontSize: '32px'
                  }}>
                    💬
                  </div>
                  <div>
                    <h3 className="fw-bold text-warning m-0 fs-2">Messenger Chat</h3>
                    <p className="text-light small mb-0" style={{ opacity: 0.9 }}>Chat instantly and securely with any profile.</p>
                  </div>
                </div>
                <button className="btn btn-sm btn-outline-light rounded-pill px-3" onClick={() => setActivePage('profile')}>Back</button>
              </div>

              <div className="row">
                <div className="col-md-4 border-end border-secondary pe-3">
                  <h6 className="text-light mb-3 fw-bold">All Profiles:</h6>
                  <div className="d-flex flex-column gap-2" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    {profilesList.filter(p => p.email !== userInfo?.email).map((prof, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => setChatTargetUser(prof)}
                        className={`p-2 rounded-3 d-flex align-items-center gap-2 ${chatTargetUser?.email === prof.email ? 'bg-warning text-dark fw-bold' : 'bg-dark text-white border border-secondary'}`}
                        style={{ cursor: 'pointer' }}
                      >
                        <img src={prof.photo || presetAvatars[0]} alt="Avatar" style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }} />
                        <div>
                          <div style={{ fontSize: '14px' }} className="d-flex align-items-center">
                            {prof.name} {prof.role === 'admin' && <FacebookBlueTick />}
                          </div>
                          <span style={{ fontSize: '10px' }} className="text-uppercase opacity-75">{prof.role}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {userRole !== 'admin' && (
                    <div className="mt-4 pt-3 border-top border-secondary">
                      <h6 className="text-info mb-2 fw-bold" style={{ fontSize: '13px' }}>🛡️ Send Direct Message to Admin:</h6>
                      <form onSubmit={handleSendAdminMessage}>
                        <input 
                          type="text" 
                          className="form-control form-control-sm bg-dark text-white border-secondary mb-2" 
                          placeholder="Type message to admin..." 
                          value={newAdminMessage}
                          onChange={(e) => setNewAdminMessage(e.target.value)}
                          required
                        />
                        <button type="submit" className="btn btn-sm btn-info w-100 text-dark fw-bold">Send to Admin Panel</button>
                      </form>
                    </div>
                  )}
                </div>

                <div className="col-md-8 ps-3 d-flex flex-column justify-content-between">
                  {chatTargetUser ? (
                    <>
                      <div className="d-flex align-items-center gap-2 border-bottom border-secondary pb-2 mb-3" style={{ cursor: 'pointer' }} onClick={() => setSelectedProfileModalUser(chatTargetUser)}>
                        <img src={chatTargetUser.photo || presetAvatars[0]} alt="Target" style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover' }} />
                        <h5 className="text-white m-0 d-flex align-items-center gap-1">
                          {chatTargetUser.name} {chatTargetUser.role === 'admin' && <FacebookBlueTick />} 
                          <span className="badge bg-secondary fs-6 text-uppercase ms-2">{chatTargetUser.role}</span>
                        </h5>
                        <small className="text-warning ms-auto">View Profile</small>
                      </div>

                      <div className="bg-dark p-3 rounded-3 mb-3 overflow-auto" style={{ height: '270px', border: '1px solid #444' }}>
                        {(() => {
                          const userEmails = [userInfo.email, chatTargetUser.email].sort();
                          const chatKey = `${userEmails[0]}_${userEmails[1]}`;
                          const currentMsgs = directMessages[chatKey] || [];

                          if (currentMsgs.length === 0) {
                            return <p className="text-light text-center mt-5 small" style={{ opacity: 0.7 }}>No conversation yet with {chatTargetUser.name}. Send your first message below!</p>;
                          }

                          return currentMsgs.map((msg, idx) => (
                            <div key={idx} className={`mb-3 p-2 rounded-3 ${msg.senderEmail === userInfo.email ? 'ms-auto bg-warning text-dark fw-semibold' : 'bg-secondary text-white'}`} style={{ maxWidth: '75%' }}>
                              <div className="d-flex justify-content-between small fw-bold mb-1" style={{ fontSize: '11px' }}>
                                <span>{msg.sender}</span>
                                <span className="opacity-75">{msg.time}</span>
                              </div>
                              <p className="mb-0" style={{ fontSize: '14px' }}>{msg.text}</p>
                            </div>
                          ));
                        })()}
                      </div>

                      <form onSubmit={handleSendDirectMessage} className="input-group">
                        <input 
                          type="text" 
                          className="form-control bg-dark text-white border-secondary py-2" 
                          placeholder={`Type message to ${chatTargetUser.name}...`} 
                          value={newDirectMessage}
                          onChange={(e) => setNewDirectMessage(e.target.value)}
                          required
                        />
                        <button type="submit" className="btn btn-warning px-4 fw-bold text-dark">Send</button>
                      </form>
                    </>
                  ) : (
                    <div className="text-center text-light my-auto">Please select a profile from the left list to chat.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  <span title="Online" style={{
                    position: 'absolute', bottom: '5px', right: '5px', width: '16px', height: '16px',
                    backgroundColor: '#0d6efd', borderRadius: '50%', border: '3px solid #000'
                  }}></span>
                </div>
                <div>
                  <h2 className="fw-bold mb-1 text-white d-flex align-items-center gap-2" style={{ letterSpacing: '1px' }}>
                    {userInfo?.name}
                    {userRole === 'admin' && <FacebookBlueTick />}
                    <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '20px', backgroundColor: 'rgba(13, 110, 253, 0.2)', color: '#0d6efd', border: '1px solid #0d6efd' }}>
                      ● Active Now
                    </span>
                  </h2>
                  <p className="text-light mb-1">{userInfo?.email}</p>
                  <div className="mb-2"><EmailBadge email={userInfo?.email} /></div>
                  <span className={`badge ${userRole === 'admin' ? 'bg-danger' : 'bg-light text-dark'} text-uppercase mt-1`}>{userRole}</span>
                </div>
              </div>

            <hr className="border-secondary mb-4" />
             
            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <p className="text-light fw-semibold mb-1" style={{ opacity: 0.9 }}>Phone Number</p>
                <h5 className="text-white">{userInfo?.phone || 'Not Added Yet'}</h5>
              </div>
              <div className="col-md-6">
                <p className="text-light fw-semibold mb-1" style={{ opacity: 0.9 }}>Account Status</p>
                <h5 className="text-success">Verified Active</h5>
              </div>
            </div>
             
            <div className="d-flex flex-wrap gap-3 align-items-center">
              <button className="btn btn-light rounded-pill px-4 fw-bold" onClick={() => { setEditName(userInfo?.name || ''); setActivePage('edit-profile'); }}>
                Edit Profile & Security
              </button>
              {userRole === 'admin' && (
                <button className="btn btn-danger rounded-pill px-4 fw-bold" onClick={() => setActivePage('admin-dashboard')}>
                  ⚡ Master Admin Panel
                </button>
              )}
              {(userRole === 'seller' || userRole === 'admin') && (
                <button className="btn btn-warning text-dark rounded-pill px-4 fw-bold" onClick={() => setActivePage('upload')}>
                  🛍️ Upload New Product
                </button>
              )}
              <button className="btn btn-outline-warning rounded-pill px-3" onClick={() => {
                const otherProfile = profilesList.find(p => p.email !== userInfo?.email) || profilesList[0];
                setChatTargetUser(otherProfile);
                setActivePage('messenger');
              }}>
                💬 Messenger
              </button>
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
              <input type="text" className="form-control bg-dark text-white border-secondary" placeholder="Enter phone number" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            </div>

          <div className="mb-3">
            <label className="form-label text-light fw-semibold">Profile Photo</label>
            <input type="file" accept="image/*" className="form-control bg-dark text-white border-secondary mb-2" onChange={handleImageUploadFromFile} />
            <div className="d-flex gap-3 my-2 flex-wrap align-items-center">
              <span className="text-light small">Or select preset avatar:</span>
              {presetAvatars.map((url, idx) => (
                <img 
                  key={idx} 
                  src={url} 
                  alt="Avatar Preset" 
                  onClick={() => setEditPhoto(url)} 
                  style={{ width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', border: editPhoto === url ? '3px solid #ffc107' : '2px solid #555', objectFit: 'cover' }} 
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
                type={showCurrentPassword ? "text" : "password"} 
                className="form-control bg-dark text-white border-secondary" 
                placeholder="Enter current password" 
                value={currentPassword} 
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setIsCurrentPasswordValid(false); 
                }} 
              />
              <button 
                type="button" 
                className="btn btn-outline-secondary text-light" 
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                {showCurrentPassword ? "🙈" : "👁️"}
              </button>
              <button type="button" className="btn btn-outline-light" onClick={handleVerifyCurrentPassword}>Verify</button>
            </div>
            {isCurrentPasswordValid && <small className="text-success mt-1 d-block">✓ Current password verified!</small>}
          </div>

          <div className="mb-4">
            <label className="form-label text-light fw-semibold">New Password</label>
            <div className="input-group">
              <input 
                type={showNewPassword ? "text" : "password"} 
                className="form-control bg-dark text-white border-secondary" 
                placeholder={isCurrentPasswordValid ? "Enter new password" : "Verify current password first..."} 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                disabled={!isCurrentPasswordValid} 
              />
              <button 
                type="button" 
                className="btn btn-outline-secondary text-light" 
                onClick={() => setShowNewPassword(!showNewPassword)}
                disabled={!isCurrentPasswordValid}
              >
                {showNewPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-light w-100 rounded-pill fw-bold py-2 text-uppercase">Save All Changes</button>
        </form>
      </div>
      </div>
    </div>
   )}

    {isLoggedIn && activePage === 'upload' && (userRole === 'seller' || userRole === 'admin') && (
      <div className="container py-5 text-start">
        <div className="row justify-content-center">
          <div className="col-md-8 bg-black p-5 border border-secondary rounded-4 shadow-lg">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3 className="fw-bold m-0 text-white" style={{ letterSpacing: '1px' }}>UPLOAD PRODUCT</h3>
              <button className="btn btn-sm btn-outline-light" onClick={() => setActivePage('profile')}>Back to Profile</button>
          </div>
          <hr className="border-secondary mb-4" />

          <form onSubmit={handleProductUpload}>
            <div className="mb-3">
              <label className="form-label text-light fw-semibold">Product Title</label>
              <input type="text" className="form-control bg-dark text-white border-secondary" placeholder="Enter product name..." value={productTitle} onChange={(e) => setProductTitle(e.target.value)} required />
            </div>
            <div className="mb-3">
              <label className="form-label text-light fw-semibold">Price ($)</label>
              <input type="number" className="form-control bg-dark text-white border-secondary" placeholder="Enter price..." value={productPrice} onChange={(e) => setProductPrice(e.target.value)} required />
            </div>
            <div className="mb-3">
              <label className="form-label text-light fw-semibold">Category</label>
              <input type="text" className="form-control bg-dark text-white border-secondary" placeholder="e.g. Luxury, Electronics..." value={productCategory} onChange={(e) => setProductCategory(e.target.value)} required />
            </div>
            <div className="mb-3">
              <label className="form-label text-light fw-semibold">Description</label>
              <textarea className="form-control bg-dark text-white border-secondary" rows="3" placeholder="Enter product description..." value={productDescription} onChange={(e) => setProductDescription(e.target.value)} required></textarea>
            </div>
            <div className="mb-4">
              <label className="form-label text-light fw-semibold">Product Image (Choose File or Enter URL)</label>
              <input type="file" accept="image/*" className="form-control bg-dark text-white border-secondary mb-2" onChange={handleProductFile} />
              <input type="text" className="form-control bg-dark text-white border-secondary" placeholder="Or paste direct image URL here..." value={productImage} onChange={(e) => setProductImage(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-light w-100 rounded-pill fw-bold py-2 text-uppercase">Publish Product Now</button>
          </form>
        </div>
        </div>
      </div>
   )}

    {activePage === 'home' && (
      <>
        <header className="container-fluid text-center py-5" style={{ minHeight: '55vh', display:'flex', flexDirection:'column', justifyContent:'center', background: 'radial-gradient(circle, #222 0%, #000 100%)' }}>
          <motion.h1 initial={{y: 30, opacity: 0}} animate={{y:0, opacity:1}} transition={{delay: 0.2, duration: 0.5}} className="display-1 fw-bold mb-3 text-white" style={{textTransform: 'uppercase', letterSpacing: '4px'}}>
            JR STORE
          </motion.h1>
          <motion.p initial={{opacity: 0}} animate={{opacity: 0.9}} transition={{delay: 0.4, duration: 0.5}} className="lead fs-3 text-light">Explore exclusive products and connect directly with sellers.</motion.p>
          <motion.div initial={{scale: 0.9, opacity: 0}} animate={{scale: 1, opacity:1}} transition={{delay: 0.6, duration: 0.4}}>
            <button className="btn btn-light btn-lg mt-4 px-5 py-3 rounded-pill fw-bold text-uppercase" onClick={() => window.scrollTo({ top: 500, behavior: 'smooth' })}>Browse Collection</button>
          </motion.div>
        </header>

        <div className="container py-5">
          {searchQuery && (
            <div className="mb-5 text-start text-white">
              <h4 className="border-bottom border-secondary pb-2">Search Results for: "{searchQuery}"</h4>
              
              {(searchType === 'all' || searchType === 'profile') && (
                <div className="my-4">
                  <h6 className="text-light text-uppercase mb-3" style={{ opacity: 0.8 }}>Matched Profiles</h6>
                  <div className="row g-3">
                    {profilesList.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
                      profilesList.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map((prof, idx) => (
                        <div className="col-md-4" key={idx}>
                          <div className="bg-black p-3 border border-secondary rounded-3 d-flex align-items-center justify-content-between">
                            <div className="d-flex align-items-center gap-3" style={{ cursor: 'pointer' }} onClick={() => setSelectedProfileModalUser(prof)}>
                              <img src={prof.photo || presetAvatars[0]} alt="Profile" style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover' }} />
                              <div>
                                <h5 className="mb-1 text-white d-flex align-items-center">
                                  {prof.name} {prof.role === 'admin' && <FacebookBlueTick />}
                                </h5>
                                <span className="badge bg-secondary text-uppercase">{prof.role}</span>
                              </div>
                            </div>
                            <div className="d-flex gap-2">
                              <button className="btn btn-sm btn-outline-light rounded-pill px-2" onClick={() => setSelectedProfileModalUser(prof)}>View</button>
                              {isLoggedIn && prof.email !== userInfo?.email && (
                                <button className="btn btn-sm btn-warning rounded-pill px-3 fw-bold text-dark" onClick={() => {
                                  setChatTargetUser(prof);
                                  setActivePage('messenger');
                                }}>Chat</button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-light small" style={{ opacity: 0.7 }}>No profiles found matching query.</p>
                    )}
                  </div>
                </div>
              )}

              {(searchType === 'all' || searchType === 'product') && (
                <div className="my-4">
                  <h6 className="text-light text-uppercase mb-3" style={{ opacity: 0.8 }}>Matched Products</h6>
                  <div className="row g-4">
                    {allProductsList.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
                      allProductsList.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase())).map((prod) => (
                        <div className="col-md-4" key={prod.id}>
                          <div className="card h-100 bg-black border border-secondary rounded-0 p-3">
                            <div className="bg-dark d-flex align-items-center justify-content-center" style={{ height: '200px', overflow: 'hidden' }}>
                              {prod.image ? <img src={prod.image} alt="Prod" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'No Image'}
                            </div>
                            <div className="card-body text-center">
                              <h5 className="card-title fw-bold text-uppercase text-white mt-2">{prod.title}</h5>
                              <p className="text-light mb-3">${prod.price}</p>
                              <button className="btn btn-outline-warning w-100 rounded-0 text-uppercase" onClick={() => {
                                if(!isLoggedIn) setShowLoginModal(true);
                                else {
                                  const sellerProf = profilesList.find(p => p.name === prod.seller) || profilesList[0];
                                  setChatTargetUser(sellerProf);
                                  setActivePage('messenger');
                                }
                              }}>Discuss Product</button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-light small" style={{ opacity: 0.7 }}>No products found matching query.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="row g-4">
            {allProductsList.map((prod) => (
              <div className="col-md-4" key={prod.id}>
                <motion.div initial={{y: 30, opacity: 0}} whileInView={{y: 0, opacity: 1}} viewport={{once: true}} transition={{duration: 0.4}} className="card h-100 bg-black border border-secondary rounded-0 p-3">
                  <div className="bg-dark d-flex align-items-center justify-content-center" style={{ height: '280px', overflow: 'hidden' }}>
                    {prod.image ? <img src={prod.image} alt="Prod" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'Image'}
                  </div>
                  <div className="card-body text-center">
                    <h5 className="card-title fw-bold text-uppercase text-white mt-2" style={{letterSpacing: '1px'}}>{prod.title}</h5>
                    <p className="text-light small mb-2">Seller: <span className="text-warning fw-semibold">{prod.seller || 'Admin'}</span></p>
                    <p className="text-white fw-bold fs-5 mb-4">${prod.price}</p>
                    <button className="btn btn-outline-warning w-100 rounded-0 text-uppercase" style={{letterSpacing: '1px'}} onClick={() => {
                      if(!isLoggedIn) {
                        setShowLoginModal(true);
                      } else {
                        const sellerProf = profilesList.find(p => p.name === prod.seller) || profilesList[0];
                        setChatTargetUser(sellerProf);
                        setActivePage('messenger');
                      }
                    }}>Discuss Product</button>
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
  logoWrapper: { position: 'relative', width: '120px', height: '120px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '30px' },
  logoGlow: { position: 'absolute', width: '100%', height: '100%', background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(15px)' },
  logoText: { fontSize: '55px', fontWeight: '200', color: '#fff', letterSpacing: '2px', position: 'relative', zIndex: 1 },
  title: { fontSize: '36px', fontWeight: '300', color: '#fff', textTransform: 'uppercase', letterSpacing: '6px', margin: '0 0 10px 0' },
  subtitle: { fontSize: '16px', color: '#fff', fontWeight: '200', letterSpacing: '3px', opacity: 0.8, marginBottom: '50px' },
  progressBar: { height: '1px', background: 'linear-gradient(90deg, transparent, #fff, transparent)', position: 'absolute', bottom: '15%', width: '0%', left: 0 }
};

export default App;
