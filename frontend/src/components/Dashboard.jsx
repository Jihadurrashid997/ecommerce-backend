import React from "react";
import "./Dashboard.css";
import {
  FaBoxOpen,
  FaUsers,
  FaShoppingCart,
  FaMoneyBillWave,
  FaArrowUp
} from "react-icons/fa";

const Dashboard = () => {

  const cards = [
    {
      title: "Total Products",
      value: "1,245",
      icon: <FaBoxOpen />
    },
    {
      title: "Customers",
      value: "3,682",
      icon: <FaUsers />
    },
    {
      title: "Orders",
      value: "954",
      icon: <FaShoppingCart />
    },
    {
      title: "Revenue",
      value: "৳ 8,42,500",
      icon: <FaMoneyBillWave />
    }
  ];

  return (
    <div className="dashboard">

      <h1 className="dashboard-title">
        Seller Dashboard
      </h1>

      <div className="dashboard-grid">

        {cards.map((item, index) => (

          <div className="dashboard-card" key={index}>

            <div className="dashboard-icon">
              {item.icon}
            </div>

            <h2>{item.value}</h2>

            <p>{item.title}</p>

            <span className="growth">

              <FaArrowUp />

              +12%

            </span>

          </div>

        ))}

      </div>

    </div>
  );
};

export default Dashboard;
