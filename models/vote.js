/**
 * Created by Tanoh Kevin on 22/10/2016.
 */
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var voteSchema = new Schema({

    _choice:{
        type: Schema.Types.ObjectId,
        ref: 'Choice'
    },
    chatId:{
        type: String,
        required: true
    },
    userId:{
        type: String,
        required: true
    }
});

var Vote = mongoose.model('Vote', voteSchema);
module.exports = Vote;