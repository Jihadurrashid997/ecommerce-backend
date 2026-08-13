const jwt = require("jsonwebtoken");


const auth = (roles = []) => {

    return (req, res, next) => {


        const authHeader =
            req.header("Authorization");


        // ==========================
        // TOKEN CHECK
        // ==========================

        if (
            !authHeader ||
            !authHeader.startsWith(
                "Bearer "
            )
        ) {

            return res.status(401).json({

                message:
                    "Authorization token missing"

            });

        }


        const token =
            authHeader.split(" ")[1];


        try {

            // ==========================
            // VERIFY TOKEN
            // ==========================

            const decoded =
                jwt.verify(
                    token,
                    process.env.JWT_SECRET
                );


            req.user =
                decoded;


            // ==========================
            // ROLE CHECK
            // ==========================

            if (
                roles.length > 0 &&
                !roles.includes(
                    req.user.role
                )
            ) {

                return res.status(403).json({

                    message:
                        "Access Denied"

                });

            }


            next();


        } catch (err) {

            console.error(
                "Auth middleware error:",
                err
            );


            return res.status(401).json({

                message:
                    "Invalid or Expired Token"

            });

        }

    };

};


module.exports = auth;
