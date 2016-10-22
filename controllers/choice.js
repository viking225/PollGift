/**
 * Created by Tanoh Kevin on 16/10/2016.
 */

var request = require('request');
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
            if(backMessage.ok == false)
                debug(backMessage);
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

var launchSaveChoice = function(options, cb){
    //Save

    options['choiceFinded'][options.commands.param[0]] = options.text;
    var newChoice = new Model(options['choiceFinded']);

    return newChoice.save({}, function onSaveChoice(err, choiceSaved){
        if(err || !choiceSaved)
            return launchReturnMessage({messageToSend: options.messageToSend}, cb);

        options.messageToSend.text = '<pre>Choix modifié</pre>';
        return launchReturnMessage({messageToSend: options.messageToSend}, cb);
    })
};

var sortChoices = function(a,b){
    if(a.votes.length < b.votes.length)
        return -1;
    if(a.votes.length > b.votes.length)
        return 1;
    return 0;
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

                //controle en amont
                if(commands.param[0] == 'price' && !/^\d+$/.test(options.message.text) ){
                    messageToSend.text = "Fuck you too :)";
                    return launchReturnMessage({messageToSend: messageToSend}, cb);
                }
                if(commands.param[0] == 'link'){
                    return request.get({url:options.message.text}, function(err, httpResponse, body){
                        if(err || httpResponse.statusCode != 200){
                            messageToSend.text = 'Lien non valide !';
                            return launchReturnMessage({messageToSend: messageToSend}, cb);
                        }

                        return launchSaveChoice({choiceFinded: choiceFinded, messageToSend: messageToSend, commands: commands, text: options.message.text}, cb)
                    });
                }else{
                    return launchSaveChoice({choiceFinded: choiceFinded, messageToSend: messageToSend, commands: commands, text: options.message.text}, cb);
                }
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

            return Choice.constructKeyboard({choices: choices}, function onBuild(err, keyboards){
                if(keyboards.length > 0){
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
            });
        })
    },
    sendVoteInline: function onSend(options, callback){
        this.init();
        var Choice = this;

        var myPoll = options.poll;
        return Choice.getChoices({_poll: myPoll._id},
            function onGet(err, choices){
                if(err) return callback(err);

                return Choice.constructKeyboard({choices: choices},
                    function onBuild(err, keyboards){
                        if(keyboards.length > 0){
                            options.messageToSend = {
                                text: '<pre>Faites votre choix</pre>',
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
                            function onSend(err, messageSent){
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
                                        command: 'voteChoice'
                                    });
                                }
                                return saveNewMessage(options, callback);
                            }
                        )
                    })
            })
    },
    saveVoteChoice: function onSave(options, callback){
        this.init();
        var Choice = this;

        var commands = options.commands;

        //Update l'ancien Message
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
            saveNewMessage({messageToSave: new Models.message(oldMessage)}, callback);
        });

        //On recupere le choix
        return Model.findOne({ordre: options.data},
            function onFind(err, choiceFinded){
                if(err) return callback(err);

                var messageToSend = {
                    text: '<pre>Ce choix a été supprimé</pre>',
                    parse_mode: 'HTML',
                    chat_id: options.chat.id
                };

                if(!choiceFinded)
                    return launchReturnMessage({messageToSend: messageToSend}, callback);

                messageToSend.text = '@'+options.from.username+' <pre>a voté pour</pre> '+choiceFinded.name;

                //On recupere l'ancien vote si il y en a un
                return Models.vote.findOne({userId: options.from.id, chatId: options.chat.id},
                    function onFind(err, oldVote){
                        if(err) return callback(err);

                        if(oldVote) {
                            messageToSend.text = '@' + options.from.username + ' <pre>Vote modifié son choix pour </pre>'+choiceFinded.name;
                            oldVote._choice = choiceFinded.id;
                        }else{
                            oldVote = new Models.vote({
                                userId: options.from.id,
                                chatId: options.chat.id,
                                _choice: choiceFinded.id
                            });
                        }

                        return oldVote.save({}, function onSave(err, savedVote){
                            if(err) return callback(err);

                            //On save le choice Finded
                            return choiceFinded.save({}, function onSaveChoice(err, newChoice){
                                if(err) return callback(err);
                                return launchReturnMessage({messageToSend: messageToSend}, callback);
                            })
                        })
                    }
                )
            }
        );
    },
    sendResults: function sendResults(options, cb){
        //On recupere les choices
        var Choice = this;
        return Choice.getChoices({_poll: options.poll.id},
            function onGet(err, choices){
                if(err) return cb(err);

                if(choices){
                    choices.sort(sortChoices);
                }
                return Choice.constructKeyboard({choices: choices, mode: 'results'},
                    function onBuild(err, keyboards){
                        if(err) return cb(err);
                        if(keyboards.length > 0){
                            options.messageToSend = {
                                text: '<pre>Résultats Actuel du vote</pre>',
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
                                if(err) return cb(err);
                                if(messageSent.ok == false) return cb(new Error('Internal server error 2'));

                                if(typeof options.messageToSend.reply_markup != 'undefined'){
                                    //not undefined on save
                                    options.messageToSave = new Models.message({
                                        userId: options.message.from.id,
                                        chatId: messageSent.result.chat.id,
                                        Id: messageSent.result['message_id'],
                                        command: 'noLinkOpen'
                                    });
                                }
                                return saveNewMessage(options, cb);
                            }
                        );
                    })
            })
    },
    constructKeyboard: function(options, callback){
        var mode = 'view';
        if(typeof options.mode != 'undefined')
            mode = options.mode;

        var choices = options.choices;
        var keyboards =[], keyboardLine = [];
        var nCol = Math.round(choices.length/3);
        var colActu = 1;

        for(var prop2 in choices){
            if(choices.hasOwnProperty(prop2)){
                var choice = choices[prop2];

                var name = (typeof choice.name == 'undefined') ?  '' : choice.name;
                var priceString = typeof choice.price == 'undefined' ? '#€' : choice.price+'€';
                var text = choice.ordre +'. '+ name + ' - ' + priceString;
                var callback_data = String(choice.ordre);
                var obj = {text: text, callback_data: callback_data};

                if(mode == 'results'){
                    var votes = ' - ' + choice.votes.length +' Votes';
                    obj.text = choice.ordre +'. '+ name + votes;
                    obj.callback_data = 'openLink';
                    if (typeof choice.link != 'undefined'){
                        obj.url = choice.link;
                    }
                }

                keyboardLine.push(obj);
                colActu++;
                if(colActu > nCol){
                    keyboards.push(keyboardLine);
                    colActu = 1;
                    keyboardLine = [];
                }
            }
        }
        if(keyboardLine.length > 0)
            keyboards.push(keyboardLine);

        return callback(null, keyboards);
    },
    addChoice: function onAdd(options, callback){
        this.init();
        var Choice = this;

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
    },
    getChoices: function onGet(options, callback){
        var populateOptions = options.populate || 'votes';
        return Model
            .find(options)
            .populate(populateOptions)
            .exec(callback);
    }
};