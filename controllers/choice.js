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
    var func = 'sendMessage';

    //console.log(messageOptions);

    if(typeof options['functionApi'] != "undefined" ) {
        func = options['functionApi'];
        options['functionsApi'] = null;
    }

    return Functions.callTelegramApi(func, messageOptions,
        function onSend(err, backMessage){
            if (err) return cb(err);
            //debug(backMessage);
            return cb(null, backMessage);
        });
};

var saveNewMessage = function onSave(options, cb){
    var messageToSave = options['messageToSave'];

    return messageToSave.save({}, function onSave(err, savedMessage){
        if(err) return cb(err);
        return cb(null, savedMessage)
    })
};

var sendUnknownChoice = function(options, callback){
    options.messageToSend = {
        text: '<pre>Choix Non existant</pre>',
        chat_id: options.chat.id,
        parse_mode: 'HTML'
    } ;

    return launchReturnMessage(options,
        function onMessageSend(err, messageSent){
            if(err) return callback(err);
            return callback(null, messageSent);
        })
};

module.exports = {
    init: function onInit(){
        return true;
    },
    saveAttr: function onSave(options, cb){
        this.init();
        var commands = options.commands;

        //Mettre le message comme traiter
        var oldMessage = commands.dbMessage;
        oldMessage.treated = true;
        saveNewMessage({messageToSave: new Models.message(oldMessage)}, cb);

        return Model.findOne({ordre: commands.param[1], _poll: options.poll._id},
            function onFind(err, choiceFinded){
                if(err) return cb(err);
                if(!choiceFinded) return cb(null, choiceFinded);

                var messageToSend = {
                    text: '<pre>Echec de la modification</pre>',
                    parse_mode: 'HTML',
                    chat_id: options.chat.id
                };

                //Save
                choiceFinded[commands.param[0]] = options.message.text;
                var newChoice = new Model(choiceFinded);

                return newChoice.save({}, function onSaveChoice(err, choiceSaved){
                    if(err || !choiceFinded)
                        return launchReturnMessage({messageToSend: messageToSend}, cb);

                    messageToSend.text = '<pre>Choix modifié</pre>';
                    return launchReturnMessage({messageToSend: messageToSend}, cb);
                })
            });
        //On recupere le choice
    },
    sendModifyInlineType: function onSend(options, callback){
        this.init();
        var commands = options.commands;
        //On extrait la commande
        var result = options.data.match(/([^\/]+)/g);
        console.log(result);
        var messageText = '<pre>';

        //On update l'ancien message
        options.messageToSend = {
            chat_id: options.chat.id,
            message_id: commands.dbMessage.Id,
            reply_markup: JSON.stringify({
                inline_keyboard: []
            })
        };
        options['functionApi'] = 'editMessageReplyMarkup';

        launchReturnMessage(options, function onSend(err, messageSent){
            if(err) return callback(err, null);
            if(!messageSent.ok) return callback(new Error('Update Message Failed'));
            //on termine la requete de celui la
            var oldMessage = commands.dbMessage;
            oldMessage.treated = true;
            return saveNewMessage({messageToSave: new Models.message(oldMessage)}, callback);
        });

        //On ecris un nouveau message
        if(result){
            switch (result[0]){
                case 'name':
                    messageText += 'Veuillez saisir le nom du cadeau';
                    break;
                case 'link':
                    messageText += 'Veuillez saisir le lien du cadeau';
                    break;
                case 'pic':
                    messageText += 'Veuillez envoyer la photo du cadeau';
                    break;
                case 'price':
                    messageText += 'Veuillez saisir le prix (Des nombres stp fait pas tout peter)';
                    break;
            }
            messageText += '</pre>';

            var messageToSend = {
                text: messageText,
                parse_mode: 'HTML',
                chat_id: options.chat.id,
                reply_markup: JSON.stringify({
                    force_reply: true
                })
            };

            return launchReturnMessage({messageToSend: messageToSend}, function onSend(err, messageSent){
                if(err) return callback(err);
                if(!messageSent.ok) return callback(new Error('Message Failed'));

                var messageToSave = new Models.message({
                    userId: options.from.id,
                    chatId: messageSent.result.chat.id,
                    Id: messageSent.result['message_id'],
                    command: 'saveAttr/'+result[0]+'/'+result[1]
                });

                return saveNewMessage({messageToSave: messageToSave}, callback);
            });
        }
        return callback(true, null);
    },
    sendModifyInlineChoice: function onSend(options, callback){
        this.init();
        var Choice = this;
        var commands = options.commands;
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

        //Get choice with info
        return Model.findOne({ordre: commands.param, _poll: options.poll._id},
            function onFind(err, choiceFinded){
                if(err) return callback(err);
                if(!choiceFinded) return sendUnknownChoice(options, callback);

                //modify message and update info
                options.messageToSend = {
                    text: '<pre>Que Changer ?</pre>',
                    parse_mode: 'HTML',
                    chat_id: options.chat.id,
                    message_id: commands.dbMessage.Id,
                    reply_to_message_id: options.message.message_id,
                    reply_markup: JSON.stringify({
                        inline_keyboard: [
                            [{text: 'Nom', callback_data: 'name/'+choiceFinded.ordre}],
                            [{text: 'Prix', callback_data: 'price/'+choiceFinded.ordre}],
                            [{text: 'Image', callback_data: 'pic/'+choiceFinded.ordre}],
                            [{text: 'Lien', callback_data: 'link/'+choiceFinded.ordre}]
                        ],
                        one_time_keyboard: true
                    })
                } ;

                options['functionApi'] = 'editMessageText';

                return launchReturnMessage(options, function onSend(err, messageSent){
                    if(err) return callback(err);
                    if(messageSent.ok == false) return callback(new Error('No Message Sent Internal error'));

                    var oldMessage = commands.dbMessage;
                    oldMessage.command = 'modifyChoiceType';
                    oldMessage.Id = messageSent.result.message_id;
                    options.messageToSave = new Models.message(oldMessage);
                    return saveNewMessage(options, callback);
                })
            });
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

            for(var prop2 in choices){
                if(choices.hasOwnProperty(prop2)){
                    var choice = choices[prop2];
                    var name = (typeof choice.name == 'undefined') ?  '' : choice.name;
                    name = choice.ordre +'. '+ name;
                    var callback_data = String(choice.ordre);
                    var keyboard = [{text: name, callback_data: callback_data}];
                    keyboards.push(keyboard);
                }
            }

            if(keyboards.length > 1){
                options.messageToSend = {
                    text: '<pre>Je vais vous aider a modifier les différents choix, cliquez sur celui a modiifer</pre>',
                    parse_mode: 'HTML',
                    chat_id: options.chat.id,
                    reply_markup: JSON.stringify({
                        inline_keyboard: keyboards
                    })
                } ;
            }else{
                options.messageToSend = {
                    text: '<pre>Veuillez ajouter plus de choix</pre>',
                    chat_id: options.chat.id,
                    reply_to_message_id: options.message.message_id,
                    parse_mode: 'HTML'
                } ;
            }

            return launchReturnMessage(options,
                function onMessageSend(err, messageSent){
                    if(err) return callback(err);
                    if(messageSent.ok == false){
                        return callback(new Error('Internal error'));
                    }
                    if(typeof options.messageToSend.reply_markup != 'undefined'){
                        //not undefined on save
                        options.messageToSave = new Models.message({
                            userId: options.message.from.id,
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