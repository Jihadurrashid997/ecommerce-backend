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

                // Only required when there is no
                // file attachment - an image/file
                // sent with no caption is still a
                // valid message.
                required:
                    function () {

                        return !this.fileUrl;

                    },

                trim:
                    true,

                maxlength:
                    5000

            },


            fileUrl: {

                type:
                    String,

                default:
                    ""

            },


            fileName: {

                type:
                    String,

                default:
                    ""

            },


            fileType: {

                type:
                    String,

                default:
                    ""

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
