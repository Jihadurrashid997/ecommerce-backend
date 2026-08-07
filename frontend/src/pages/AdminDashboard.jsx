import React from "react";
import { Link } from "react-router-dom";
import "../styles/AdminDashboard.css";

const AdminDashboard = () => {

    const cards = [

        {
            title: "Manage Products",
            path: "/seller-products"
        },

        {
            title: "Manage Users",
            path: "/admin/users"
        },

        {
            title: "Manage Orders",
            path: "/admin/orders"
        },

        {
            title: "Manage Sellers",
            path: "/admin/sellers"
        }

    ];

    return (

        <div className="admin-dashboard">

            <h1>

                Admin Dashboard

            </h1>

            <div className="admin-grid">

                {

                    cards.map((card,index)=>(

                        <Link
                        key={index}
                        to={card.path}
                        className="admin-card"
                        >

                            <h2>

                                {card.title}

                            </h2>

                        </Link>

                    ))

                }

            </div>

        </div>

    );

};

export default AdminDashboard;
