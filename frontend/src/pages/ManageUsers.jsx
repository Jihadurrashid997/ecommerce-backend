import React, { useEffect, useState } from "react";
import api from "../services/api";
import "../styles/ManageUsers.css";

const ManageUsers = () => {

    const [users, setUsers] = useState([]);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {

        try {

            const res = await api.get("/users");

            setUsers(res.data);

        } catch (err) {

            console.log(err);

        }

    };

    const deleteUser = async (id) => {

        if (!window.confirm("Delete this user?")) return;

        try {

            await api.delete(`/users/${id}`);

            setUsers(users.filter(user => user._id !== id));

            alert("User Deleted");

        } catch (err) {

            alert("Delete Failed");

        }

    };

    return (

        <div className="manage-users">

            <h1>Manage Users</h1>

            <table>

                <thead>

                    <tr>

                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Action</th>

                    </tr>

                </thead>

                <tbody>

                    {

                        users.map(user => (

                            <tr key={user._id}>

                                <td>{user.name}</td>

                                <td>{user.email}</td>

                                <td>{user.role}</td>

                                <td>

                                    <button

                                        className="delete-btn"

                                        onClick={() => deleteUser(user._id)}

                                    >

                                        Delete

                                    </button>

                                </td>

                            </tr>

                        ))

                    }

                </tbody>

            </table>

        </div>

    );

};

export default ManageUsers;
