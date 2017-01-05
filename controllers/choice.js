/**
 * Created by Tanoh Kevin on 16/10/2016.
 */

 var request = require('request');
 var Functions = require('../functions');
 var EventEmitter = require('events').EventEmitter;
 var messageEvent = new EventEmitter();
 var Models = require('./../models');
 var Model = Models.choice;
 var debug = require('debug')('PollGiftBot:Choice');
 var choicesPopulate = null;
 var votesPopulate = null;

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
                return cb(new Error(backMessage.description));
            return cb(null, backMessage);
        });
};

var showPopUp = function onShow(options, cb) {
    return Functions.callTelegramApi('answerCallbackQuery', options,
        function onSend(err, backMessage){
            if(err || backMessage.ok == false) return cb(err);
            return cb(null, backMessage);
        }
        );
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
    if(a.votes.length > b.votes.length)
        return -1;
    if(a.votes.length < b.votes.length)
        return 1;
    return 0;
};

var populateUserVotes = function(choices, actualIndex, choicesIndex, callback){
    var choice = choices[choicesIndex[actualIndex]];
    votesPopulate = [];
    //On recehrche tout les votes et on populate le user
    var votes = choice.votes;
    if(votes.length > 0){
        for(var i=0; i<votes.length; i++){
            var vote = votes[i];

            (function (innerVote){
                //On appelle l'api
                Functions.callTelegramApi('getChatMember', {chat_id: innerVote.chatId, user_id: vote.userId},
                    function onGet(err, data){
                        if(err) return callback(err);
                        if(data.ok == false) return callback(new Error('Error while finding user'));
                        var populatedVote = {
                            _id: innerVote._id,
                            _choice: innerVote._choice,
                            chatId: innerVote.chatId,
                            userId: innerVote.userId,
                            user: data.result.user
                        };
                        messageEvent.emit('populateChoiceUser', votes, populatedVote, function onOver(err, votes){
                            if(err) return callback(err);
                            //Tout les votes de ce choix ont été remplis
                            choices[choicesIndex[actualIndex]]['votes'] = votes;
                            if(actualIndex+1 < choicesIndex.length)
                                populateUserVotes(choices, actualIndex+1, choicesIndex, callback);
                            else
                                return callback(null, choices);
                        })
                    }
                    )
            })(vote);
        }
    }
    else{
        if(actualIndex+1<choicesIndex.length)
            populateUserVotes(choices, actualIndex+1, choicesIndex, callback);
        else
            return callback(null, choices);
    }
};
messageEvent.on('populateChoiceUser', function onPopulate(votes, vote, cb){
    votesPopulate.push(vote);
    if(votesPopulate.length == votes.length)
        return cb(null, votesPopulate);
});

