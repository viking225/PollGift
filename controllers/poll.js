/**
 * Created by Tanoh Kevin on 29/09/2016.
 */
var Models = require('./../models');
var Model = Models.poll;
var EventEmitter = require('events').EventEmitter;
var messageEvent = new EventEmitter();
var Functions = require('../functions');

var poll = {
    init: function onInit(){

        messageEvent.on('error', function onErr(cb, err){
            console.log('launch err');
            return cb(err);
        });

        messageEvent.on('pollCreated', function onCreate(cb, options){
            var messageOptions = {
                text: '<pre>Poll créer veuillez ajouter les options</pre>',
                chat_id: options.chat.id,
                parse_mode: 'HTML'
        } ;

            Functions.callTelegramApi('sendMessage', messageOptions,
                function onSend(err, backMessage){
                    if (err) return messageEvent.emit('error',cb, err);
                    return cb(null, options.poll);
                });
        });

        messageEvent.on('pollExist', function onExist(cb, options){
            var messageOptions = {
                text: '<pre>Un poll exciste deja pour ce groupe veuillez le supprimer avant</pre>',
                chat_id: options.chat.id,
                parse_mode: 'HTML'
            } ;

            Functions.callTelegramApi('sendMessage', messageOptions,
                function onSend(err, backMessage){
                    if (err) return messageEvent.emit('error', cb, err);
                    return cb(null, options.poll);
                });
        });
    },

    createPoll: function createPoll(options, cb) {
        var Poll = this;
        Poll.init();
        Poll.getPoll({chatId: options.chat.id},
            function onFind(err, poll){
                if(err) return messageEvent.emit('error', cb, err);
                if(poll) {
                    options.poll = poll;
                    return messageEvent.emit('pollExist', cb, options);
                }

                options.poll = {lol: 1};
                return messageEvent.emit('pollCreated', cb, options);
            }
        );
    },
    getPoll: function getPoll(options, callback){

        return Model
            .findOne(options)
            .exec(callback);
    }
};

module.exports = poll;