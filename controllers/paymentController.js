const SSLCommerzPayment = require("sslcommerz-lts");

const store_id = process.env.SSLC_STORE_ID;
const store_passwd = process.env.SSLC_STORE_PASSWORD;
const is_live = false;

exports.initPayment = async (req, res) => {

    try {

        const data = {

            total_amount: req.body.totalAmount,
            currency: "BDT",
            tran_id: "TXN_" + Date.now(),

            success_url: `${process.env.CLIENT_URL}/payment-success`,
            fail_url: `${process.env.CLIENT_URL}/payment-fail`,
            cancel_url: `${process.env.CLIENT_URL}/payment-cancel`,

            ipn_url: `${process.env.CLIENT_URL}/ipn`,

            shipping_method: "Courier",

            product_name: "Marketplace Order",

            product_category: "Ecommerce",

            product_profile: "general",

            cus_name: req.body.name,
            cus_email: req.body.email,
            cus_add1: req.body.address,
            cus_city: "Dhaka",
            cus_country: "Bangladesh",
            cus_phone: req.body.phone

        };

        const sslcz = new SSLCommerzPayment(
            store_id,
            store_passwd,
            is_live
        );

        const apiResponse = await sslcz.init(data);

        res.json({
            gateway: apiResponse.GatewayPageURL
        });

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

};