messageEvent.on('populate', function onPopulate(choices, choice, cb){
    choicesPopulate.push(choice);
    if(choicesPopulate.length == choices.length){
        return cb(null, choicesPopulate);
    }
});

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
                if(commands.param[0] == 'price' && !/^[\d.]+$/.test(options.message.text) ){
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

            return Choice.constructKeyboard({choices: choices, chatType: options.chat.type}, function onBuild(err, keyboards){
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
        return Choice.getChoices({filter:{_poll: myPoll._id}},
            function onGet(err, choices){
                if(err) return callback(err);

                return Choice.constructKeyboard({choices: choices, chatType: options.chat.type},
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
                                if(typeof options.messageToSend.reply_markup != 'undefined'){
                                    options.messageToSave = new Models.message({
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
        var myPoll = options.poll;
        var commands = options.commands;

        /*
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
         */

        //On recupere le choix
        return Model.findOne({ordre: options.data, _poll: myPoll._id},
            function onFind(err, choiceFinded){
                if(err) return callback(err);

                var messageToSend = 'Ce choix a été supprimé';

                if(!choiceFinded)
                    return showPopUp({text: messageToSend, callback_query_id: options.queryId}, callback);

                var username = (typeof options.from.username === 'undefined')
                ? options.from['first_name'] + '' + options.from['last_name']: '@'+options.from.username;
                messageToSend = username+' a voté pour '+choiceFinded.name;

                //On recupere l'ancien vote si il y en a un
                return Models.vote.findOne({userId: options.from.id, chatId: options.chat.id},
                    function onFind(err, oldVote){
                        if(err) return callback(err);

                        if(oldVote) {
                            messageToSend = username + ' Vote modifié pour '+choiceFinded.name;
                            oldVote._choice = choiceFinded.id;
                        }else{
                            oldVote = new Models.vote({
                                userId: options.from.id,
                                chatId: options.chat.id,
                                _choice: choiceFinded.id
                            });
                        }

                        return oldVote.save({}, function onSave(err){
                            if(err) return callback(err);
                            return showPopUp({text: messageToSend, callback_query_id: options.queryId}, callback);
                        })
                    }
                    )
            }
            );
    },
    sendDetailsResult: function sendResult(options, callback){
        var Choice =this;
        this.init();

        return Choice.getChoices({filter:{_poll: options.poll._id}, populateVote: true, chatId: options.chat.id},
            function onGet(err, choices){
                if(err) return callback(err);
                if(choices.length == 0)  return callback(null, false);
                choices.sort(sortChoices);

                options.messageToSend = {
                    chat_id: options.chat.id,
                    reply_to_message_id: options.message.message_id,
                    parse_mode: 'HTML'
                } ;

                var stringText = '';
                var order = 1;
                var choicesIndex = [];

                for(var index in choices){
                    if(choices.hasOwnProperty(index)){
                        choicesIndex.push(index);
                    }
                }
                return populateUserVotes(choices, 0, choicesIndex,
                    function onPopulate(err, choices){
                        if(err) return callback(err);
                        //on parcours les votes et on construit notre texte
                        for(var index = 0; index < choicesIndex.length; index++){
                            var choice = choices[choicesIndex[index]];

                            stringText += '<pre>'+order + '. ' + choice.name+'</pre> ';
                            if(choice.votes.length > 0){
                                //On parcours les votes
                                for(var indexVote = 0; indexVote < choice.votes.length; indexVote++){
                                    var vote = choice.votes[indexVote];
                                    var username = vote.user['first_name']+' '+vote.user['last_name'];
                                    if(typeof  vote.user['username'] !== 'undefined')
                                        username = '@'+vote.user['username'];
                                    stringText += username +', ';
                                }
                            }else
                            stringText += 'Auncun Vote';
                            order++;
                        }
                        //On envoi le message
                        options.messageToSend.text = stringText;
                        return launchReturnMessage(options,
                            function onSend(err, messageSent){
                                if(err) return callback(err);
                                return callback(null, messageSent);
                            });
                    });
            }
            )

    },
    sendResults: function sendResults(options, cb){
        //On recupere les choices
        var Choice = this;
        return Choice.getChoices({filter:{_poll: options.poll._id}, populateVote: true, chatId: options.chat.id},
            function onGet(err, choices){
                if(err) return cb(err);

                if(choices){
                    choices.sort(sortChoices);
                }
                return Choice.constructKeyboard({choices: choices, mode: 'results', chatType: options.chat.type},
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

                                if(typeof options.messageToSend.reply_markup != 'undefined'){
                                    //not undefined on save
                                    options.messageToSave = new Models.message({
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
        var chatType = 'group';

        if(typeof options.mode != 'undefined')
            mode = options.mode;

        if(typeof options.chatType != 'undefined')
            chatType = options.chatType.toLowerCase();


        var choices = options.choices;
        var keyboards =[], keyboardLine = [];
        var nCol = Math.round(choices.length/5);
        var colActu = 1;
        var index = 1;

        for(var prop2 in choices){
            if(choices.hasOwnProperty(prop2)){
                var choice = choices[prop2];

                var name = (typeof choice.name == 'undefined') ?  '' : choice.name;
                var priceString = typeof choice.price == 'undefined' ? '#€' : choice.price+'€';
                var text = 'Votez : ' + name + ' - ' + priceString;
                var callback_data = String(choice.ordre);
                var obj = {text: text, callback_data: callback_data};

                if(mode == 'results'){
                    var votes = ' - ' + choice.votes.length +' Votes';
                    obj.text = index +'. '+ name + votes;
                    obj.callback_data = 'openLink';
                    if (typeof choice.link != 'undefined'){
                        obj.url = choice.link;
                    }
                }else if(mode == 'buttons'){
                    obj = {};
                    obj.text = choice.ordre +'/'+name;
                }

                keyboardLine.push(obj);
                colActu++;
                index++;
                if(colActu > nCol){
                    keyboards.push(keyboardLine);
                    colActu = 1;
                    keyboardLine = [];
                }
            }
        }

        if(keyboardLine.length > 0)
            keyboards.push(keyboardLine);

        if(chatType ==  'private'){
            //On ecrit des fonctions supplementaires
            var sendButton = {
                text: 'Send',
                callback_data: 'executeCommand/sendToGroup'
            }
            keyboardLine = [];
            keyboardLine.push(sendButton);
            keyboards.push(keyboardLine);
        }

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
        choicesPopulate = [];
        return Model.find(options.filter, function onFind(err, choices){
            if(err) return callback(err);
            if(!choices || typeof options['populateVote'] == 'undefined') return callback(null, choices);

            for(var index in choices){
                if(choices.hasOwnProperty(index)){
                    var choice = choices[index];
                    //Launch populate
                    (function (innerChoice){
                        Models.vote.find({chatId: options.chatId, _choice: innerChoice._id},
                            function onFind(err, votes){
                                if(err) return callback(err);
                                //Manual copy of data
                                var populatedChoice = {
                                    _id: innerChoice._id,
                                    _poll: innerChoice._poll,
                                    ordre: innerChoice.ordre,
                                    name: innerChoice.name,
                                    price: innerChoice.price,
                                    link: innerChoice.link,
                                    votes: votes
                                };
                                messageEvent.emit('populate', choices, populatedChoice,  callback);
                            });

                    })(choice);
                }
            }
        })
    },
    getChoice: function onGet(options, callback){
        if(typeof options.deleted == 'undefined')
            options.deleted = false;
        return Model
        .findOne(options)
        .exec(callback);
    },
    deleteChoice: function onLaunch(options, callback){
        this.init();
        var Choice = this;
        return Choice.getChoices({filter: {_poll: options.poll._id}, chatId:options.chat.id},
            function onGet(err, choices){
                if(err) return callback(err);
                return Choice.constructKeyboard({choices: choices, mode:'buttons', chatType: options.chat.type},
                    function onBuild(err, keyboards){
                        if(err) return callback(err);
                        if(keyboards.length > 0){
                            options.messageToSend = {
                                text: '<pre>Faites votre choix</pre>',
                                parse_mode: 'HTML',
                                chat_id: options.chat.id,
                                reply_markup: JSON.stringify({
                                    keyboard: keyboards
                                })
                            } ;
                        }else{
                            options.messageToSend = {
                                text: '<pre>Pas de choix a supprimer</pre>',
                                chat_id: options.chat.id,
                                reply_to_message_id: options.message.message_id,
                                parse_mode: 'HTML'
                            } ;
                        }

                        return launchReturnMessage({messageToSend:options.messageToSend},
                            function onSent(err, messageSent){
                                if(err) return callback(err);
                                if(typeof options.messageToSend.reply_markup != 'undefined'){
                                    //not undefined on save
                                    options.messageToSave = new Models.message({
                                        chatId: messageSent.result.chat.id,
                                        userId: options.from.id,
                                        Id: messageSent.result['message_id'],
                                        command: 'deleteChoiceReal'
                                    });
                                }
                                return saveNewMessage(options, callback);
                            })
                    })
            })
    },
    deleteChoiceReal: function onDelete(options, callback){
        this.init();
        var Choice = this;
        var commands = options.commands;

        //On met le message comme traiter
        var oldMessage = commands.dbMessage;
        oldMessage.treated = true;
        saveNewMessage({messageToSave: new Models.message(oldMessage)}, callback);

        //On extrait l'ordre
        var params = commands.param[0].match(/([^\/]+)/g);
        return Choice.getChoice({ordre: params[0], _poll: options.poll._id},
            function onFind(err, choice){
                if(err) return callback(err);
                var messageToSend = {
                    text: '<pre>Pas de choix a supprimer</pre>',
                    chat_id: options.chat.id,
                    reply_to_message_id: options.message.message_id,
                    parse_mode: 'HTML'
                };
                if(!choice) return launchReturnMessage({messageToSend: messageToSend}, callback);

                //Launch suppression
                choice.deleted = true;
                var updateChoice = new Model(choice);
                return updateChoice.save({}, function onSave(err, choiceSaved){
                    if(err) return callback(err);
                    messageToSend.text = '<pre>Choix supprimé</pre>';
                    return launchReturnMessage({messageToSend: messageToSend}, callback);
                })
            })
    }
};