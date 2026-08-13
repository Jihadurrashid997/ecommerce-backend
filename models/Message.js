const mongoose =
    require("mongoose");


const MessageSchema =
    new mongoose.Schema(

        {

            sender: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref:
                    "User",

                required:
                    true

            },


            receiver: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref:
                    "User",

                required:
                    true

            },


            message: {

                type:
                    String,

                required:
                    true,

                trim:
                    true

            },


            isSeen: {

                type:
                    Boolean,

                default:
                    false

            }

        },

        {
            timestamps:
                true
        }

    );


module.exports =
    mongoose.model(
        "Message",
        MessageSchema
    );
