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
  
  const defaultSuperAdmin = { 
    name: 'Admin User', 
    role: 'admin', 
    email: 'admin@store.com', 
    phone: '01700000000', 
    photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    isVerified: true 
  };
  const [profilesList, setProfilesList] = useState([defaultSuperAdmin]);
  const [allProductsList, setAllProductsList] = useState([
    { id: 1, title: 'Wireless Premium Headphones', price: '99.00', category: 'Electronics', seller: 'Admin User', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300' },
    { id: 2, title: 'Smart Fitness Watch', price: '149.00', category: 'Accessories', seller: 'Admin User', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300' }
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
  const VerifiedBadge = () => (
    <span 
      title="Verified User" 
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '16px',
        height: '16px',
        backgroundColor: '#0d6efd',
        borderRadius: '50%',
        color: '#fff',
        fontSize: '9px',
        fontWeight: '900',
        marginLeft: '6px',
        verticalAlign: 'middle'
      }}
    >
      ✓
    </span>
  );
  const EmailBadge = ({ email }) => {
    const isOriginal = email === 'admin@store.com' || email.includes('admin');
    return (
      <span className={`badge ${isOriginal ? 'bg-primary text-white' : 'bg-secondary text-light'} ms-2`} style={{ fontSize: '10px' }}>
        {isOriginal ? 'Admin Core' : 'User'}
      </span>
    );
  };
  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 1500);
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('userInfo');
    const storedRole = localStorage.getItem('userRole');
    const savedProfiles = localStorage.getItem('profilesList');
    const savedMessages = localStorage.getItem('directMessages');
    const savedProducts = localStorage.getItem('allProductsList');
    const savedAdminMsgs = localStorage.getItem('adminMessages');
    if (savedProfiles) { 
      try { 
        const parsedProfiles = JSON.parse(savedProfiles);
        if (!parsedProfiles.some(p => p.email === 'admin@store.com')) {
          parsedProfiles.unshift(defaultSuperAdmin);
        }
        setProfilesList(parsedProfiles); 
      } catch (e) {} 
    }
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
  useEffect(() => { 
    if (profilesList.length > 0) {
      localStorage.setItem('profilesList', JSON.stringify(profilesList)); 
    }
  }, [profilesList]);
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
      message: 'Are you sure you want to completely delete your account data?',
      type: 'danger',
      onConfirm: () => {
        if (userInfo?.email === 'admin@store.com') {
          showToast("Cannot delete Super Admin account!", "danger");
          setConfirmModal({ show: false, title: '', message: '', onConfirm: null, type: 'danger' });
          return;
        }
        const userEmail = userInfo?.email;
        setAllProductsList(allProductsList.filter(p => p.seller !== userInfo?.name && p.seller !== userEmail));
        const updatedMessages = { ...directMessages };
        Object.keys(updatedMessages).forEach(key => {
          if (key.includes(userEmail)) { delete updatedMessages[key]; }
        });
        setDirectMessages(updatedMessages);
        const updatedProfiles = profilesList.map(p => p.email === userEmail ? { ...p, isDeleted: true, name: `${p.name} (Deleted)` } : p);
        setProfilesList(updatedProfiles);
        localStorage.setItem('profilesList', JSON.stringify(updatedProfiles));
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
      showToast("Please enter current password first!", "danger");
      setIsCurrentPasswordValid(false);
      return;
    }
    if (storedPass && currentPassword !== storedPass) {
      setIsCurrentPasswordValid(false);
      showToast("Incorrect password!", "danger");
      return;
    }
    setIsCurrentPasswordValid(true);
    showToast("Password verified!", "success");
  };
  const handleUpdateProfile = (e) => {
    e.preventDefault();
    if (newPassword && !isCurrentPasswordValid) {
      showToast("Verify current password before updating!", "danger");
      return;
    }
    const updatedUser = { ...userInfo, name: editName, phone: editPhone, photo: editPhoto };
    if (newPassword) { updatedUser.password = newPassword; }
    localStorage.setItem('userInfo', JSON.stringify(updatedUser));
    setUserInfo(updatedUser);
    
    const updatedProfiles = profilesList.map(p => p.email === updatedUser.email ? { ...p, name: editName, phone: editPhone, photo: editPhoto } : p);
    setProfilesList(updatedProfiles);
    localStorage.setItem('profilesList', JSON.stringify(updatedProfiles));
    setCurrentPassword('');
    setNewPassword('');
    setIsCurrentPasswordValid(false);
    showToast("Profile updated successfully!", "success");
    setActivePage('profile');
  };
  const handleDeleteUserByAdmin = (emailToDelete) => {
    if (emailToDelete === 'admin@store.com') {
      showToast("Cannot delete Super Admin!", "danger");
      return;
    }
    const updatedProfiles = profilesList.filter(p => p.email !== emailToDelete);
    setProfilesList(updatedProfiles);
    localStorage.setItem('profilesList', JSON.stringify(updatedProfiles));
    showToast("User deleted by Admin!", "success");
  };
  const handleDeleteProductByAdmin = (productId) => {
    setAllProductsList(allProductsList.filter(p => p.id !== productId));
    showToast("Product deleted by Admin!", "success");
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
    const updatedAdminMsgs = [...adminMessages, newMsgObj];
    setAdminMessages(updatedAdminMsgs);
    localStorage.setItem('adminMessages', JSON.stringify(updatedAdminMsgs));
    setNewAdminMessage('');
    showToast("Message sent to Support!", "success");
  };
  const handleSendDirectMessage = (e) => {
    e.preventDefault();
    if (!newDirectMessage.trim() || !chatTargetUser) return;
    const sortedEmails = [userInfo.email, chatTargetUser.email].sort();
    const chatKey = `${sortedEmails[0]}_${sortedEmails[1]}`;
    const currentMsgs = directMessages[chatKey] || [];
    const newMsgObj = {
      sender: userInfo.name,
      senderEmail: userInfo.email,
      senderPhoto: userInfo.photo || presetAvatars[0],
      text: newDirectMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    const updatedMessagesState = {
      ...directMessages,
      [chatKey]: [...currentMsgs, newMsgObj]
    };
    setDirectMessages(updatedMessagesState);
    localStorage.setItem('directMessages', JSON.stringify(updatedMessagesState));
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
    const updatedProducts = [newProd, ...allProductsList];
    setAllProductsList(updatedProducts);
    localStorage.setItem('allProductsList', JSON.stringify(updatedProducts));
    
    showToast("Product added successfully!", "success");
    setProductTitle(''); setProductPrice(''); setProductCategory(''); setProductDescription(''); setProductImage('');
    setActivePage('home');
  };
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    let updatedProfiles = [...profilesList];
    if (isRegisterMode) {
      const existingUser = updatedProfiles.find(p => p.email.toLowerCase() === cleanEmail && !p.isDeleted);
      if (existingUser) {
        showToast("Email already registered! Please sign in instead.", "danger");
        return;
      }
      if (selectedRole === 'admin' && cleanEmail !== 'admin@store.com') {
        showToast("Admin registration restricted!", "danger");
        return;
      }
    } else {
      const foundUser = updatedProfiles.find(p => p.email.toLowerCase() === cleanEmail);
      if (!foundUser) {
        showToast("Account not found! Please register first.", "danger");
        return;
      }
      if (cleanEmail === 'admin@store.com' && password !== 'admin123') {
        showToast("Incorrect Admin Password!", "danger");
        return;
      }
      if (cleanEmail !== 'admin@store.com' && foundUser.password && foundUser.password !== password) {
        showToast("Incorrect password!", "danger");
        return;
      }
    }
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      showToast(isRegisterMode ? "Registration Successful!" : "Login Successful!", "success");
      localStorage.setItem('token', 'store-user-token');
      
      const role = (cleanEmail === 'admin@store.com') ? 'admin' : (isRegisterMode ? selectedRole : (updatedProfiles.find(p => p.email.toLowerCase() === cleanEmail)?.role || 'customer'));
      const userName = name || (role === 'admin' ? 'Admin User' : (updatedProfiles.find(p => p.email.toLowerCase() === cleanEmail)?.name || cleanEmail.split('@')[0]));
      
      const userData = { 
        name: userName, 
        email: cleanEmail, 
        password, 
        role, 
        phone: updatedProfiles.find(p => p.email.toLowerCase() === cleanEmail)?.phone || '01700000000',
        photo: updatedProfiles.find(p => p.email.toLowerCase() === cleanEmail)?.photo || presetAvatars[0],
        isVerified: true,
        isDeleted: false
      };
      
      if (isRegisterMode) {
        updatedProfiles.push(userData);
        setProfilesList(updatedProfiles);
        localStorage.setItem('profilesList', JSON.stringify(updatedProfiles));
      }
      localStorage.setItem('userInfo', JSON.stringify(userData));
      localStorage.setItem('userRole', role);
      setIsLoggedIn(true);
      setUserInfo(userData);
      setUserRole(role);
      setShowLoginModal(false);
      setName(''); setEmail(''); setPassword('');
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
              exit={{ opacity: 0, scale: 1.05, transition: { duration: 0.5 } }}
              style={splashStyles.content}
            >
              <h1 style={splashStyles.title}>JR STORE</h1>
              <p style={splashStyles.subtitle}>Loading application...</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', color: '#212529', position: 'relative' }}>
      
      {toast.show && (
        <div style={{ position: 'fixed', top: '25px', right: '25px', zIndex: 9999 }}>
          <motion.div 
            initial={{ opacity: 0, y: -20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -20 }}
            className={`alert ${toast.type === 'success' ? 'alert-success' : 'alert-danger'} shadow fw-bold px-4 py-3 rounded d-flex align-items-center gap-2`}
            style={{ minWidth: '280px' }}
          >
            <span>{toast.message}</span>
          </motion.div>
        </div>
      )}
      {confirmModal.show && (
        <div style={modalStyles.overlay}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ ...modalStyles.box, textAlign: 'center' }}>
            <h4 className="fw-bold mb-3">{confirmModal.title}</h4>
            <p className="text-muted mb-4">{confirmModal.message}</p>
            <div className="d-flex justify-content-center gap-3">
              <button className="btn btn-outline-secondary px-4" onClick={() => setConfirmModal({ show: false, title: '', message: '', onConfirm: null, type: 'danger' })}>Cancel</button>
              <button className="btn btn-danger px-4 fw-bold" onClick={confirmModal.onConfirm}>Confirm</button>
            </div>
          </motion.div>
        </div>
      )}
      {selectedProfileModalUser && (
        <div style={modalStyles.overlay}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ ...modalStyles.box, textAlign: 'center', position: 'relative' }}>
            <button className="btn-close position-absolute top-0 end-0 m-3" onClick={() => setSelectedProfileModalUser(null)}></button>
            
            <div className="my-3">
              <img src={selectedProfileModalUser.photo || presetAvatars[0]} alt="Profile" style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #0d6efd' }} />
            </div>
            <h4 className="fw-bold d-flex align-items-center justify-content-center gap-2">
              {selectedProfileModalUser.name}
              {selectedProfileModalUser.role === 'admin' && <VerifiedBadge />}
            </h4>
            <p className="text-muted small mb-1">Email: {selectedProfileModalUser.email}</p>
            <div className="mb-2"><EmailBadge email={selectedProfileModalUser.email} /></div>
            <p className="text-muted small mb-3">Phone: {selectedProfileModalUser.phone || 'N/A'}</p>
            <span className="badge bg-secondary text-uppercase mb-4">{selectedProfileModalUser.isDeleted ? 'Account Deleted' : selectedProfileModalUser.role}</span>
            
            <div className="d-flex justify-content-center gap-2">
              {isLoggedIn && !selectedProfileModalUser.isDeleted && selectedProfileModalUser.email !== userInfo?.email && (
                <button className="btn btn-primary px-4 fw-bold" onClick={() => {
                  const target = selectedProfileModalUser;
                  setSelectedProfileModalUser(null);
                  setChatTargetUser(target);
                  setActivePage('messenger');
                }}>Message</button>
              )}
              <button className="btn btn-outline-secondary px-4" onClick={() => setSelectedProfileModalUser(null)}>Close</button>
            </div>
          </motion.div>
        </div>
      )}
      {/* Navbar */}
      <nav className="navbar navbar-expand-lg navbar-light bg-white p-3 shadow-sm sticky-top">
        <div className="container">
          <a className="navbar-brand fw-bold fs-4 text-primary" href="#home" onClick={(e) => { e.preventDefault(); setActivePage('home'); setSearchQuery(''); }}>
            JR STORE
          </a>
          
          <div className="d-none d-md-flex mx-auto align-items-center gap-2" style={{ width: '450px' }}>
            <select 
              className="form-select text-center" 
              style={{ width: '130px', fontSize: '13px' }}
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
            >
              <option value="all">All</option>
              <option value="product">Products</option>
              <option value="profile">Users</option>
            </select>
            <div className="position-relative flex-grow-1">
              <input 
                type="text" 
                className="form-control px-3" 
                placeholder={searchType === 'profile' ? "Search user..." : searchType === 'product' ? "Search product..." : "Search..."}
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
              <li className="nav-item"><a className="nav-link" href="#home" onClick={(e) => { e.preventDefault(); setActivePage('home'); setSearchQuery(''); }}>Home</a></li>
              
              {isLoggedIn && userRole === 'admin' && (
                <li className="nav-item">
                  <a className="nav-link text-primary fw-bold" href="#admin-dashboard" onClick={(e) => { e.preventDefault(); setActivePage('admin-dashboard'); }}>
                    Admin Dashboard
                  </a>
                </li>
              )}
              {isLoggedIn && (
                <li className="nav-item">
                  <a className="nav-link fw-semibold" href="#messenger" onClick={(e) => { 
                    e.preventDefault(); 
                    const otherProfile = profilesList.find(p => p.email !== userInfo?.email && !p.isDeleted) || profilesList[0];
                    setChatTargetUser(otherProfile);
                    setActivePage('messenger'); 
                  }}>
                    Messages
                  </a>
                </li>
              )}
              <li className="nav-item mt-2 mt-lg-0">
                {isLoggedIn ? (
                  <div className="dropdown ms-lg-3">
                    <button className="btn btn-outline-primary dropdown-toggle d-flex align-items-center gap-2" type="button" data-bs-toggle="dropdown">
                      {userInfo?.photo ? (
                        <img src={userInfo.photo} alt="Profile" style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : null}
                      <span>{userInfo?.name || 'My Profile'}</span>
                    </button>
                    <ul className="dropdown-menu dropdown-menu-end shadow">
                      <li><button className="dropdown-item" onClick={() => setActivePage('profile')}>Profile</button></li>
                      {userRole === 'admin' && (
                        <li><button className="dropdown-item text-primary fw-bold" onClick={() => setActivePage('admin-dashboard')}>Admin Dashboard</button></li>
                      )}
                      {(userRole === 'seller' || userRole === 'admin') && (
                        <li><button className="dropdown-item" onClick={() => setActivePage('upload')}>Add Product</button></li>
                      )}
                      <li><button className="dropdown-item" onClick={() => {
                        const otherProfile = profilesList.find(p => p.email !== userInfo?.email && !p.isDeleted) || profilesList[0];
                        setChatTargetUser(otherProfile);
                        setActivePage('messenger');
                      }}>Messages</button></li>
                      <li><hr className="dropdown-divider" /></li>
                      <li><button className="dropdown-item text-danger" onClick={handleLogout}>Logout</button></li>
                    </ul>
                  </div>
                ) : (
                  <button className="btn btn-primary ms-lg-3 px-4 w-100 w-lg-auto fw-bold" onClick={() => { setIsRegisterMode(false); setShowLoginModal(true); }}>
                    Sign In
                  </button>
                )}
              </li>
            </ul>
          </div>
        </div>
      </nav>
      {/* Authentication Modal */}
      {showLoginModal && (
        <div style={modalStyles.overlay}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={modalStyles.box}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3 className="fw-bold m-0">{isRegisterMode ? 'Register' : 'Sign In'}</h3>
              <button className="btn-close" onClick={() => setShowLoginModal(false)}></button>
            </div>
            
            <form onSubmit={handleAuthSubmit}>
              {isRegisterMode && (
                <>
                  <div className="mb-3 text-start">
                    <label className="form-label small fw-semibold">Full Name</label>
                    <input type="text" className="form-control" placeholder="Enter your name" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="mb-3 text-start">
                    <label className="form-label small fw-semibold">Account Role</label>
                    <select className="form-select" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                      <option value="customer">Customer</option>
                      <option value="seller">Seller</option>
                    </select>
                  </div>
                </>
              )}
              <div className="mb-3 text-start">
                <label className="form-label small fw-semibold">Email Address</label>
                <input type="email" className="form-control" placeholder="Enter email address" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="mb-4 text-start">
                <label className="form-label small fw-semibold">Password</label>
                <div className="input-group">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    className="form-control" 
                    placeholder="Enter password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                  />
                  <button 
                    type="button" 
                    className="btn btn-outline-secondary" 
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              
              <button type="submit" className="btn btn-primary w-100 fw-bold py-2 text-uppercase mb-3 d-flex justify-content-center align-items-center gap-2" disabled={isLoading}>
                {isLoading && <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>}
                {isLoading ? 'Processing...' : (isRegisterMode ? 'Register' : 'Sign In')}
              </button>
              <div className="text-center">
                <p className="small mb-0 text-muted">
                  {isRegisterMode ? "Already have an account?" : "Don't have an account?"}{" "}
                  <span style={{ color: '#0d6efd', cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' }} onClick={() => setIsRegisterMode(!isRegisterMode)}>
                    {isRegisterMode ? "Sign In" : "Register"}
                  </span>
                </p>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {/* Admin Dashboard */}
      {isLoggedIn && userRole === 'admin' && activePage === 'admin-dashboard' && (
        <div className="container py-5 text-start">
          <div className="bg-white p-4 border rounded shadow-sm mb-5">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div>
                <h2 className="fw-bold text-primary m-0 d-flex align-items-center gap-2">
                  Admin Dashboard
                  <VerifiedBadge />
                </h2>
                <p className="text-muted small mb-0">Manage users, products, and support messages.</p>
              </div>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setActivePage('profile')}>Back to Profile</button>
            </div>
            <div className="row g-4 mb-5">
              <div className="col-md-4">
                <div className="bg-light p-3 rounded border text-center">
                  <h6 className="text-muted text-uppercase small">Total Users</h6>
                  <h2 className="fw-bold">{profilesList.length}</h2>
                </div>
              </div>
              <div className="col-md-4">
                <div className="bg-light p-3 rounded border text-center">
                  <h6 className="text-muted text-uppercase small">Total Products</h6>
                  <h2 className="fw-bold">{allProductsList.length}</h2>
                </div>
              </div>
              <div className="col-md-4">
                <div className="bg-light p-3 rounded border text-center">
                  <h6 className="text-muted text-uppercase small">Support Messages</h6>
                  <h2 className="fw-bold text-primary">{adminMessages.length}</h2>
                </div>
              </div>
            </div>
            <h4 className="mb-3">Support Inquiries</h4>
            <div className="bg-light p-3 rounded mb-5 overflow-auto shadow-sm" style={{ height: '280px' }}>
              {adminMessages.length === 0 ? (
                <p className="text-muted text-center mt-5 small">No support inquiries found.</p>
              ) : (
                adminMessages.map((msg, index) => (
                  <div key={index} className="mb-3 p-3 rounded bg-white border shadow-sm" style={{ maxWidth: '85%' }}>
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <div className="d-flex align-items-center gap-2">
                        <img src={msg.senderPhoto || presetAvatars[0]} alt="Sender" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                        <span className="fw-bold text-primary">{msg.sender}</span>
                        <span className="small text-muted">({msg.senderEmail})</span>
                      </div>
                      <span className="text-muted small">{msg.time}</span>
                    </div>
                    <p className="mb-0 text-dark" style={{ fontSize: '14px' }}>{msg.text}</p>
                  </div>
                ))
              )}
            </div>
            <h4 className="mb-3">User Registry</h4>
            <div className="table-responsive mb-5">
              <table className="table table-striped border align-middle">
                <thead>
                  <tr className="table-light">
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {profilesList.map((prof, idx) => (
                    <tr key={idx}>
                      <td className="d-flex align-items-center gap-2" style={{ cursor: 'pointer' }} onClick={() => setSelectedProfileModalUser(prof)}>
                        <img src={prof.photo || presetAvatars[0]} alt="Avatar" style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }} />
                        <span className="text-decoration-underline fw-bold">{prof.name}</span>
                        {prof.role === 'admin' && <VerifiedBadge />}
                      </td>
                      <td>
                        <span>{prof.email}</span>
                        <EmailBadge email={prof.email} />
                      </td>
                      <td>
                        <span className={`badge ${prof.isDeleted ? 'bg-danger' : 'bg-secondary'} text-uppercase`}>
                          {prof.isDeleted ? 'Deleted' : prof.role}
                        </span>
                      </td>
                      <td>
                        {prof.email !== 'admin@store.com' && (
                          <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteUserByAdmin(prof.email)}>Delete</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h4 className="mb-3">Product Catalog</h4>
            <div className="table-responsive">
              <table className="table table-striped border align-middle">
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
                      <td className="fw-bold">{prod.title}</td>
                      <td>{prod.category}</td>
                      <td>${prod.price}</td>
                      <td>{prod.seller || 'Admin'}</td>
                      <td>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteProductByAdmin(prod.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* Messages Hub */}
      {isLoggedIn && activePage === 'messenger' && (
        <div className="container py-5">
          <div className="row justify-content-center">
            <div className="col-md-10 bg-white p-4 border rounded shadow-sm text-start">
              
              <div className="d-flex align-items-center justify-content-between mb-4 pb-3 border-bottom">
                <div>
                  <h3 className="fw-bold m-0 fs-2">Messages</h3>
                  <p className="text-muted small mb-0">Secure chats with other users.</p>
                </div>
                <button className="btn btn-sm btn-outline-secondary px-3" onClick={() => setActivePage('profile')}>Back</button>
              </div>
              <div className="row">
                <div className="col-md-4 border-end pe-3">
                  <h6 className="text-muted mb-3 fw-bold small text-uppercase">Users:</h6>
                  <div className="d-flex flex-column gap-2" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    {profilesList.filter(p => p.email !== userInfo?.email && !p.isDeleted).map((prof, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => setChatTargetUser(prof)}
                        className={`p-2 rounded d-flex align-items-center gap-2 ${chatTargetUser?.email === prof.email ? 'bg-primary text-white fw-bold' : 'bg-light text-dark border'}`}
                        style={{ cursor: 'pointer' }}
                      >
                        <img src={prof.photo || presetAvatars[0]} alt="Avatar" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                        <div>
                          <div style={{ fontSize: '14px' }} className="d-flex align-items-center">
                            {prof.name} {prof.role === 'admin' && <VerifiedBadge />}
                          </div>
                          <span style={{ fontSize: '10px' }} className="text-uppercase opacity-75">{prof.role}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {userRole !== 'admin' && (
                    <div className="mt-4 pt-3 border-top">
                      <h6 className="text-primary mb-2 fw-bold small" style={{ fontSize: '12px' }}>Send Support Message:</h6>
                      <form onSubmit={handleSendAdminMessage}>
                        <input 
                          type="text" 
                          className="form-control form-control-sm mb-2" 
                          placeholder="Type message to support..." 
                          value={newAdminMessage}
                          onChange={(e) => setNewAdminMessage(e.target.value)}
                          required
                        />
                        <button type="submit" className="btn btn-sm btn-primary w-100 fw-bold">Send Message</button>
                      </form>
                    </div>
                  )}
                </div>
                <div className="col-md-8 ps-3 d-flex flex-column justify-content-between">
                  {chatTargetUser ? (
                    <>
                      <div className="d-flex align-items-center gap-2 border-bottom pb-2 mb-3" style={{ cursor: 'pointer' }} onClick={() => setSelectedProfileModalUser(chatTargetUser)}>
                        <img src={chatTargetUser.photo || presetAvatars[0]} alt="Target" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                        <h5 className="m-0 d-flex align-items-center gap-1" style={{ fontSize: '16px' }}>
                          {chatTargetUser.name} {chatTargetUser.role === 'admin' && <VerifiedBadge />} 
                          <span className="badge bg-secondary fs-6 text-uppercase ms-2">{chatTargetUser.role}</span>
                        </h5>
                        <small className="text-primary ms-auto">View Profile</small>
                      </div>
                      <div className="bg-light p-3 rounded mb-3 overflow-auto border" style={{ height: '270px' }}>
                        {(() => {
                          const sortedEmails = [userInfo.email, chatTargetUser.email].sort();
                          const chatKey = `${sortedEmails[0]}_${sortedEmails[1]}`;
                          const currentMsgs = directMessages[chatKey] || [];
                          if (currentMsgs.length === 0) {
                            return <p className="text-muted text-center mt-5 small">No messages yet with {chatTargetUser.name}. Send the first message below!</p>;
                          }
                          return currentMsgs.map((msg, idx) => (
                            <div key={idx} className={`mb-3 p-2 rounded ${msg.senderEmail === userInfo.email ? 'ms-auto bg-primary text-white fw-semibold' : 'bg-white border text-dark'}`} style={{ maxWidth: '75%' }}>
                              <div className="d-flex justify-content-between small fw-bold mb-1" style={{ fontSize: '11px', opacity: 0.8 }}>
                                <span>{msg.sender}</span>
                                <span>{msg.time}</span>
                              </div>
                              <p className="mb-0" style={{ fontSize: '14px' }}>{msg.text}</p>
                            </div>
                          ));
                        })()}
                      </div>
                      <form onSubmit={handleSendDirectMessage} className="input-group">
                        <input 
                          type="text" 
                          className="form-control py-2" 
                          placeholder={`Message ${chatTargetUser.name}...`} 
                          value={newDirectMessage}
                          onChange={(e) => setNewDirectMessage(e.target.value)}
                          required
                        />
                        <button type="submit" className="btn btn-primary px-4 fw-bold">Send</button>
                      </form>
                    </>
                  ) : (
                    <div className="text-center text-muted my-auto">Select a user to start messaging.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* User Profile */}
      {isLoggedIn && activePage === 'profile' && (
        <div className="container py-5 text-start">
          <div className="row justify-content-center">
            <div className="col-md-8 bg-white p-5 border rounded shadow-sm">
              <div className="d-flex align-items-center mb-4 gap-4">
                <div style={{ position: 'relative', width: '90px', height: '90px' }}>
                  <div style={{ width: '100%', height: '100%', borderRadius: '50%', backgroundColor: '#eee', overflow: 'hidden', border: '2px solid #0d6efd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {userInfo?.photo ? (
                      <img src={userInfo.photo} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span className="fs-1 text-secondary">{userInfo?.name?.charAt(0) || 'U'}</span>
                    )}
                  </div>
                  <span title="Online" style={{
                    position: 'absolute', bottom: '5px', right: '5px', width: '14px', height: '14px',
                    backgroundColor: '#198754', borderRadius: '50%', border: '2px solid #fff'
                  }}></span>
                </div>
                <div>
                  <h2 className="fw-bold mb-1 d-flex align-items-center gap-2">
                    {userInfo?.name}
                    {userRole === 'admin' && <VerifiedBadge />}
                    <span style={{ fontSize: '11px', padding: '3px 10px', backgroundColor: '#d1e7dd', color: '#0f5132', borderRadius: '4px' }}>
                      Active
                    </span>
                  </h2>
                  <p className="text-muted mb-1 small">{userInfo?.email}</p>
                  <div className="mb-2"><EmailBadge email={userInfo?.email} /></div>
                  <span className={`badge ${userRole === 'admin' ? 'bg-primary' : 'bg-secondary'} text-uppercase mt-1`}>{userRole}</span>
                </div>
              </div>
            <hr className="border-secondary mb-4 opacity-25" />
             
            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <p className="text-muted fw-semibold mb-1 small">Phone Number</p>
                <h5 className="text-dark">{userInfo?.phone || 'Not provided'}</h5>
              </div>
              <div className="col-md-6">
                <p className="text-muted fw-semibold mb-1 small">Account Status</p>
                <h5 className="text-success">Verified & Secure</h5>
              </div>
            </div>
             
            <div className="d-flex flex-wrap gap-3 align-items-center">
              <button className="btn btn-outline-secondary px-4 fw-bold" onClick={() => { setEditName(userInfo?.name || ''); setActivePage('edit-profile'); }}>
                Edit Profile
              </button>
              {userRole === 'admin' && (
                <button className="btn btn-primary px-4 fw-bold" onClick={() => setActivePage('admin-dashboard')}>
                  Admin Dashboard
                </button>
              )}
              {(userRole === 'seller' || userRole === 'admin') && (
                <button className="btn btn-outline-primary px-4 fw-bold" onClick={() => setActivePage('upload')}>
                  Add Product
                </button>
              )}
              <button className="btn btn-outline-secondary px-3" onClick={() => {
                const otherProfile = profilesList.find(p => p.email !== userInfo?.email && !p.isDeleted) || profilesList[0];
                setChatTargetUser(otherProfile);
                setActivePage('messenger');
              }}>
                Messages
              </button>
              <button className="btn btn-outline-warning px-3" onClick={handleDeactivateAccount}>
                Deactivate
              </button>
              <button className="btn btn-outline-danger px-3" onClick={handleDeleteAccount}>
                Delete
              </button>
              <button className="btn btn-outline-dark px-4 ms-auto" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    {/* Edit Profile */}
    {isLoggedIn && activePage === 'edit-profile' && (
      <div className="container py-5 text-start">
        <div className="row justify-content-center">
          <div className="col-md-8 bg-white p-5 border rounded shadow-sm">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3 className="fw-bold m-0">Edit Profile</h3>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => setActivePage('profile')}>Cancel</button>
          </div>
          <hr className="border-secondary mb-4 opacity-25" />
          <form onSubmit={handleUpdateProfile}>
            <div className="mb-3">
              <label className="form-label small fw-semibold">Full Name</label>
              <input type="text" className="form-control" value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
             
            <div className="mb-3">
              <label className="form-label small fw-semibold">Phone Number</label>
              <input type="text" className="form-control" placeholder="Enter phone number" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            </div>
          <div className="mb-3">
            <label className="form-label small fw-semibold">Profile Picture</label>
            <input type="file" accept="image/*" className="form-control mb-2" onChange={handleImageUploadFromFile} />
            <div className="d-flex gap-3 my-2 flex-wrap align-items-center">
              <span className="text-muted small">Or select preset avatar:</span>
              {presetAvatars.map((url, idx) => (
                <img 
                  key={idx} 
                  src={url} 
                  alt="Avatar Preset" 
                  onClick={() => setEditPhoto(url)} 
                  style={{ width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', border: editPhoto === url ? '2px solid #0d6efd' : '1px solid #ccc', objectFit: 'cover' }} 
                />
              ))}
            </div>
          </div>
          <hr className="my-4" />
          <h5 className="mb-3" style={{ fontSize: '16px' }}>Change Password</h5>
          <div className="mb-3">
            <label className="form-label small fw-semibold">Current Password</label>
            <div className="input-group">
              <input 
                type={showCurrentPassword ? "text" : "password"} 
                className="form-control" 
                placeholder="Enter current password" 
                value={currentPassword} 
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setIsCurrentPasswordValid(false); 
                }} 
              />
              <button 
                type="button" 
                className="btn btn-outline-secondary" 
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                {showCurrentPassword ? "Hide" : "Show"}
              </button>
              <button type="button" className="btn btn-outline-primary" onClick={handleVerifyCurrentPassword}>Verify</button>
            </div>
            {isCurrentPasswordValid && <small className="text-success mt-1 d-block">✓ Password verified successfully!</small>}
          </div>
          <div className="mb-4">
            <label className="form-label small fw-semibold">New Password</label>
            <div className="input-group">
              <input 
                type={showNewPassword ? "text" : "password"} 
                className="form-control" 
                placeholder={isCurrentPasswordValid ? "Enter new password" : "Verify current password first..."} 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                disabled={!isCurrentPasswordValid} 
              />
              <button 
                type="button" 
                className="btn btn-outline-secondary" 
                onClick={() => setShowNewPassword(!showNewPassword)}
                disabled={!isCurrentPasswordValid}
              >
                {showNewPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-primary w-100 fw-bold py-2 text-uppercase">Save Changes</button>
        </form>
      </div>
      </div>
    </div>
   )}
    {/* Add Product */}
    {isLoggedIn && activePage === 'upload' && (userRole === 'seller' || userRole === 'admin') && (
      <div className="container py-5 text-start">
        <div className="row justify-content-center">
          <div className="col-md-8 bg-white p-5 border rounded shadow-sm">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3 className="fw-bold m-0">Add New Product</h3>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => setActivePage('profile')}>Back</button>
          </div>
          <hr className="border-secondary mb-4 opacity-25" />
          <form onSubmit={handleProductUpload}>
            <div className="mb-3">
              <label className="form-label small fw-semibold">Product Title</label>
              <input type="text" className="form-control" placeholder="Enter product name..." value={productTitle} onChange={(e) => setProductTitle(e.target.value)} required />
            </div>
            <div className="mb-3">
              <label className="form-label small fw-semibold">Price ($)</label>
              <input type="number" className="form-control" placeholder="Enter price..." value={productPrice} onChange={(e) => setProductPrice(e.target.value)} required />
            </div>
            <div className="mb-3">
              <label className="form-label small fw-semibold">Category</label>
              <input type="text" className="form-control" placeholder="e.g. Electronics, Accessories..." value={productCategory} onChange={(e) => setProductCategory(e.target.value)} required />
            </div>
            <div className="mb-3">
              <label className="form-label small fw-semibold">Description</label>
              <textarea className="form-control" rows="3" placeholder="Describe the product..." value={productDescription} onChange={(e) => setProductDescription(e.target.value)} required></textarea>
            </div>
            <div className="mb-4">
              <label className="form-label small fw-semibold">Product Image File or URL</label>
              <input type="file" accept="image/*" className="form-control mb-2" onChange={handleProductFile} />
              <input type="text" className="form-control" placeholder="Or paste direct image URL here..." value={productImage} onChange={(e) => setProductImage(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary w-100 fw-bold py-2 text-uppercase">Add Product</button>
          </form>
        </div>
        </div>
      </div>
   )}
    {/* Home / Product Showcase */}
    {activePage === 'home' && (
      <>
        {/* Hero Section */}
        <header className="container-fluid text-center py-5 bg-white border-bottom" style={{ minHeight: '50vh', display:'flex', flexDirection:'column', justifyContent:'center' }}>
          <motion.div initial={{scale: 0.95, opacity: 0}} animate={{scale: 1, opacity: 1}} transition={{duration: 0.4}}>
            <span className="badge bg-primary rounded px-3 py-2 mb-3 text-uppercase fw-bold" style={{ fontSize: '11px' }}>Welcome to JR STORE</span>
          </motion.div>
          <motion.h1 initial={{y: 20, opacity: 0}} animate={{y:0, opacity:1}} transition={{delay: 0.1, duration: 0.4}} className="display-4 fw-bold mb-3 text-dark" style={{ textTransform: 'uppercase' }}>
            Discover Amazing Products
          </motion.h1>
          <motion.p initial={{opacity: 0}} animate={{opacity: 0.8}} transition={{delay: 0.2, duration: 0.4}} className="lead fs-5 text-muted">Find the best quality items at affordable prices.</motion.p>
          <motion.div initial={{scale: 0.9, opacity: 0}} animate={{scale: 1, opacity:1}} transition={{delay: 0.3, duration: 0.3}}>
            <button className="btn btn-outline-primary btn-lg mt-3 px-5 py-2 fw-bold text-uppercase" onClick={() => window.scrollTo({ top: 450, behavior: 'smooth' })}>Shop Now</button>
          </motion.div>
        </header>

        {/* 3D Animation Showcase Section */}
        <div className="container my-5">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            whileInView={{ opacity: 1, y: 0 }} 
            viewport={{ once: true }} 
            transition={{ duration: 0.5 }}
            style={{ width: '100%', height: '450px', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', background: '#fff', border: '1px solid #eaeaea' }}
          >
            <iframe 
              src='https://my.spline.design/cube-10499cf2d5f818b6e6bb23bc7b7fc2f0/' 
              frameBorder='0' 
              width='100%' 
              height='100%'
              title="JR STORE 3D Animation"
            ></iframe>
          </motion.div>
        </div>

        <div className="container py-5">
          {searchQuery && (
            <div className="mb-5 text-start text-dark">
              <h4 className="border-bottom pb-2">Search Results for: "{searchQuery}"</h4>
              
              {(searchType === 'all' || searchType === 'profile') && (
                <div className="my-4">
                  <h6 className="text-muted text-uppercase mb-3 small">Matched Users</h6>
                  <div className="row g-3">
                    {profilesList.filter(p => !p.isDeleted && p.name.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
                      profilesList.filter(p => !p.isDeleted && p.name.toLowerCase().includes(searchQuery.toLowerCase())).map((prof, idx) => (
                        <div className="col-md-4" key={idx}>
                          <div className="bg-white p-3 border rounded d-flex align-items-center justify-content-between shadow-sm">
                            <div className="d-flex align-items-center gap-3" style={{ cursor: 'pointer' }} onClick={() => setSelectedProfileModalUser(prof)}>
                              <img src={prof.photo || presetAvatars[0]} alt="Profile" style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }} />
                              <div>
                                <h5 className="mb-1 d-flex align-items-center fs-6">
                                  {prof.name} {prof.role === 'admin' && <VerifiedBadge />}
                                </h5>
                                <span className="badge bg-secondary text-uppercase" style={{ fontSize: '10px' }}>{prof.role}</span>
                              </div>
                            </div>
                            <div className="d-flex gap-2">
                              <button className="btn btn-sm btn-outline-secondary px-2" onClick={() => setSelectedProfileModalUser(prof)}>View</button>
                              {isLoggedIn && prof.email !== userInfo?.email && (
                                <button className="btn btn-sm btn-primary px-3 fw-bold" onClick={() => {
                                  setChatTargetUser(prof);
                                  setActivePage('messenger');
                                }}>Message</button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted small">No users matched the query.</p>
                    )}
                  </div>
                </div>
              )}
              {(searchType === 'all' || searchType === 'product') && (
                <div className="my-4">
                  <h6 className="text-muted text-uppercase mb-3 small">Matched Products</h6>
                  <div className="row g-4">
                    {allProductsList.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
                      allProductsList.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase())).map((prod) => (
                        <div className="col-md-4" key={prod.id}>
                          <div className="card h-100 bg-white border shadow-sm p-3">
                            <div className="bg-light d-flex align-items-center justify-content-center" style={{ height: '200px', overflow: 'hidden' }}>
                              {prod.image ? <img src={prod.image} alt="Prod" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'No Image'}
                            </div>
                            <div className="card-body text-center">
                              <h5 className="card-title fw-bold text-uppercase mt-2" style={{ fontSize: '16px' }}>{prod.title}</h5>
                              <p className="text-muted mb-3">${prod.price}</p>
                              <button className="btn btn-outline-primary w-100 text-uppercase fw-bold" onClick={() => {
                                if(!isLoggedIn) setShowLoginModal(true);
                                else {
                                  const sellerProf = profilesList.find(p => p.name === prod.seller) || profilesList[0];
                                  setChatTargetUser(sellerProf);
                                  setActivePage('messenger');
                                }
                              }}>View Product</button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted small">No products matched the query.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="row g-4">
            {allProductsList.map((prod) => (
              <div className="col-md-4" key={prod.id}>
                <motion.div initial={{y: 20, opacity: 0}} whileInView={{y: 0, opacity: 1}} viewport={{once: true}} transition={{duration: 0.3}} className="card h-100 bg-white border shadow-sm p-3">
                  <div className="bg-light d-flex align-items-center justify-content-center" style={{ height: '260px', overflow: 'hidden' }}>
                    {prod.image ? <img src={prod.image} alt="Prod" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'Image'}
                  </div>
                  <div className="card-body text-center">
                    <h5 className="card-title fw-bold text-uppercase mt-2" style={{ fontSize: '17px' }}>{prod.title}</h5>
                    <p className="text-muted small mb-2">Seller: <span className="text-primary fw-semibold">{prod.seller || 'Admin'}</span></p>
                    <p className="text-dark fw-bold fs-5 mb-4">${prod.price}</p>
                    <button className="btn btn-outline-primary w-100 text-uppercase fw-bold" onClick={() => {
                      if(!isLoggedIn) {
                        setShowLoginModal(true);
                      } else {
                        const sellerProf = profilesList.find(p => p.name === prod.seller) || profilesList[0];
                        setChatTargetUser(sellerProf);
                        setActivePage('messenger');
                      }
                    }}>View Product</button>
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
  overlay: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 },
  box: { backgroundColor: '#fff', padding: '35px', borderRadius: '8px', width: '90%', maxWidth: '420px', border: '1px solid #ddd', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }
};
const splashStyles = {
  container: { height: '100vh', width: '100vw', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#fff', overflow: 'hidden', position: 'fixed', top: 0, left: 0, zIndex: 1000 },
  content: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: '28px', fontWeight: '700', color: '#212529', textTransform: 'uppercase', marginBottom: '10px' },
  subtitle: { fontSize: '14px', color: '#6c757d' }
};
export default App;
