import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import "./styles/App.css";
import "./styles/Navbar.css";
import "./styles/ProductCard.css";
import "./styles/Dashboard.css";
import "./styles/Messenger.css";
import "./styles/Responsive.css";
import "./styles/Animation.css";

import Navbar from "./components/Navbar";
import Messenger from "./components/Messenger";
import Dashboard from "./components/Dashboard";


import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import SellerDashboard from "./pages/SellerDashboard";
import Cart from "./pages/Cart";
import Wishlist from "./pages/Wishlist";
import ProductDetails from "./pages/ProductDetails";
import EditProduct from "./pages/EditProduct";
import AdminDashboard from "./pages/AdminDashboard";

function PrivateRoute({ children }) {
  const token = localStorage.getItem("token");

  return token ? children : <Navigate to="/login" replace />;
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <h2>Marketplace</h2>
        <p>Buy • Sell • Chat • Secure Payment</p>
        <p>© 2026 Marketplace. All Rights Reserved.</p>
      </div>
    </footer>
  );
}

function NotFound() {
  return (
    <div className="not-found">
      <h1>404</h1>
      <h2>Page Not Found</h2>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>

      <Navbar />

      <Routes>

        <Route path="/" element={<Home />} />

        <Route path="/login" element={<Login />} />

        <Route path="/register" element={<Register />} />

        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />

        <Route
          path="/seller"
          element={
            <PrivateRoute>
              <SellerDashboard />
            </PrivateRoute>
          }
        />
          <Route
path="/admin"
element={
<PrivateRoute>
<AdminDashboard/>
</PrivateRoute>
}
/>

        <Route
          path="/cart"
          element={
            <PrivateRoute>
              <Cart />
            </PrivateRoute>
          }
        />
<Route
path="/edit-product/:id"
element={
<PrivateRoute>
<EditProduct/>
</PrivateRoute>
}
/>
        <Route
          path="/wishlist"
          element={
            <PrivateRoute>
              <Wishlist />
            </PrivateRoute>
          }
        />

        <Route
          path="/messenger"
          element={
            <PrivateRoute>
              <Messenger />
            </PrivateRoute>
          }
        />
          <Route
path="/product/:id"
element={<ProductDetails/>}
/>

        <Route path="*" element={<NotFound />} />

      </Routes>

      <Footer />

    </BrowserRouter>
  );
}

export default App;
