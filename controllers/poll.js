/**
 * Created by Tanoh Kevin on 29/09/2016.
 */
var Models = require('./../models');
var Model = Models.poll;
var EventEmitter = require('events').EventEmitter;
var messageEvent = new EventEmitter();
var Functions = require('../functions');
var debug = require('debug')('PollGiftBot:pollC');

var launchReturnMessage = function onCreate(cb, options){
    var messageOptions = options.messageToSend;

    return Functions.callTelegramApi('sendMessage', messageOptions,
        function onSend(err, backMessage){
            if (err) return cb(err);
            return cb(null, options.poll);
        });
};

var saveNewMessage = function onSave(options, cb){
    var messageToSave = options['messageToSave'];
    return messageToSave.save({}, function onSave(err, savedMessage){
        if(err) return cb(err);
        return cb(null, savedMessage)
    })
};

var deleteMyPoll = function deleteMyPoll(Poll, options, cb){
    return Poll.getPoll({chatId: options.chat.id}, function onFind(err, pollFinded){
        if(err) return cb(err);
        if(!poll){
            options.poll = null;
            options.messageToSend = {
                text: '<pre>No Poll to delete</pre>',
                chat_id: options.chat.id,
                parse_mode: 'HTML'
            } ;
            return launchReturnMessage(cb, options);
        }

        if(options.commands.param.toLowerCase() == 'oui'){
            pollFinded.deleted = true;
            var updatePoll = Model(pollFinded);

            updatePoll.save(options, function onSave(err, savedPoll){
                if(err) return cb(err);
                options.poll = savedPoll;
                options.messageToSend = {
                    text: '<pre>Poll deleted , Bye Bye result</pre>',
                    chat_id: options.chat.id,
                    parse_mode: 'HTML'
                } ;
                return launchReturnMessage(cb, options);
            });
        }
        else{
            options.poll = pollFinded;
            options.messageToSend = {
                text: '<pre>Ouf..</pre>',
                chat_id: options.chat.id,
                parse_mode: 'HTML'
            } ;
            return launchReturnMessage(cb, options);
        }

    });
};

var poll = {
    init: function onInit(){
        return true;
    },

    createPoll: function createPoll(options, cb) {
        var Poll = this;
        Poll.init();
        return Poll.getPoll({chatId: options.chat.id},
            function onFind(err, poll){
                if(err) return cb(err);
                if(poll) {
                    options.poll = null;
                    options.messageToSend = {
                        text: '<pre>Un poll existe deja pour ce groupe veuillez le supprimer avant</pre>',
                        chat_id: options.chat.id,
                        parse_mode: 'HTML'
                    } ;
                    return launchReturnMessage(cb, options);
                }

                var newPoll = new Model({
                    chatId: options.chat.id,
                    userId: options.message.from.id
                });

                newPoll.save({}, function onSave(err, savedPoll){
                    if(err)
                        return cb(err);

                    options.poll = savedPoll;
                    options.messageToSend = {
                        text: '<pre>Poll just created, add Options</pre>',
                        chat_id: options.chat.id,
                        parse_mode: 'HTML'
                    } ;
                    return launchReturnMessage(cb, options);
                });
            }
        );
    },
    delete: function deletePoll(options, cb){
        var Poll = this;
        Poll.init();

        //On met le message comme treated
        options.messageToSave = options.commands.dbMessage;
        options.messageToSave.treated = true;

        return saveNewMessage(options, function onMessageSaved(err, savedMessage){
            if(err) return cb(err);
            return deleteMyPoll(Poll, options, cb);
        });
    },
    launchDeletePoll: function launchDeletePoll(options, cb){
        var Poll = this;
        Poll.init();

        return Poll.getPoll({chatId: options.chat.id},
            function onFind(err, poll){
                if(err) return cb(err);
                if(!poll){
                    options.messageToSend = {
                        text: '<pre>No Poll to delete</pre>',
                        chat_id: options.chat.id,
                        parse_mode: 'HTML'
                    } ;
                    return launchReturnMessage(cb, options);
                }

                var ReplyKeyboardMarkup = {
                    keyboard: [['Oui'], ['Non']],
                    force_reply: true,
                    one_time_keyboard: true
                };

                var messageOptions = {
                    text: '<pre>Voulez vous vraiment supprimer le poll actif ?</pre>',
                    chat_id: options.chat.id,
                    parse_mode: 'HTML',
                    reply_markup: JSON.stringify(ReplyKeyboardMarkup)
                } ;

                Functions.callTelegramApi('sendMessage', messageOptions,
                    function onSend(err, backMessage){
                        if (err) return cb(err);

                        options.messageToSave = new Models.message({
                            chatId: backMessage.result.chat.id,
                            Id: backMessage.result['message_id'],
                            command: 'deleteConfirm'
                        });

                        return saveNewMessage(options, cb);
                    });
            }
        );
    },
    getPoll: function getPoll(options, callback){
        if(typeof options.deleted == "undefined")
            options.deleted = false;
        return Model
            .findOne(options)
            .exec(callback);
    }
};

module.exports = poll;