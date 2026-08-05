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
import Dashboard from "./components/Dashboard";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import SellerDashboard from "./pages/SellerDashboard";

function PrivateRoute({ children }) {

    const token = localStorage.getItem("token");

    if (!token) {

        return <Navigate to="/login" replace />;

    }

    return children;

}
<button

className="theme-btn"

onClick={()=>setDarkMode(!darkMode)}

>

{

darkMode

?

"☀ Light"

:

"🌙 Dark"

}

</button>
function Footer() {

    return (

        <footer className="footer">

            <div className="container">

                <h2>

                    Marketplace

                </h2>

                <p>

                    Buy • Sell • Chat • Secure Payment

                </p>

                <p>

                    © 2026 Marketplace. All Rights Reserved.

                </p>

            </div>

        </footer>

    );

}

function NotFound(){

    return(

        <div className="not-found">

            <h1>

                404

            </h1>

            <h2>

                Page Not Found

            </h2>

        </div>

    )

}
const { loading } = useApp();

if (loading) {
    return (
        <div className="loader"></div>
    );
}

function App(){
const [darkMode,setDarkMode]=useState(true);

useEffect(()=>{

document.body.className=darkMode?"dark":"light";

},[darkMode]);
return(

<BrowserRouter>
<ScrollToTop/>
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

<Route

path="/messenger"

element={

<PrivateRoute>

<Messenger/>

  function ScrollToTop() {

    const { pathname } = useLocation();

    useEffect(() => {

        window.scrollTo({

            top:0,

            behavior:"smooth"

        });

    },[pathname]);

    return null;

}
</PrivateRoute>

}

/>

<Route

path="*"

element={<NotFound/>}

/>

</Routes>

<Footer/>

</BrowserRouter>

)

}

export default App;
  import { useApp } from "./context/AppContext";
  import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
  
