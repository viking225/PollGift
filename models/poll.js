/**
 * Created by Tanoh Kevin on 29/09/2016.
 */
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var pollSchema = new Schema({
    type: String,
    name: {
        type: String,
    },
    chatId: {
        type: String,
        required: true,
        index: true
    },
    userId: {
        type: String,
        required: true,
        index: true
    },
    birthday: {
        type: Date,
    },
    deleted: {
        type: Boolean,
        default: 0
    }
});

pollSchema.set('autoIndex', false);

var Poll = mongoose.model('Poll', pollSchema);
module.exports = Poll;