/**
 * Created by Tanoh Kevin on 29/09/2016.
 */
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var pollSchema = new Schema({
    type: String,
    name: {
        type: String,
        required: true
    },
    chatId: {
        type: String,
        required: true,
        index: {
            required: true
        }
    },
    birthday: {
        type: Date,
        required: false
    },
    deleted: {
        type: Boolean,
        default: 0
    }
});

var Poll = mongoose.model('Poll', pollSchema);
module.exports = Poll;