/**
 * Created by Tanoh Kevin on 15/10/2016.
 */
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var messageSchema = new Schema({
    Id: {
        type: String,
        required: true,
        index: true
    },
    chatId: {
        type: String,
        required: false,
        index: true
    },
    userId: {
        type: String
    },
    command: {
        type: String,
        required: true
    },
    treated: {
        type: Boolean,
        default: 0
    },
    nextAction: {
        type: Boolean,
        default: 0
    }
});

var Message = mongoose.model('Message', messageSchema);
module.exports = Message;