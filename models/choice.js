/**
 * Created by Tanoh Kevin on 16/10/2016.
 */

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var choiceSchema = new Schema({

    _poll:{
        type: Schema.Types.ObjectId,
        ref: 'Poll'
    },
    ordre: {
        type: Number,
        required: true
    },
    name:{
        type: String
    },
    price: Number,
    link: String,
    votes: [{
        type: Schema.Types.ObjectId,
        ref: 'Vote'
    }]

});

var Choice = mongoose.model('Choice', choiceSchema);
module.exports = Choice;