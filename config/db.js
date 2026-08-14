const mongoose = require("mongoose");

const connectDB = async () => {

    try {

        const mongoURI =
            process.env.MONGO_URI;

        if (!mongoURI) {

            throw new Error(
                "MONGO_URI is missing in environment variables"
            );

        }

        if (
            mongoose.connection.readyState === 1
        ) {

            console.log(
                "MongoDB already connected"
            );

            return mongoose.connection;

        }


        const connection =
            await mongoose.connect(
                mongoURI,
                {
                    serverSelectionTimeoutMS: 15000,
                    connectTimeoutMS: 15000,
                    socketTimeoutMS: 45000,
                    maxPoolSize: 10
                }
            );


        console.log(
            `✅ MongoDB Connected: ${connection.connection.host}`
        );


        return connection.connection;


    } catch (error) {

        console.error(
            "❌ MongoDB Connection Failed:",
            error.message
        );

        throw error;

    }

};


mongoose.connection.on(
    "connected",
    () => {

        console.log(
            "🟢 MongoDB connection established"
        );

    }
);


mongoose.connection.on(
    "error",
    (error) => {

        console.error(
            "🔴 MongoDB error:",
            error.message
        );

    }
);


mongoose.connection.on(
    "disconnected",
    () => {

        console.warn(
            "🟡 MongoDB disconnected"
        );

    }
);


module.exports = connectDB;
