/**
 * Created by Tanoh Kevin on 16/10/2016.
 */

var Functions = require('../functions');
var EventEmitter = require('events').EventEmitter();
var Models = require('./../models');
var Model = Models.choice;
var debug = require('debug')('PollGiftBot:Choice');

var launchReturnMessage = function onCreate(options, cb){
    var messageOptions = options.messageToSend;

    if(!messageOptions.hasOwnProperty('reply_markup')) {
        var ReplyKeyboardHide = {
            hide_keyboard: true
        };
        messageOptions.reply_markup = JSON.stringify(ReplyKeyboardHide);
    }

    return Functions.callTelegramApi('sendMessage', messageOptions,
        function onSend(err, backMessage){
            if (err) return cb(err);

            debug(backMessage);
            return cb(null, backMessage);
        });
};

var saveNewMessage = function onSave(options, cb){
    var messageToSave = options['messageToSave'];
    console.log(messageToSave);
    return messageToSave.save({}, function onSave(err, savedMessage){
        if(err) return cb(err);
        return cb(null, savedMessage)
    })
};

module.exports = {
    init: function onInit(){
        return true;
    },
    sendModifyInline: function onSend(options, callback){
        this.init();
        var Choice = this;

        if(options.poll == null){
            options.messageToSend = {
                text: '<pre>No Poll, create One</pre>',
                chat_id: options.chat.id,
                parse_mode: 'HTML'
            } ;

            return launchReturnMessage(options,
                function onMessageSend(err, messageSent){
                    if(err) return callback(err);
                    return callback(null, null);
                })
        }

        var myPoll = options.poll;

        //Modification Impossible
        if(myPoll.userId != options.message.from.id){
            options.messageToSend = {
                text: '<pre>Vous navez pas le droit de modifier ce Poll</pre>',
                chat_id: options.chat.id,
                parse_mode: 'HTML'
            } ;

            return launchReturnMessage(options,
                function onMessageSend(err, messageSent){
                    if(err) return callback(err);
                    return callback(null, null);
                })
        }

        //Send Inline Options,
        //get Choices
        return Model.find({_poll: myPoll._id}, function onFind(err, choices){
            if(err) return callback(err);

            var keyboards = [];
            for(var prop in choices){
                if(choices.hasOwnProperty(prop)){
                    var choice = choices[prop];
                    var name = (typeof choice.name == 'undefined') ?  '' : choice.name;
                    var keyboard = [choice.ordre+'.'+ name];
                    keyboards.push(keyboard);
                }
            }

            console.log(keyboards);
            if(keyboards.length > 1){
                options.messageToSend = {
                    text: '<pre>Quel choix voulez vous modifier</pre>',
                    chat_id: options.chat.id,
                    parse_mode: 'HTML',
                    reply_markup: JSON.stringify({
                        keyboard: keyboards,
                        one_time_keyboard: true
                    })
                } ;
            }else{
                options.messageToSend = {
                    text: '<pre>Veuillez ajouter plus de choix</pre>',
                    chat_id: options.chat.id,
                    parse_mode: 'HTML',
                } ;
            }

            return launchReturnMessage(options,
                function onMessageSend(err, messageSent){
                    if(err) return callback(err);

                    if(typeof options.messageToSend.reply_markup != 'undefined'){
                        //not undefined on save
                        options.messageToSave = new Models.message({
                            chatId: messageSent.result.chat.id,
                            Id: messageSent.result['message_id'],
                            command: 'modifyChoice'
                        });
                    }
                    return saveNewMessage(options, callback);
                })
        })
    },
    addChoice: function onAdd(options, callback){
        this.init();
        var Choice = this;

        //No poll finded
        if(options.poll == null){
            options.messageToSend = {
                text: '<pre>No Poll, create One</pre>',
                chat_id: options.chat.id,
                parse_mode: 'HTML'
            } ;

            return launchReturnMessage(options,
                function onMessageSend(err, messageSent){
                    if(err) return callback(err);
                    return callback(null, null);
                })
        }

        var myPoll = options.poll;

        //Modification Impossible
        if(myPoll.userId != options.message.from.id){
            options.messageToSend = {
                text: '<pre>Vous navez pas le droit de modifier ce Poll</pre>',
                chat_id: options.chat.id,
                parse_mode: 'HTML'
            } ;

            return launchReturnMessage(options,
                function onMessageSend(err, messageSent){
                    if(err) return callback(err);
                    return callback(null, null);
                })
        }

        return Model.count({_poll: myPoll._id}, function onCount(err, count){
            if(err) return callback(err);
            count++;
            var newChoice = new Model({
                ordre: count,
                _poll: myPoll._id
            });

            return newChoice.save({},function onSave(err, choiceSaved){
                if(err) return callback(err);

                options.messageToSend = {
                    text: '<pre>Choice N° ' + count + ' added</pre>',
                    chat_id: options.chat.id,
                    parse_mode: 'HTML'
                } ;

                return launchReturnMessage(options,
                    function onMessageSend(err, messageSent){
                        if(err) return callback(err);
                        return callback(null, choiceSaved);
                    })
            });
        });
    }
};