import React from "react";
import {
BrowserRouter,
Routes,
Route,
Navigate
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

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import SellerDashboard from "./pages/SellerDashboard";
import Dashboard from "./components/Dashboard";

function PrivateRoute({ children }) {

const token = localStorage.getItem("token");

return token ? children : <Navigate to="/login" />;

}

function App() {

return (

<BrowserRouter>

<Navbar/>

<Routes>

<Route

path="/"

element={<Home/>}

/>

<Route

path="/login"

element={<Login/>}

/>

<Route

path="/register"

element={<Register/>}

/>

<Route

path="/messenger"

element={

<PrivateRoute>

<Messenger/>

</PrivateRoute>

}

/>

<Route

path="/profile"

element={

<PrivateRoute>

<Profile/>

</PrivateRoute>

}

/>

<Route

path="/dashboard"

element={

<PrivateRoute>

<Dashboard/>

</PrivateRoute>

}

/>

<Route

path="/seller"

element={

<PrivateRoute>

<SellerDashboard/>

</PrivateRoute>

}

/>

</Routes>

</BrowserRouter>

);

}

export default App;
