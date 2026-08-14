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
                    true,

                index:
                    true

            },


            receiver: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref:
                    "User",

                required:
                    true,

                index:
                    true

            },


            message: {

                type:
                    String,

                required:
                    true,

                trim:
                    true,

                maxlength:
                    5000

            },


            isSeen: {

                type:
                    Boolean,

                default:
                    false,

                index:
                    true

            }

        },

        {
            timestamps:
                true
        }

    );


// Fast conversation lookup

MessageSchema.index({
    sender: 1,
    receiver: 1,
    createdAt: 1
});


MessageSchema.index({
    receiver: 1,
    sender: 1,
    createdAt: 1
});


module.exports =
    mongoose.model(
        "Message",
        MessageSchema
    );
