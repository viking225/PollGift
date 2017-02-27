/**
 * Created by Tanoh Kevin on 16/10/2016.
 */

var mongoose = require('mongoose');
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

    if(typeof options['functionApi'] != "undefined" ) {
        func = options['functionApi'];
        options['functionApi'] = null;
    }
    
    return Functions.callTelegramApi(func, messageOptions,
        function onSend(err, backMessage){
                        debug(backMessage);

            if (err || backMessage.ok == false) 
                return cb(err);
            return cb(null, backMessage);
        });
};

var showPopUp = function onShow(options, cb) {
    return Functions.callTelegramApi('answerCallbackQuery', options,
        function onSend(err, backMessage){
            if(err || backMessage.ok == false) 
                return cb(err);
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

var launchSaveChoice = function(options, cb){
    //Save

    options['choiceFinded'][options.commands.param[2]] = options.text;
    var newChoice = new Model(options['choiceFinded']);

    return newChoice.save({}, function onSaveChoice(err, choiceSaved){
        if(err || !choiceSaved)
            return cb(new Error('Error while saving choice'));
        return cb(null, choiceSaved);
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

        return Model.findOne({ordre: commands.param[1], _poll: options.poll._id},
            function onFind(err, choiceFinded){
                if(err) 
                    return cb(err);
                
                if(!choiceFinded) 
                    return cb(null, choiceFinded);

                var messageToSend = {
                    text: '<pre>Echec de la modification</pre>',
                    parse_mode: 'HTML',
                };

                var functionApi = 'sendMessage';

                if(options.inline_message_id){
                    messageToSend.inline_message_id = options.inline_message_id;
                    functionApi = 'editMessageText';
                }else{
                    messageToSend.chat_id = options.chat.id
                }

                //controle en amont
                if(commands.param[0] == 'price' && !/^[\d.]+$/.test(options.message.text) ){
                    messageToSend.text = "Fuck you too :)";
                    return launchReturnMessage({messageToSend: messageToSend, functionApi: functionApi}, cb);
                }
                if(commands.param[0] == 'link'){
                    return request.get({url:options.message.text}, function(err, httpResponse, body){
                        if(err || httpResponse.statusCode != 200){
                            messageToSend.text = 'Lien non valide !';
                            return launchReturnMessage({messageToSend: messageToSend, functionApi: functionApi}, cb);
                        }
                        return launchSaveChoice({choiceFinded: choiceFinded, messageToSend: messageToSend, commands: commands, text: commands.param[3]}, cb);
                    });
                }else{
                    return launchSaveChoice({choiceFinded: choiceFinded, messageToSend: messageToSend, commands: commands, text: commands.param[3]}, cb);
                }
            });
        //On recupere le choice
    },
    sendModifyInlineType: function onSend(options, callback){
        this.init();
        //On extrait la commande
        var result = options.commands.param;
        var messageText = '';

        //On ecris un nouveau message
        if(result){
            switch (result[2]){
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

            var messageToSend = {
                text: messageText,
                parse_mode: 'HTML',
                reply_markup: JSON.stringify({
                    inline_keyboard: [[]],
                })
            };
            var functionApi = 'sendMessage';
            if(options.inline_message_id){
                messageToSend.inline_message_id = options.inline_message_id;
                functionApi = 'editMessageText';
            }
            else if(options.chat){
                messageToSend.chat_id = options.chat.id;
            }else{
                return callback(new Error('Failed on update'));
            }

            return launchReturnMessage({messageToSend: messageToSend, functionApi: functionApi }, function onSend(err, messageSent){
                if(err) 
                    return callback(err);

                //On save l'entree utilistauer attendue
                var idMessage = mongoose.Types.ObjectId();
                var messageToSave = new Models.message({
                    userId: options.from.id,
                    Id: idMessage,
                    command: 'saveAttr/'+result[0]+'/'+result[1]+'/'+result[2]+'/',
                    nextAction: true
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
        return Model.findOne({ordre: commands.param[1], _poll: options.poll._id},
            function onFind(err, choiceFinded){
                if(err) 
                    return callback(err);
                if(!choiceFinded) 
                    return showPopUp({text: "Choix inconnu", callback_query_id: options.queryId}, callback);

                //modify message and update info
                options.messageToSend = {
                    text: '<pre>Que Changer ?</pre>',
                    parse_mode: 'HTML',
                    reply_markup: JSON.stringify({
                        inline_keyboard: [
                        [{text: 'Nom', callback_data: 'executeCommand/modifyChoiceType/'+options.poll._id+'/'+choiceFinded.ordre+'/name'}],
                        [{text: 'Prix', callback_data: 'executeCommand/modifyChoiceType/'+options.poll._id+'/'+choiceFinded.ordre+'/price'}],
                        [{text: 'Lien', callback_data: 'executeCommand/modifyChoiceType/'+options.poll._id+'/'+choiceFinded.ordre+'/link'}]
                        ],
                    })
                } ;

                if(!options.inline_message_id){
                    options.messageToSend.chat_id = options.chat.id; 
                    options.messageToSend.message_id =  options.message.message_id;
                }else{
                    options.messageToSend.inline_message_id = options.inline_message_id;
                }

                options['functionApi'] = 'editMessageText';

                return launchReturnMessage(options, function onSend(err, messageSent){
                    if(err) 
                        return callback(err);                    
                    return callback(null, messageSent);
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
                        options.functionApi = 'editMessageText';
                        if(keyboards.length > 0){
                            options.messageToSend = {
                                text: '<b>Votez</b>',
                                parse_mode: 'HTML',
                                chat_id: options.chat.id,
                                reply_markup: JSON.stringify({
                                    inline_keyboard: keyboards
                                })
                            } ;
                        }else{
                            options.messageToSend = {
                                text: '<b>Veuillez ajouter plus de choix</b>',
                                chat_id: options.chat.id,
                                parse_mode: 'HTML'
                            } ;
                        }
                        options.messageToSend.message_id = options.message.message_id;


                        return launchReturnMessage(options,
                            function onSend(err, messageSent){
                                if(err) return callback(err);
                                if(typeof options.messageToSend.reply_markup != 'undefined'){
                                    options.messageToSave = new Models.message({
                                        chatId: messageSent.result.chat.id,
                                        Id: messageSent.result['message_id'],
                                        command: 'voteChoice/' + myPoll._id
                                    });
                                }
                                return saveNewMessage(options, callback);
                            });
                    });
            });
    },
    saveVoteChoice: function onSave(options, callback){
        this.init();
        var Choice = this;
        var myPoll = options.poll;
        var commands = options.commands;

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
    sendOptionsKeyboard: function sendOptions(options, callback){
        var Choice = this;
        return Choice.getChoices({filter:{_poll: options.poll.id, deleted: 0}}, 
            function onGet(err, choices){
                if(err)
                    return callback(err);

                var updateMessage = false;
                if(typeof options.update_message != "undefined"){
                    updateMessage = options.update_message;
                }

                return Choice.constructKeyboard({choices: choices, mode: 'options', chatType: 'private', poll_id: options.poll.id, sendName: options.poll.name}, 
                    function onConstruct(err, keyboards){
                        if(err)
                            return callback(err);

                        options.messageToSend ={
                            text: '<b>' + options.poll.name + '</b>',
                            parse_mode: 'HTML',
                            reply_markup: JSON.stringify({
                                inline_keyboard: keyboards
                            })
                        }

                        if(options.inline_message_id){
                            options.messageToSend.inline_message_id = options.inline_message_id;
                        }else{
                            options.messageToSend.message_id = options.message.message_id;
                            options.messageToSend.chat_id = options.chat.id;
                        }

                        if(updateMessage){
                            options['functionApi'] = 'editMessageText';
                        }
                        return launchReturnMessage(options, function onSend(err, backMessage){
                            if(err)
                                return callback(err);
                            return callback(null, backMessage);
                        })
                    })
            })
    },
    sendResults: function sendResults(options, cb){
        //On recupere les choices
        var Choice = this;
        return Choice.getChoices({filter:{_poll: options.poll._id}, populateVote: true},
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

        if(typeof options.poll_type != 'undefined' && options.poll_type=='building'){
            mode = 'options';
        }


        var choices = options.choices;

        var keyboards =[], keyboardLine = [];
        var nCol = Math.round(choices.length/5);
        var colActu = 1;
        var index = 1;
        var poll_id = options.poll_id;

        for(var prop2 in choices){
            if(choices.hasOwnProperty(prop2)){
                var choice = choices[prop2];

                var name = (typeof choice.name == 'undefined') ?  '' : choice.name;
                var priceString = typeof choice.price == 'undefined' ? '#€' : choice.price+'€';
                var text = name + ' - ' + priceString;
                var callback_data = 'executeCommand/voteChoice/' + String(choice.ordre);
                var obj = {text: text, callback_data: callback_data};

                if(mode == 'options'){
                    //modification
                    keyboardLine.push({
                        text: '✍🏿',
                        callback_data: 'executeCommand/modifyChoice/'+ poll_id + '/' + choice.ordre
                    });

                    keyboardLine.push({
                        text: '❌',
                        callback_data: 'executeCommand/deleteChoiceReal/'+ poll_id + '/' + choice .ordre
                    });
                }else{
                    keyboardLine.push({
                        text: '👾',
                        callback_data: 'openLink',
                        url: choice.link
                    });
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

        if(mode ==  'options'){
            //On ecrit des fonctions supplementaires
            keyboardLine = [];

            //Bontoun d'ajout de choix
            var addButton = {
                text: 'Add choice',
                callback_data: 'executeCommand/add/'+poll_id
            };
            keyboardLine.push(addButton);

            var setNameButton = {
                text: 'Change Question',
                callback_data: 'executeCommand/setname/'+poll_id
            }
            keyboardLine.push(setNameButton);

            //push options buttons
            keyboards.push(keyboardLine);
            keyboardLine = [];

            //Bouton de suppression
            keyboardLine.push({
                text: 'Delete Poll',
                callback_data: 'executeCommand/delete/'+poll_id
            });

            keyboards.push(keyboardLine);
            keyboardLine = [];

            if(typeof options['sendName'] != 'undefined'){
                var sendButton = {
                    text: 'Send',
                    switch_inline_query: options['sendName']
                }
                keyboardLine.push(sendButton);
            }

            if(keyboardLine.length > 0)
                keyboards.push(keyboardLine);
        }

        return callback(null, keyboards);
    },
    addChoice: function onAdd(options, callback){
        this.init();
        var Choice = this;

        var myPoll = options.poll;

        return Model.count({_poll: myPoll._id}, function onCount(err, count){
            if(err) 
                return callback(err);
            count++;
            var newChoice = new Model({
                ordre: count,
                _poll: myPoll._id
            });

            return newChoice.save({},function onSave(err, choiceSaved){
                if(err) return callback(err);

                return showPopUp({text: 'Choice N° ' + count + ' added', callback_query_id: options.queryId}, 
                    function onMessageSend(err, messageSent){
                        if(err)
                            return callback(err)
                        return callback(null, choiceSaved);
                    }
                );
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
                        Models.vote.find({_choice: innerChoice._id},
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
        var order = commands.param[1];

        //On extrait l'ordre
        return Choice.getChoice({ordre: order, _poll: options.poll._id},
            function onFind(err, choice){
                if(err) 
                    return callback(err);

                if(!choice) 
                    return showPopUp({text: "Pas de choix a supprimer", callback_query_id: options.queryId}, callback);

                //Launch suppression
                choice.deleted = true;
                var updateChoice = new Model(choice);
                return updateChoice.save({}, function onSave(err, choiceSaved){
                    if(err) 
                        return callback(err);
                    return showPopUp({text: "Choix n°" + order + " supprimé", callback_query_id: options.queryId}, callback);
                })
            })
    }
};