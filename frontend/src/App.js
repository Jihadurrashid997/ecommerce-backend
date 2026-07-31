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

  // High-Profile Product Modal State
  const [selectedProduct, setSelectedProduct] = useState(null);

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
    name: 'Jihadur Rashid', 
    role: 'admin', 
    email: 'jihadurrashid997@gmail.com', 
    phone: '01700000000', 
    photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    isVerified: true 
  };

  const [profilesList, setProfilesList] = useState([defaultSuperAdmin]);

  const [allProductsList, setAllProductsList] = useState([
    { id: 1, title: 'Samurai Blade Master Edition', price: '999.00', category: 'Luxury', seller: 'Jihadur Rashid', description: 'Forged from the absolute depths of high-performance architecture. Built for absolute precision and dominance.', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500' },
    { id: 2, title: 'Cybernetic Relic Katana', price: '1,499.00', category: 'Accessories', seller: 'Jihadur Rashid', description: 'An elite cyberpunk masterpiece engineered with modular perfection and fluid animation layout.', image: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=500' }
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

  const SamuraiBadge = () => (
    <span 
      title="Verified High-Profile Master" 
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '16px',
        height: '16px',
        backgroundColor: '#dc3545',
        borderRadius: '50%',
        color: '#fff',
        fontSize: '9px',
        fontWeight: '900',
        marginLeft: '6px',
        verticalAlign: 'middle',
        boxShadow: '0 0 10px rgba(220, 53, 69, 0.9)'
      }}
    >
      ⚡
    </span>
  );

  const EmailBadge = ({ email }) => {
    const isOriginal = email === 'jihadurrashid997@gmail.com' || email.endsWith('@jrstore.com') || email.includes('admin');
    return (
      <span className={`badge ${isOriginal ? 'bg-danger text-white' : 'bg-dark text-warning'} ms-2`} style={{ fontSize: '10px', border: '1px solid #444' }}>
        {isOriginal ? '⚡ Elite Core' : '⚡ Awakened Entity'}
      </span>
    );
  };

  useEffect(() => {
    const linkEl = document.createElement('link');
    linkEl.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Space+Grotesk:wght@300;400;600&display=swap';
    linkEl.rel = 'stylesheet';
    document.head.appendChild(linkEl);

    const timer = setTimeout(() => setShowWelcome(false), 2400);

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
        if (!parsedProfiles.some(p => p.email === 'jihadurrashid997@gmail.com')) {
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
    showToast("Disconnected from matrix successfully!", "success");
    setTimeout(() => { window.location.reload(); }, 400);
  };

  const handleDeactivateAccount = () => {
    setConfirmModal({
      show: true,
      title: 'Seal Sanctuary',
      message: 'Are you sure you want to temporarily seal your account profile?',
      type: 'warning',
      onConfirm: () => {
        setConfirmModal({ show: false, title: '', message: '', onConfirm: null, type: 'danger' });
        showToast("Account sealed temporarily.", "info");
        handleLogout();
      }
    });
  };

  const handleDeleteAccount = () => {
    setConfirmModal({
      show: true,
      title: 'Obliterate Account',
      message: 'Are you sure you want to completely erase your data? Your profile log will remain sealed in Elite Core.',
      type: 'danger',
      onConfirm: () => {
        if (userInfo?.email === 'jihadurrashid997@gmail.com') {
          showToast("Cannot destroy Supreme Elite Core!", "danger");
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

        const updatedProfiles = profilesList.map(p => p.email === userEmail ? { ...p, isDeleted: true, name: `${p.name} (Obliterated)` } : p);
        setProfilesList(updatedProfiles);
        localStorage.setItem('profilesList', JSON.stringify(updatedProfiles));

        setConfirmModal({ show: false, title: '', message: '', onConfirm: null, type: 'danger' });
        showToast("Account obliterated successfully!", "success");
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
      showToast("Please enter current code first!", "danger");
      setIsCurrentPasswordValid(false);
      return;
    }
    if (storedPass && currentPassword !== storedPass) {
      setIsCurrentPasswordValid(false);
      showToast("Incorrect security code!", "danger");
      return;
    }
    setIsCurrentPasswordValid(true);
    showToast("Security code verified!", "success");
  };

  const handleUpdateProfile = (e) => {
    e.preventDefault();
    if (newPassword && !isCurrentPasswordValid) {
      showToast("Verify current code before updating password!", "danger");
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
    showToast("Profile upgraded successfully!", "success");
    setActivePage('profile');
  };

  const handleDeleteUserByAdmin = (emailToDelete) => {
    if (emailToDelete === 'jihadurrashid997@gmail.com') {
      showToast("Cannot erase Elite Core!", "danger");
      return;
    }
    const updatedProfiles = profilesList.filter(p => p.email !== emailToDelete);
    setProfilesList(updatedProfiles);
    localStorage.setItem('profilesList', JSON.stringify(updatedProfiles));
    showToast("Entity erased by Admin!", "success");
  };

  const handleDeleteProductByAdmin = (productId) => {
    setAllProductsList(allProductsList.filter(p => p.id !== productId));
    showToast("Relic removed by Admin!", "success");
  };

  const handleSendAdminMessage = (e) => {
    e.preventDefault();
    if (!newAdminMessage.trim()) return;

    const newMsgObj = { 
      sender: userInfo?.name || 'Awakened', 
      senderEmail: userInfo?.email || 'user@matrix.com',
      senderPhoto: userInfo?.photo || presetAvatars[0],
      text: newAdminMessage, 
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    };
    const updatedAdminMsgs = [...adminMessages, newMsgObj];
    setAdminMessages(updatedAdminMsgs);
    localStorage.setItem('adminMessages', JSON.stringify(updatedAdminMsgs));
    setNewAdminMessage('');
    showToast("Signal transmitted to Elite Core!", "success");
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
      showToast("Please fill all required relic fields!", "danger");
      return;
    }

    const newProd = {
      id: Date.now(),
      title: productTitle,
      price: productPrice,
      category: productCategory,
      description: productDescription || 'An exclusive high-end crafted master relic.',
      image: productImage || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500',
      seller: userInfo?.name || 'Master'
    };

    const updatedProducts = [newProd, ...allProductsList];
    setAllProductsList(updatedProducts);
    localStorage.setItem('allProductsList', JSON.stringify(updatedProducts));
    
    showToast("Relic forged successfully!", "success");
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
        showToast("This email signature already exists! Sign in instead.", "danger");
        return;
      }
      if (selectedRole === 'admin' && cleanEmail !== 'jihadurrashid997@gmail.com') {
        showToast("Elite Core registration is restricted!", "danger");
        return;
      }
    } else {
      const foundUser = updatedProfiles.find(p => p.email.toLowerCase() === cleanEmail);
      if (!foundUser) {
        showToast("No profile found with this email! Register first.", "danger");
        return;
      }
      if (cleanEmail === 'jihadurrashid997@gmail.com' && password !== '252002051') {
        showToast("Incorrect Admin Code!", "danger");
        return;
      }
      if (cleanEmail !== 'jihadurrashid997@gmail.com' && foundUser.password && foundUser.password !== password) {
        showToast("Incorrect security code!", "danger");
        return;
      }
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      showToast(isRegisterMode ? "Awakening Successful!" : "Access Granted!", "success");
      localStorage.setItem('token', 'jr-high-profile-token-2026');
      
      const role = (cleanEmail === 'jihadurrashid997@gmail.com') ? 'admin' : (isRegisterMode ? selectedRole : (updatedProfiles.find(p => p.email.toLowerCase() === cleanEmail)?.role || 'customer'));
      const userName = name || (role === 'admin' ? 'Jihadur Rashid' : (updatedProfiles.find(p => p.email.toLowerCase() === cleanEmail)?.name || cleanEmail.split('@')[0]));
      
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
              exit={{ opacity: 0, scale: 1.15, filter: "blur(15px)", transition: { duration: 0.8, ease: "easeInOut" }}}
              style={splashStyles.content}
            >
              <motion.div 
                initial={{ scale: 0, rotate: -180, opacity: 0 }} 
                animate={{ scale: 1, rotate: 0, opacity: 1 }} 
                transition={{ delay: 0.2, duration: 0.6, type: "spring", bounce: 0.5 }} 
                style={splashStyles.logoWrapper}
              >
                <div style={splashStyles.logoGlow}></div>
                <span style={splashStyles.logoText}>JR</span>
              </motion.div>
              <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5 }} style={splashStyles.title}>JR STORE</motion.h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.85 }} transition={{ delay: 0.8, duration: 0.5 }} style={splashStyles.subtitle}>High-Profile Architecture & Digital Relics</motion.p>
              <motion.div initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ delay: 0.7, duration: 1.4, ease: "easeInOut" }} style={splashStyles.progressBar} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} style={{ backgroundColor: '#050505', minHeight: '100vh', color: '#f8f9fa', position: 'relative', fontFamily: "'Space Grotesk', sans-serif" }}>
      
      {/* Toast Notification */}
      {toast.show && (
        <div style={{ position: 'fixed', top: '25px', right: '25px', zIndex: 9999 }}>
          <motion.div 
            initial={{ opacity: 0, y: -25, scale: 0.9 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            exit={{ opacity: 0, y: -25 }}
            className="alert shadow-lg fw-bold px-4 py-3 rounded-0 d-flex align-items-center gap-2"
            style={{ minWidth: '280px', border: '1px solid #dc3545', backgroundColor: '#0c0c0c', color: '#fff', boxShadow: '0 0 20px rgba(220,53,69,0.3)' }}
          >
            <span style={{ color: '#dc3545' }}>⚡</span>
            <span>{toast.message}</span>
          </motion.div>
        </div>
      )}

      {/* High-Profile Product Details Modal with Smooth Animation */}
      {selectedProduct && (
        <div style={modalStyles.overlay}>
          <motion.div 
            initial={{ scale: 0.8, opacity: 0, y: 30 }} 
            animate={{ scale: 1, opacity: 1, y: 0 }} 
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            style={{ ...modalStyles.box, maxWidth: '750px', padding: '0', overflow: 'hidden', border: '1px solid #dc3545' }}
          >
            <div className="row g-0">
              <div className="col-md-6 bg-dark d-flex align-items-center justify-content-center p-3" style={{ minHeight: '320px' }}>
                <img src={selectedProduct.image} alt={selectedProduct.title} style={{ width: '100%', height: '100%', objectFit: 'cover', maxHeight: '350px' }} />
              </div>
              <div className="col-md-6 p-4 d-flex flex-column justify-content-between text-start bg-black">
                <div>
                  <button className="btn-close btn-close-white float-end" onClick={() => setSelectedProduct(null)}></button>
                  <span className="badge bg-danger rounded-0 text-uppercase mb-2" style={{ letterSpacing: '2px', fontSize: '10px' }}>{selectedProduct.category}</span>
                  <h3 className="fw-bold text-white mb-2" style={{ fontFamily: "'Cinzel', serif", fontSize: '20px' }}>{selectedProduct.title}</h3>
                  <h4 className="text-danger fw-bold mb-3">${selectedProduct.price}</h4>
                  <p className="text-light small mb-4" style={{ opacity: 0.85, lineHeight: '1.6' }}>{selectedProduct.description}</p>
                  <p className="text-secondary small mb-3">Forgemaster: <span className="text-white fw-semibold">{selectedProduct.seller || 'Master'}</span></p>
                </div>
                
                <div className="d-flex gap-2">
                  <button className="btn btn-danger w-100 rounded-0 fw-bold text-uppercase py-2" style={{ letterSpacing: '1px' }} onClick={() => {
                    const prod = selectedProduct;
                    setSelectedProduct(null);
                    if(!isLoggedIn) {
                      setShowLoginModal(true);
                    } else {
                      const sellerProf = profilesList.find(p => p.name === prod.seller) || profilesList[0];
                      setChatTargetUser(sellerProf);
                      setActivePage('messenger');
                    }
                  }}>Inquire Relic</button>
                  <button className="btn btn-outline-light rounded-0 px-3" onClick={() => setSelectedProduct(null)}>Close</button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div style={modalStyles.overlay}>
          <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ ...modalStyles.box, textAlign: 'center' }}>
            <h4 className="fw-bold text-white mb-3" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '2px' }}>{confirmModal.title}</h4>
            <p className="text-light mb-4" style={{ fontSize: '15px', opacity: 0.85 }}>{confirmModal.message}</p>
            <div className="d-flex justify-content-center gap-3">
              <button className="btn btn-outline-light rounded-0 px-4" onClick={() => setConfirmModal({ show: false, title: '', message: '', onConfirm: null, type: 'danger' })}>ABORT</button>
              <button className="btn btn-danger rounded-0 px-4 fw-bold" onClick={confirmModal.onConfirm}>PROCEED</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Profile Modal Viewer */}
      {selectedProfileModalUser && (
        <div style={modalStyles.overlay}>
          <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ ...modalStyles.box, textAlign: 'center', position: 'relative' }}>
            <button className="btn-close btn-close-white position-absolute top-0 end-0 m-3" onClick={() => setSelectedProfileModalUser(null)}></button>
            
            <div className="my-3">
              <img src={selectedProfileModalUser.photo || presetAvatars[0]} alt="Profile" style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #dc3545', boxShadow: '0 0 15px rgba(220,53,69,0.4)' }} />
            </div>
            <h4 className="fw-bold text-white d-flex align-items-center justify-content-center gap-2" style={{ fontFamily: "'Cinzel', serif" }}>
              {selectedProfileModalUser.name}
              {selectedProfileModalUser.role === 'admin' && <SamuraiBadge />}
            </h4>
            <p className="text-light small mb-1">Email: {selectedProfileModalUser.email}</p>
            <div className="mb-2"><EmailBadge email={selectedProfileModalUser.email} /></div>
            <p className="text-light small mb-3">Phone: {selectedProfileModalUser.phone || 'N/A'}</p>
            <span className="badge bg-secondary text-uppercase mb-4 rounded-0">{selectedProfileModalUser.isDeleted ? 'Entity Obliterated' : selectedProfileModalUser.role}</span>
            
            <div className="d-flex justify-content-center gap-2">
              {isLoggedIn && !selectedProfileModalUser.isDeleted && selectedProfileModalUser.email !== userInfo?.email && (
                <button className="btn btn-danger rounded-0 px-4 fw-bold" onClick={() => {
                  const target = selectedProfileModalUser;
                  setSelectedProfileModalUser(null);
                  setChatTargetUser(target);
                  setActivePage('messenger');
                }}>COMMUNICATE</button>
              )}
              <button className="btn btn-outline-light rounded-0 px-4" onClick={() => setSelectedProfileModalUser(null)}>DISMISS</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* High-End Header / Navbar */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-black p-3 sticky-top border-bottom" style={{ borderColor: '#222 !important' }}>
        <div className="container">
          <a className="navbar-brand fw-bold fs-3 text-white" href="#home" onClick={(e) => { e.preventDefault(); setActivePage('home'); setSearchQuery(''); }} style={{ fontFamily: "'Cinzel', serif", letterSpacing: '4px', cursor: 'pointer' }}>
            <span style={{color:'#dc3545'}}>JR</span> STORE
          </a>
          
          <div className="d-none d-md-flex mx-auto align-items-center gap-2" style={{ width: '480px' }}>
            <select 
              className="form-select bg-black text-white border-secondary rounded-0 text-center" 
              style={{ width: '130px', fontSize: '13px', borderColor: '#333' }}
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
            >
              <option value="all">Search All</option>
              <option value="product">Relics</option>
              <option value="profile">Profiles</option>
            </select>
            <div className="position-relative flex-grow-1">
              <input 
                type="text" 
                className="form-control bg-black text-white border-secondary rounded-0 px-3" 
                style={{ borderColor: '#333' }}
                placeholder={searchType === 'profile' ? "Search profile..." : searchType === 'product' ? "Search relic..." : "Search high-end store..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <button className="navbar-toggler rounded-0" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
            <span className="navbar-toggler-icon"></span>
          </button>
          
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav ms-auto align-items-center py-2 py-lg-0">
              <li className="nav-item"><a className="nav-link text-light" href="#home" onClick={(e) => { e.preventDefault(); setActivePage('home'); setSearchQuery(''); }}>Home</a></li>
              
              {isLoggedIn && userRole === 'admin' && (
                <li className="nav-item">
                  <a className="nav-link text-danger fw-bold" href="#admin-dashboard" onClick={(e) => { e.preventDefault(); setActivePage('admin-dashboard'); }}>
                    ⚡ Elite Core
                  </a>
                </li>
              )}

              {isLoggedIn && (
                <li className="nav-item">
                  <a className="nav-link text-light fw-semibold" href="#messenger" onClick={(e) => { 
                    e.preventDefault(); 
                    const otherProfile = profilesList.find(p => p.email !== userInfo?.email && !p.isDeleted) || profilesList[0];
                    setChatTargetUser(otherProfile);
                    setActivePage('messenger'); 
                  }}>
                    Comms
                  </a>
                </li>
              )}

              <li className="nav-item mt-2 mt-lg-0">
                {isLoggedIn ? (
                  <div className="dropdown ms-lg-3">
                    <button className="btn btn-outline-light rounded-0 px-4 dropdown-toggle d-flex align-items-center gap-2 position-relative" type="button" data-bs-toggle="dropdown" style={{ borderColor: '#444' }}>
                      <span style={{
                        position: 'absolute', top: '6px', left: '10px', width: '8px', height: '8px',
                        backgroundColor: '#dc3545', borderRadius: '50%', boxShadow: '0 0 6px #dc3545'
                      }}></span>
                      
                      {userInfo?.photo ? (
                        <img src={userInfo.photo} alt="Profile" style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover', marginLeft: '6px' }} />
                      ) : null}
                      <span style={{ marginLeft: userInfo?.photo ? '0' : '8px', color: '#fff' }}>{userInfo?.name || 'Sanctuary'}</span>
                    </button>
                    <ul className="dropdown-menu dropdown-menu-dark bg-black rounded-0 border" style={{ borderColor: '#333' }}>
                      <li><button className="dropdown-item text-light" onClick={() => setActivePage('profile')}>My Sanctuary</button></li>
                      {userRole === 'admin' && (
                        <li><button className="dropdown-item text-danger fw-bold" onClick={() => setActivePage('admin-dashboard')}>⚡ Elite Core</button></li>
                      )}
                      {(userRole === 'seller' || userRole === 'admin') && (
                        <li><button className="dropdown-item text-light" onClick={() => setActivePage('upload')}>Forge Relic</button></li>
                      )}
                      <li><button className="dropdown-item text-light" onClick={() => {
                        const otherProfile = profilesList.find(p => p.email !== userInfo?.email && !p.isDeleted) || profilesList[0];
                        setChatTargetUser(otherProfile);
                        setActivePage('messenger');
                      }}>Comms Hub</button></li>
                      <li><hr className="dropdown-divider" style={{ borderColor: '#333' }} /></li>
                      <li><button className="dropdown-item text-danger" onClick={handleLogout}>Disconnect</button></li>
                    </ul>
                  </div>
                ) : (
                  <button className="btn btn-outline-danger ms-lg-3 px-4 rounded-0 w-100 w-lg-auto fw-bold" onClick={() => { setIsRegisterMode(false); setShowLoginModal(true); }}>
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
          <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={modalStyles.box}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3 className="fw-bold m-0 text-white" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '2px' }}>{isRegisterMode ? 'AWAKEN' : 'SIGN IN'}</h3>
              <button className="btn-close btn-close-white" onClick={() => setShowLoginModal(false)}></button>
            </div>
            
            <form onSubmit={handleAuthSubmit}>
              {isRegisterMode && (
                <>
                  <div className="mb-3 text-start">
                    <label className="form-label text-light small fw-semibold">Your Name</label>
                    <input type="text" className="form-control bg-black text-white rounded-0 border-secondary" style={{ borderColor: '#333' }} placeholder="Enter your name" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="mb-3 text-start">
                    <label className="form-label text-light small fw-semibold">Account Role</label>
                    <select className="form-select bg-black text-white rounded-0 border-secondary" style={{ borderColor: '#333' }} value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                      <option value="customer">Seeker Account</option>
                      <option value="seller">Forgemaster Account</option>
                    </select>
                  </div>
                </>
              )}
              <div className="mb-3 text-start">
                <label className="form-label text-light small fw-semibold">Email Address</label>
                <input type="email" className="form-control bg-black text-white rounded-0 border-secondary" style={{ borderColor: '#333' }} placeholder="Enter email address" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="mb-4 text-start">
                <label className="form-label text-light small fw-semibold">Security Cipher</label>
                <div className="input-group">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    className="form-control bg-black text-white rounded-0 border-secondary" 
                    style={{ borderColor: '#333' }}
                    placeholder="Enter cipher" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                  />
                  <button 
                    type="button" 
                    className="btn btn-outline-secondary text-light rounded-0" 
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ borderColor: '#333' }}
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>
              
              <button type="submit" className="btn btn-danger w-100 rounded-0 fw-bold py-2 text-uppercase mb-3 d-flex justify-content-center align-items-center gap-2" style={{ letterSpacing: '2px' }} disabled={isLoading}>
                {isLoading && <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>}
                {isLoading ? 'Processing...' : (isRegisterMode ? 'Complete Awakening' : 'Access Store')}
              </button>

              <div className="text-center">
                <p className="small mb-0 text-light" style={{ opacity: 0.8 }}>
                  {isRegisterMode ? "Already registered?" : "New user?"}{" "}
                  <span style={{ color: '#dc3545', cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' }} onClick={() => setIsRegisterMode(!isRegisterMode)}>
                    {isRegisterMode ? "Sign In" : "Register here"}
                  </span>
                </p>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Elite Core Admin Dashboard */}
      {isLoggedIn && userRole === 'admin' && activePage === 'admin-dashboard' && (
        <div className="container py-5 text-start">
          <div className="bg-black p-4 border border-danger rounded-0 shadow-lg mb-5" style={{ borderColor: '#dc3545 !important' }}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div>
                <h2 className="fw-bold text-danger m-0 d-flex align-items-center gap-2" style={{ fontFamily: "'Cinzel', serif" }}>
                  ⚡ Elite Core Command 
                  <SamuraiBadge />
                </h2>
                <p className="text-light small mb-0">Total high-profile control over system profiles, relics, and communications.</p>
              </div>
              <button className="btn btn-outline-light btn-sm rounded-0" onClick={() => setActivePage('profile')}>Return to Sanctuary</button>
            </div>

            <div className="row g-4 mb-5">
              <div className="col-md-4">
                <div className="bg-dark p-3 rounded-0 border border-secondary text-center" style={{ borderColor: '#333 !important' }}>
                  <h6 className="text-light text-uppercase small">Total Users</h6>
                  <h2 className="text-white fw-bold">{profilesList.length}</h2>
                </div>
              </div>
              <div className="col-md-4">
                <div className="bg-dark p-3 rounded-0 border border-secondary text-center" style={{ borderColor: '#333 !important' }}>
                  <h6 className="text-light text-uppercase small">Total Relics</h6>
                  <h2 className="text-white fw-bold">{allProductsList.length}</h2>
                </div>
              </div>
              <div className="col-md-4">
                <div className="bg-dark p-3 rounded-0 border border-secondary text-center" style={{ borderColor: '#333 !important' }}>
                  <h6 className="text-light text-uppercase small">Core Signals</h6>
                  <h2 className="text-danger fw-bold">{adminMessages.length}</h2>
                </div>
              </div>
            </div>

            <h4 className="text-white mb-3" style={{ fontFamily: "'Cinzel', serif" }}>🛡️ Direct Core Transmissions</h4>
            <div className="bg-dark p-3 rounded-0 mb-5 overflow-auto shadow-inner" style={{ height: '300px', border: '1px solid #333' }}>
              {adminMessages.length === 0 ? (
                <p className="text-light text-center mt-5 small" style={{ opacity: 0.6 }}>No signals received in Elite Core.</p>
              ) : (
                adminMessages.map((msg, index) => (
                  <div key={index} className="mb-3 p-3 rounded-0 bg-black text-white border border-secondary" style={{ maxWidth: '85%', borderColor: '#333 !important' }}>
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <div className="d-flex align-items-center gap-2">
                        <img src={msg.senderPhoto || presetAvatars[0]} alt="Sender" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                        <span className="fw-bold text-danger">{msg.sender}</span>
                        <span className="small text-light opacity-75">({msg.senderEmail})</span>
                      </div>
                      <span className="text-light small" style={{ fontSize: '11px' }}>{msg.time}</span>
                    </div>
                    <p className="mb-0 text-white" style={{ fontSize: '14px' }}>{msg.text}</p>
                  </div>
                ))
              )}
            </div>

            <h4 className="text-white mb-3" style={{ fontFamily: "'Cinzel', serif" }}>👥 User Profiles Registry</h4>
            <div className="table-responsive mb-5">
              <table className="table table-dark table-striped border border-secondary align-middle" style={{ borderColor: '#333 !important' }}>
                <thead>
                  <tr style={{ backgroundColor: '#111' }}>
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
                        <img src={prof.photo || presetAvatars[0]} alt="Avatar" style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }} />
                        <span className="text-decoration-underline fw-bold">{prof.name}</span>
                        {prof.role === 'admin' && <SamuraiBadge />}
                      </td>
                      <td>
                        <span className="text-white small">{prof.email}</span>
                        <EmailBadge email={prof.email} />
                      </td>
                      <td>
                        <span className={`badge ${prof.isDeleted ? 'bg-danger' : 'bg-secondary'} rounded-0 text-uppercase`}>
                          {prof.isDeleted ? 'Obliterated' : prof.role}
                        </span>
                      </td>
                      <td>
                        {prof.email !== 'jihadurrashid997@gmail.com' && (
                          <button className="btn btn-sm btn-outline-danger rounded-0" onClick={() => handleDeleteUserByAdmin(prof.email)}>Erase Entity</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h4 className="text-white mb-3" style={{ fontFamily: "'Cinzel', serif" }}>⚔️ Relic Arsenal Control</h4>
            <div className="table-responsive">
              <table className="table table-dark table-striped border border-secondary align-middle" style={{ borderColor: '#333 !important' }}>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Forgemaster</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allProductsList.map((prod) => (
                    <tr key={prod.id}>
                      <td className="fw-bold text-white">{prod.title}</td>
                      <td className="text-light">{prod.category}</td>
                      <td className="text-light">${prod.price}</td>
                      <td className="text-light">{prod.seller || 'Master'}</td>
                      <td>
                        <button className="btn btn-sm btn-outline-danger rounded-0" onClick={() => handleDeleteProductByAdmin(prod.id)}>Remove Relic</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Comms / Messenger Hub */}
      {isLoggedIn && activePage === 'messenger' && (
        <div className="container py-5">
          <div className="row justify-content-center">
            <div className="col-md-10 bg-black p-4 border border-secondary rounded-0 shadow-lg text-start" style={{ borderColor: '#333 !important' }}>
              
              <div className="d-flex align-items-center justify-content-between mb-4 pb-3 border-bottom" style={{ borderColor: '#333 !important' }}>
                <div className="d-flex align-items-center gap-3">
                  <div className="d-flex align-items-center justify-content-center shadow" style={{
                    width: '56px', height: '56px', borderRadius: '0',
                    background: 'linear-gradient(135deg, #dc3545 0%, #000 100%)',
                    border: '1px solid #dc3545', fontSize: '22px', fontWeight: 'bold'
                  }}>
                    JR
                  </div>
                  <div>
                    <h3 className="fw-bold text-white m-0 fs-2" style={{ fontFamily: "'Cinzel', serif" }}>Comms Hub</h3>
                    <p className="text-light small mb-0" style={{ opacity: 0.7 }}>Secure encrypted channels between verified accounts.</p>
                  </div>
                </div>
                <button className="btn btn-sm btn-outline-light rounded-0 px-3" onClick={() => setActivePage('profile')}>Return</button>
              </div>

              <div className="row">
                <div className="col-md-4 border-end border-secondary pe-3" style={{ borderColor: '#333 !important' }}>
                  <h6 className="text-light mb-3 fw-bold small text-uppercase">Active Entities:</h6>
                  <div className="d-flex flex-column gap-2" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    {profilesList.filter(p => p.email !== userInfo?.email && !p.isDeleted).map((prof, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => setChatTargetUser(prof)}
                        className={`p-2 rounded-0 d-flex align-items-center gap-2 ${chatTargetUser?.email === prof.email ? 'bg-danger text-white fw-bold' : 'bg-dark text-white border border-secondary'}`}
                        style={{ cursor: 'pointer', borderColor: '#333 !important' }}
                      >
                        <img src={prof.photo || presetAvatars[0]} alt="Avatar" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                        <div>
                          <div style={{ fontSize: '14px' }} className="d-flex align-items-center">
                            {prof.name} {prof.role === 'admin' && <SamuraiBadge />}
                          </div>
                          <span style={{ fontSize: '10px' }} className="text-uppercase opacity-75">{prof.role}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {userRole !== 'admin' && (
                    <div className="mt-4 pt-3 border-top" style={{ borderColor: '#333 !important' }}>
                      <h6 className="text-danger mb-2 fw-bold small" style={{ fontSize: '12px' }}>⚡ Transmit Signal to Elite Core:</h6>
                      <form onSubmit={handleSendAdminMessage}>
                        <input 
                          type="text" 
                          className="form-control form-control-sm bg-black text-white rounded-0 border-secondary mb-2" 
                          style={{ borderColor: '#333' }}
                          placeholder="Type signal..." 
                          value={newAdminMessage}
                          onChange={(e) => setNewAdminMessage(e.target.value)}
                          required
                        />
                        <button type="submit" className="btn btn-sm btn-danger w-100 rounded-0 fw-bold">Send Signal</button>
                      </form>
                    </div>
                  )}
                </div>

                <div className="col-md-8 ps-3 d-flex flex-column justify-content-between">
                  {chatTargetUser ? (
                    <>
                      <div className="d-flex align-items-center gap-2 border-bottom border-secondary pb-2 mb-3" style={{ cursor: 'pointer', borderColor: '#333 !important' }} onClick={() => setSelectedProfileModalUser(chatTargetUser)}>
                        <img src={chatTargetUser.photo || presetAvatars[0]} alt="Target" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                        <h5 className="text-white m-0 d-flex align-items-center gap-1" style={{ fontSize: '16px' }}>
                          {chatTargetUser.name} {chatTargetUser.role === 'admin' && <SamuraiBadge />} 
                          <span className="badge bg-secondary rounded-0 fs-6 text-uppercase ms-2">{chatTargetUser.role}</span>
                        </h5>
                        <small className="text-danger ms-auto">View Profile</small>
                      </div>

                      <div className="bg-dark p-3 rounded-0 mb-3 overflow-auto" style={{ height: '270px', border: '1px solid #333' }}>
                        {(() => {
                          const sortedEmails = [userInfo.email, chatTargetUser.email].sort();
                          const chatKey = `${sortedEmails[0]}_${sortedEmails[1]}`;
                          const currentMsgs = directMessages[chatKey] || [];

                          if (currentMsgs.length === 0) {
                            return <p className="text-light text-center mt-5 small" style={{ opacity: 0.5 }}>No messages yet with {chatTargetUser.name}. Send the first message below!</p>;
                          }

                          return currentMsgs.map((msg, idx) => (
                            <div key={idx} className={`mb-3 p-2 rounded-0 ${msg.senderEmail === userInfo.email ? 'ms-auto bg-danger text-white fw-semibold' : 'bg-secondary text-white'}`} style={{ maxWidth: '75%' }}>
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
                          className="form-control bg-black text-white rounded-0 border-secondary py-2" 
                          style={{ borderColor: '#333' }}
                          placeholder={`Message ${chatTargetUser.name}...`} 
                          value={newDirectMessage}
                          onChange={(e) => setNewDirectMessage(e.target.value)}
                          required
                        />
                        <button type="submit" className="btn btn-danger rounded-0 px-4 fw-bold">Send</button>
                      </form>
                    </>
                  ) : (
                    <div className="text-center text-light my-auto" style={{ opacity: 0.5 }}>Select a user from the list to start communicating.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Sanctuary */}
      {isLoggedIn && activePage === 'profile' && (
        <div className="container py-5 text-start">
          <div className="row justify-content-center">
            <div className="col-md-8 bg-black p-5 border border-secondary rounded-0 shadow-lg" style={{ borderColor: '#333 !important' }}>
              <div className="d-flex align-items-center mb-4 gap-4">
                <div style={{ position: 'relative', width: '90px', height: '90px' }}>
                  <div style={{ width: '100%', height: '100%', borderRadius: '50%', backgroundColor: '#111', overflow: 'hidden', border: '2px solid #dc3545', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 12px rgba(220,53,69,0.3)' }}>
                    {userInfo?.photo ? (
                      <img src={userInfo.photo} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span className="fs-1 text-light">{userInfo?.name?.charAt(0) || 'S'}</span>
                    )}
                  </div>
                  <span title="Online" style={{
                    position: 'absolute', bottom: '5px', right: '5px', width: '14px', height: '14px',
                    backgroundColor: '#dc3545', borderRadius: '50%', border: '2px solid #000', boxShadow: '0 0 6px #dc3545'
                  }}></span>
                </div>
                <div>
                  <h2 className="fw-bold mb-1 text-white d-flex align-items-center gap-2" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '1px' }}>
                    {userInfo?.name}
                    {userRole === 'admin' && <SamuraiBadge />}
                    <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '0', backgroundColor: 'rgba(220, 53, 69, 0.15)', color: '#dc3545', border: '1px solid #dc3545' }}>
                      ● Online
                    </span>
                  </h2>
                  <p className="text-light mb-1 small">{userInfo?.email}</p>
                  <div className="mb-2"><EmailBadge email={userInfo?.email} /></div>
                  <span className={`badge ${userRole === 'admin' ? 'bg-danger' : 'bg-secondary'} rounded-0 text-uppercase mt-1`}>{userRole}</span>
                </div>
              </div>

            <hr className="border-secondary mb-4" style={{ borderColor: '#333 !important' }} />
             
            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <p className="text-light fw-semibold mb-1 small" style={{ opacity: 0.7 }}>Phone Number</p>
                <h5 className="text-white">{userInfo?.phone || 'Not Provided'}</h5>
              </div>
              <div className="col-md-6">
                <p className="text-light fw-semibold mb-1 small" style={{ opacity: 0.7 }}>Account Status</p>
                <h5 className="text-danger">Secured & Active</h5>
              </div>
            </div>
             
            <div className="d-flex flex-wrap gap-3 align-items-center">
              <button className="btn btn-outline-light rounded-0 px-4 fw-bold" onClick={() => { setEditName(userInfo?.name || ''); setActivePage('edit-profile'); }} style={{ borderColor: '#444' }}>
                Edit Profile
              </button>
              {userRole === 'admin' && (
                <button className="btn btn-danger rounded-0 px-4 fw-bold" onClick={() => setActivePage('admin-dashboard')}>
                  ⚡ Elite Core
                </button>
              )}
              {(userRole === 'seller' || userRole === 'admin') && (
                <button className="btn btn-outline-danger rounded-0 px-4 fw-bold" onClick={() => setActivePage('upload')}>
                  ⚔️ Forge New Relic
                </button>
              )}
              <button className="btn btn-outline-light rounded-0 px-3" onClick={() => {
                const otherProfile = profilesList.find(p => p.email !== userInfo?.email && !p.isDeleted) || profilesList[0];
                setChatTargetUser(otherProfile);
                setActivePage('messenger');
              }} style={{ borderColor: '#444' }}>
                Comms
              </button>
              <button className="btn btn-outline-warning rounded-0 px-3" onClick={handleDeactivateAccount}>
                Seal
              </button>
              <button className="btn btn-outline-danger rounded-0 px-3" onClick={handleDeleteAccount}>
                Obliterate
              </button>
              <button className="btn btn-outline-secondary rounded-0 px-4 ms-auto" onClick={handleLogout} style={{ borderColor: '#444' }}>
                Disconnect
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
          <div className="col-md-8 bg-black p-5 border border-secondary rounded-0 shadow-lg" style={{ borderColor: '#333 !important' }}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3 className="fw-bold m-0 text-white" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '1px' }}>EDIT PROFILE</h3>
              <button className="btn btn-sm btn-outline-light rounded-0" onClick={() => setActivePage('profile')}>Cancel</button>
          </div>
          <hr className="border-secondary mb-4" style={{ borderColor: '#333 !important' }} />

          <form onSubmit={handleUpdateProfile}>
            <div className="mb-3">
              <label className="form-label text-light small fw-semibold">Name</label>
              <input type="text" className="form-control bg-black text-white rounded-0 border-secondary" style={{ borderColor: '#333' }} value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
             
            <div className="mb-3">
              <label className="form-label text-light small fw-semibold">Phone Number</label>
              <input type="text" className="form-control bg-black text-white rounded-0 border-secondary" style={{ borderColor: '#333' }} placeholder="Enter phone number" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            </div>

          <div className="mb-3">
            <label className="form-label text-light small fw-semibold">Avatar Image</label>
            <input type="file" accept="image/*" className="form-control bg-black text-white rounded-0 border-secondary mb-2" style={{ borderColor: '#333' }} onChange={handleImageUploadFromFile} />
            <div className="d-flex gap-3 my-2 flex-wrap align-items-center">
              <span className="text-light small" style={{ opacity: 0.7 }}>Or choose preset avatar:</span>
              {presetAvatars.map((url, idx) => (
                <img 
                  key={idx} 
                  src={url} 
                  alt="Avatar Preset" 
                  onClick={() => setEditPhoto(url)} 
                  style={{ width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', border: editPhoto === url ? '2px solid #dc3545' : '1px solid #444', objectFit: 'cover' }} 
                />
              ))}
            </div>
          </div>

          <hr className="border-secondary my-4" style={{ borderColor: '#333 !important' }} />
          <h5 className="text-white mb-3" style={{ fontFamily: "'Cinzel', serif", fontSize: '16px' }}>Security Cipher Update</h5>

          <div className="mb-3">
            <label className="form-label text-light small fw-semibold">Current Cipher</label>
            <div className="input-group">
              <input 
                type={showCurrentPassword ? "text" : "password"} 
                className="form-control bg-black text-white rounded-0 border-secondary" 
                style={{ borderColor: '#333' }}
                placeholder="Enter current cipher" 
                value={currentPassword} 
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setIsCurrentPasswordValid(false); 
                }} 
              />
              <button 
                type="button" 
                className="btn btn-outline-secondary text-light rounded-0" 
                style={{ borderColor: '#333' }}
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                {showCurrentPassword ? "🙈" : "👁️"}
              </button>
              <button type="button" className="btn btn-outline-light rounded-0" onClick={handleVerifyCurrentPassword} style={{ borderColor: '#444' }}>Verify</button>
            </div>
            {isCurrentPasswordValid && <small className="text-danger mt-1 d-block">✓ Cipher verified successfully!</small>}
          </div>

          <div className="mb-4">
            <label className="form-label text-light small fw-semibold">New Cipher</label>
            <div className="input-group">
              <input 
                type={showNewPassword ? "text" : "password"} 
                className="form-control bg-black text-white rounded-0 border-secondary" 
                style={{ borderColor: '#333' }}
                placeholder={isCurrentPasswordValid ? "Enter new cipher" : "Verify current cipher first..."} 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                disabled={!isCurrentPasswordValid} 
              />
              <button 
                type="button" 
                className="btn btn-outline-secondary text-light rounded-0" 
                style={{ borderColor: '#333' }}
                onClick={() => setShowNewPassword(!showNewPassword)}
                disabled={!isCurrentPasswordValid}
              >
                {showNewPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-danger w-100 rounded-0 fw-bold py-2 text-uppercase" style={{ letterSpacing: '2px' }}>Save Changes</button>
        </form>
      </div>
      </div>
    </div>
   )}

    {/* Upload Relic */}
    {isLoggedIn && activePage === 'upload' && (userRole === 'seller' || userRole === 'admin') && (
      <div className="container py-5 text-start">
        <div className="row justify-content-center">
          <div className="col-md-8 bg-black p-5 border border-secondary rounded-0 shadow-lg" style={{ borderColor: '#333 !important' }}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3 className="fw-bold m-0 text-white" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '1px' }}>FORGE RELIC</h3>
              <button className="btn btn-sm btn-outline-light rounded-0" onClick={() => setActivePage('profile')}>Return</button>
          </div>
          <hr className="border-secondary mb-4" style={{ borderColor: '#333 !important' }} />

          <form onSubmit={handleProductUpload}>
            <div className="mb-3">
              <label className="form-label text-light small fw-semibold">Relic Name</label>
              <input type="text" className="form-control bg-black text-white rounded-0 border-secondary" style={{ borderColor: '#333' }} placeholder="Enter relic title..." value={productTitle} onChange={(e) => setProductTitle(e.target.value)} required />
            </div>
            <div className="mb-3">
              <label className="form-label text-light small fw-semibold">Price ($)</label>
              <input type="number" className="form-control bg-black text-white rounded-0 border-secondary" style={{ borderColor: '#333' }} placeholder="Enter price..." value={productPrice} onChange={(e) => setProductPrice(e.target.value)} required />
            </div>
            <div className="mb-3">
              <label className="form-label text-light small fw-semibold">Category</label>
              <input type="text" className="form-control bg-black text-white rounded-0 border-secondary" style={{ borderColor: '#333' }} placeholder="e.g. Luxury, Accessories..." value={productCategory} onChange={(e) => setProductCategory(e.target.value)} required />
            </div>
            <div className="mb-3">
              <label className="form-label text-light small fw-semibold">Description</label>
              <textarea className="form-control bg-black text-white rounded-0 border-secondary" style={{ borderColor: '#333' }} rows="3" placeholder="Describe the item powers..." value={productDescription} onChange={(e) => setProductDescription(e.target.value)} required></textarea>
            </div>
            <div className="mb-4">
              <label className="form-label text-light small fw-semibold">Image File or URL</label>
              <input type="file" accept="image/*" className="form-control bg-black text-white rounded-0 border-secondary mb-2" style={{ borderColor: '#333' }} onChange={handleProductFile} />
              <input type="text" className="form-control bg-black text-white rounded-0 border-secondary" style={{ borderColor: '#333' }} placeholder="Or paste direct image URL here..." value={productImage} onChange={(e) => setProductImage(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-danger w-100 rounded-0 fw-bold py-2 text-uppercase" style={{ letterSpacing: '2px' }}>Forge Relic Into Store</button>
          </form>
        </div>
        </div>
      </div>
   )}

    {/* Home / High-Profile Showcase */}
    {activePage === 'home' && (
      <>
        {/* Hero Section */}
        <header className="container-fluid text-center py-5" style={{ minHeight: '65vh', display:'flex', flexDirection:'column', justifyContent:'center', background: 'radial-gradient(circle at center, #111 0%, #000 100%)', borderBottom: '1px solid #1a1a1a' }}>
          <motion.div initial={{scale: 0.95, opacity: 0}} animate={{scale: 1, opacity: 1}} transition={{duration: 0.6}}>
            <span className="badge bg-danger rounded-0 px-3 py-2 mb-3 text-uppercase fw-bold" style={{ letterSpacing: '3px', fontSize: '11px' }}>High-Profile Architecture & Design</span>
          </motion.div>
          <motion.h1 initial={{y: 25, opacity: 0}} animate={{y:0, opacity:1}} transition={{delay: 0.2, duration: 0.5}} className="display-1 fw-bold mb-3 text-white" style={{ fontFamily: "'Cinzel', serif", textTransform: 'uppercase', letterSpacing: '6px' }}>
            JR STORE
          </motion.h1>
          <motion.p initial={{opacity: 0}} animate={{opacity: 0.8}} transition={{delay: 0.4, duration: 0.5}} className="lead fs-4 text-light" style={{ fontWeight: '300', letterSpacing: '1px' }}>To master the digital art is to master the self.</motion.p>
          <motion.div initial={{scale: 0.9, opacity: 0}} animate={{scale: 1, opacity:1}} transition={{delay: 0.6, duration: 0.4}}>
            <button className="btn btn-outline-danger btn-lg mt-4 px-5 py-3 rounded-0 fw-bold text-uppercase" style={{ letterSpacing: '2px', borderWidth: '2px' }} onClick={() => window.scrollTo({ top: 550, behavior: 'smooth' })}>Explore Arsenal</button>
          </motion.div>
        </header>

        <div className="container py-5">
          {searchQuery && (
            <div className="mb-5 text-start text-white">
              <h4 className="border-bottom border-secondary pb-2" style={{ fontFamily: "'Cinzel', serif", borderColor: '#333 !important' }}>Search Results for: "{searchQuery}"</h4>
              
              {(searchType === 'all' || searchType === 'profile') && (
                <div className="my-4">
                  <h6 className="text-light text-uppercase mb-3 small" style={{ opacity: 0.7 }}>Matched Profiles</h6>
                  <div className="row g-3">
                    {profilesList.filter(p => !p.isDeleted && p.name.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
                      profilesList.filter(p => !p.isDeleted && p.name.toLowerCase().includes(searchQuery.toLowerCase())).map((prof, idx) => (
                        <div className="col-md-4" key={idx}>
                          <div className="bg-black p-3 border border-secondary rounded-0 d-flex align-items-center justify-content-between" style={{ borderColor: '#333 !important' }}>
                            <div className="d-flex align-items-center gap-3" style={{ cursor: 'pointer' }} onClick={() => setSelectedProfileModalUser(prof)}>
                              <img src={prof.photo || presetAvatars[0]} alt="Profile" style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }} />
                              <div>
                                <h5 className="mb-1 text-white d-flex align-items-center fs-6">
                                  {prof.name} {prof.role === 'admin' && <SamuraiBadge />}
                                </h5>
                                <span className="badge bg-secondary rounded-0 text-uppercase" style={{ fontSize: '10px' }}>{prof.role}</span>
                              </div>
                            </div>
                            <div className="d-flex gap-2">
                              <button className="btn btn-sm btn-outline-light rounded-0 px-2" onClick={() => setSelectedProfileModalUser(prof)}>View</button>
                              {isLoggedIn && prof.email !== userInfo?.email && (
                                <button className="btn btn-sm btn-danger rounded-0 px-3 fw-bold" onClick={() => {
                                  setChatTargetUser(prof);
                                  setActivePage('messenger');
                                }}>Comms</button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-light small" style={{ opacity: 0.5 }}>No profiles matched the query.</p>
                    )}
                  </div>
                </div>
              )}

              {(searchType === 'all' || searchType === 'product') && (
                <div className="my-4">
                  <h6 className="text-light text-uppercase mb-3 small" style={{ opacity: 0.7 }}>Matched Relics</h6>
                  <div className="row g-4">
                    {allProductsList.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
                      allProductsList.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase())).map((prod) => (
                        <div className="col-md-4" key={prod.id}>
                          <div className="card h-100 bg-black border border-secondary rounded-0 p-3" style={{ borderColor: '#333 !important' }}>
                            <div className="bg-dark d-flex align-items-center justify-content-center" style={{ height: '200px', overflow: 'hidden' }}>
                              {prod.image ? <img src={prod.image} alt="Prod" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'No Image'}
                            </div>
                            <div className="card-body text-center">
                              <h5 className="card-title fw-bold text-uppercase text-white mt-2" style={{ fontSize: '16px' }}>{prod.title}</h5>
                              <p className="text-light mb-3">${prod.price}</p>
                              <button className="btn btn-outline-danger w-100 rounded-0 text-uppercase fw-bold" onClick={() => setSelectedProduct(prod)}>Examine Relic</button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-light small" style={{ opacity: 0.5 }}>No relics matched the query.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="row g-4">
            {allProductsList.map((prod) => (
              <div className="col-md-4" key={prod.id}>
                <motion.div 
                  initial={{y: 25, opacity: 0}} 
                  whileInView={{y: 0, opacity: 1}} 
                  viewport={{once: true}} 
                  transition={{duration: 0.4}} 
                  whileHover={{ y: -6, transition: { duration: 0.2 } }}
                  className="card h-100 bg-black border border-secondary rounded-0 p-3 shadow-lg" 
                  style={{ borderColor: '#333 !important', cursor: 'pointer' }}
                  onClick={() => setSelectedProduct(prod)}
                >
                  <div className="bg-dark d-flex align-items-center justify-content-center" style={{ height: '260px', overflow: 'hidden' }}>
                    {prod.image ? <img src={prod.image} alt="Prod" style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease' }} /> : 'Image'}
                  </div>
                  <div className="card-body text-center">
                    <h5 className="card-title fw-bold text-uppercase text-white mt-2" style={{letterSpacing: '1px', fontFamily: "'Cinzel', serif", fontSize: '17px'}}>{prod.title}</h5>
                    <p className="text-light small mb-2">Forgemaster: <span className="text-danger fw-semibold">{prod.seller || 'Master'}</span></p>
                    <p className="text-white fw-bold fs-5 mb-4">${prod.price}</p>
                    <button className="btn btn-outline-danger w-100 rounded-0 text-uppercase fw-bold" style={{letterSpacing: '1px'}} onClick={(e) => {
                      e.stopPropagation();
                      setSelectedProduct(prod);
                    }}>Examine Relic</button>
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
  overlay: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 },
  box: { backgroundColor: '#0d0d0d', padding: '35px', borderRadius: '0', width: '90%', maxWidth: '450px', border: '1px solid #333', boxShadow: '0 15px 50px rgba(0,0,0,0.9)' }
};

const splashStyles = {
  container: { height: '100vh', width: '100vw', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#000', overflow: 'hidden', position: 'fixed', top: 0, left: 0, zIndex: 1000 },
  content: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', width: '100%', height: '100%' },
  logoWrapper: { position: 'relative', width: '120px', height: '120px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '30px' },
  logoGlow: { position: 'absolute', width: '100%', height: '100%', background: 'radial-gradient(circle, rgba(220,53,69,0.35) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(20px)' },
  logoText: { fontSize: '48px', fontWeight: '900', color: '#dc3545', letterSpacing: '4px', position: 'relative', zIndex: 1, fontFamily: "'Cinzel', serif" },
  title: { fontSize: '38px', fontWeight: '700', color: '#fff', textTransform: 'uppercase', letterSpacing: '8px', margin: '0 0 10px 0', fontFamily: "'Cinzel', serif" },
  subtitle: { fontSize: '15px', color: '#fff', fontWeight: '300', letterSpacing: '2px', opacity: '0.75', marginBottom: '50px' },
  progressBar: { height: '2px', background: 'linear-gradient(90deg, transparent, #dc3545, transparent)', position: 'absolute', bottom: '15%', width: '0%', left: 0 }
};

export default App;
