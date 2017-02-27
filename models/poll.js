/**
 * Created by Tanoh Kevin on 29/09/2016.
 */
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var pollSchema = new Schema({
    type: {
        type: String,
        required: true,
        default: 'building'
    }, 
    name: {
        type: String
    },
    userId: {
        type: String,
        required: true,
        index: true
    },
    birthday: {
        type: Date
    },
    deleted: {
        type: Boolean,
        default: 0
    },
    choices: [{
        type: Schema.Types.ObjectId,
        ref: 'Choice'
    }]
},{
    timestamps: true
});

pollSchema.set('autoIndex', false);

var Poll = mongoose.model('Poll', pollSchema);
module.exports = Poll;