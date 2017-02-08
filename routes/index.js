var express = require('express');
var request = require('request');
var coreConfig = require('../config').default;
var commandsJson = require('../config').commands;
var router = express.Router();
var Functions = require('../functions');
var controllers = require('../controllers');
var shortId = require('shortid');
var Help = controllers.help;
var Poll = controllers.poll;
var Choice = controllers.choice;
const https = require('https');
var debug = require('debug')('PollGiftBot:index');

router.post('/',
    function onCommandReceived(req, res){

        var options = {message: null};
        try{
            debug(req.body);
            if(req.body.message){
                options = {
                    message: req.body.message,
                    chat: req.body.message.chat,
                    from: req.body.message.from
                };
                options.typeQuery = 'command';
            }else if(req.body['callback_query']){
                options.message = req.body['callback_query'].message;
                options.from = req.body['callback_query'].from;
                options.chat = req.body['callback_query'].message.chat;
                options.data = req.body['callback_query'].data;
                options.queryId = req.body['callback_query'].id;
                options.typeQuery = 'callback';
            }else if(req.body['inline_query']){
                //Inline query case
                var inlineOptions = req.body['inline_query'];
                inlineOptions.update_id = req.body['update_id'];
                //Id for answer
                inlineOptions.inline_query_id = inlineOptions.id;

                //ON recherche tout les polls de ce monsieur et on les affiche 
                var myNameRegex = new RegExp(inlineOptions.query,'i');
                return Poll.getPolls({filter:{name: myNameRegex, userId: inlineOptions.from.id, deleted: false}, populate:true}, function(err, polls){
                    if(err)
                        return Help.showMessage('error', {command: 'reader', err: e, chatId: chatId},function () {return res.end()});

                    //On formatte le message de retour
                    return Poll.formatAnswerQuery({polls: polls}, function(err, pollInline){
                        if(err)
                            return Help.showMessage('error', {command: 'reader', err: e, chatId: chatId},function () {return res.end()});

                        inlineOptions.pollInline = pollInline;
                        return Help.answerInlineQuery(inlineOptions, function onSend(err, message){
                            if(err){
                                debug(err);
                                return res.end();
                            }
                                // return Help.showMessage('error', {command: 'reader', err: err, chatId: chatId},function () {return res.end()});
                            return res.end();

                        })
                    })
                });


            }
        }catch(e){
            debug(e);
            return res.end();
            var chatId = req.body.message.chat.id || req.body['callback_query'].message.chat.id;
            return Help.showMessage('error', {command: 'reader', err: e, chatId: chatId},
                function () {return res.end()});
        }

        if(options.message == null)
            return res.end();

        if(options.message['new_chat_participant'] || options.message['left_chat_participant'])
            return res.end();

        return Help.extractCommand(options, function onExtract(err, command){
            if(err) 
                return Help.showMessage('error', {command: 'extract', err: error, chatId: options.chat.id},function () {return res.end()});
            if(!command){
                debug('no command');
                res.end();
            }
            else{
                debug(command);

                options.commands = command;

                //On verifie selon le type de chat si on a droit aux functions
                if(options.chat.type != 'private'){
                    var authorisedCommands  = commandsJson['group'];
                    var inCommand = authorisedCommands.some(x => x['Command'].toUpperCase() == command.command.toUpperCase());
                    if(!inCommand)
                        return res.end();
                }
                return launchCommands(res, options);
            }
        });
    });

module.exports = router;

var launchCommands = function(res, options){

    var commands = options.commands;

    switch (commands.command) {
        case 'delete':

        if(!commands.param)
            return res.end();

        var poll_id = commands.param;

        return Poll.getPoll({_id: poll_id}, function onGetPoll(err, pollFinded) {
            if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                function () {return res.end()});
                if(!pollFinded){
                    return Help.showMessage('noPoll',{chatId: options.chat.id}, function onSend(err) {
                        if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                            function () {return res.end()});
                            return res.end();
                    })
                }
                options.poll = pollFinded;
                return Poll.launchDeletePoll(options, function onDel(err, message) {
                    if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                        function () {return res.end()});
                        if (!message) {
                            debug('No message');
                            return res.end();
                        }
                        return res.end();
                    });
            });
        break;

        case 'deleteConfirm':
        return Poll.delete(options, function onDel(err, message) {
            if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                function () {return res.end()});
                debug('confirm over');
            return res.end();
        });

        break;

        case 'createpoll':
        return Poll.getPoll({chatId: options.chat.id}, function onGetPoll(err, pollFinded) {
            if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                function () {return res.end()});

                if (pollFinded) {
                    return Help.showMessage('pollAlready',{chatId: options.chat.id}, function onSend(err) {
                        if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                            function () {return res.end()});
                            return res.end();
                    })
                }

                return Poll.createPoll(options, function onPollCreate(err, pollCreated) {
                    if (err) 
                        return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                            function () {return res.end()});

                    //Le poll est créer on demande la question
                    options.poll = pollCreated;
                    options.updateText = 'Poll created ! Now send me the question';
                    options.commands.command = 'setname';
                    
                    //On lance le message de saisie
                    return Poll.launchUpdateMessage(options, function onLaunch(err, message){
                        if(err)
                            return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                                function () {return res.end()});
                        return res.end();
                    })
                    return res.end();
                });
            });
        break;

        case 'add':

        if(!commands.param)
            return res.end();

        var poll_id = commands.param;
        return Poll.getPoll({_id: poll_id}, function onGetPoll(err, pollFinded) {
            if (err) 
                return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                    function () {return res.end()});

            options.poll = pollFinded;
            if (!pollFinded) {
                return Help.showMessage('noPoll',{chatId: options.chat.id}, function onSend(err) {
                    if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                        function () {return res.end()});
                        return res.end();
                })
            }
            if(pollFinded.type != 'building'){
                return Help.showMessage('launchedPoll', {from: options.from,chatId: options.chat.id},
                    function onSend(err){
                        if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                            function () {return res.end()});
                            return res.end();
                    })
            }
            return Choice.addChoice(options, function onAdd(err, choiceAdd) {
                if (err)
                    return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                        function () {return res.end()});

                    options.update_message = options.message.message_id;
                    return Choice.sendOptionsKeyboard(options, function onSend(err, message){
                        if(err)
                            return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                                function () {return res.end()});
                        return res.end();
                    })
            });
        });
        break;

        case 'launch':
        return Poll.getPoll({chatId: options.chat.id}, function onGetPoll(err, pollFinded) {
            if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                function () {return res.end()});
                if (!pollFinded) return Help.showMessage('noPoll',{chatId: options.chat.id}, function onSend(err) {
                    if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                        function () {return res.end()});
                        return res.end()
                });

                    options.poll = pollFinded;
                    if (pollFinded.type != 'building') {
                        return Help.showMessage('launchedPoll', {from: options.from,chatId: options.chat.id}, function onSend(err) {
                            if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                                function () {return res.end()});
                                return res.end();
                        })
                    }

                //On verifie qu'il existe des choix pour ce poll
                return Choice.getChoices({filter:{_poll: options.poll._id}},
                    function onGet(err, choices){
                        if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                            function () {return res.end()});

                            if(choices.length == 0){
                                return Help.showMessage('noChoice', {command: commands.command, chatId: options.chat.id},
                                    function () {return res.end()});
                            }

                        //On lance le poll
                        return Poll.launch(options, function onSend(err) {
                            if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                                function () {return res.end()});
                                return Choice.sendVoteInline(options, function onSend(err) {
                                    if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                                        function () {return res.end()});
                                        return res.end();
                                })
                        })
                    });
            });
        break;

        case 'setname':
        return Poll.getPoll({chatId: options.chat.id}, function onGetPoll(err, pollFinded){
            if (err) 
                return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                    function () {return res.end()});
            if (!pollFinded) {
                return Help.showMessage('noPoll', {chatId: options.chat.id}, function (err) {
                    if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                        function () {return res.end()});
                        return res.end()
                });
            }

            if(commands.param){
                var bFirstTime = false;
                options.poll = pollFinded;

                //Check si le name etait vide
                if(!options.poll.name)
                    bFirstTime = true;

                options.poll.name = commands.param;

                options.bFirstTime = bFirstTime;
                return Poll.updatePoll(options, function onUpdate(err, message){
                    if (err) 
                        return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                            function () {return res.end()});
                    if(bFirstTime){
                        //On affiche l'interface 
                        return Choice.sendOptionsKeyboard(options, function onSend(err, message){
                            if(err)
                                return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                                    function () {return res.end()});
                            debug('OPtion keyboard sent');
                            return res.end();
                        });
                    }
                    else
                        return res.end();  
                })
            }else{
                options.updateText = 'Saisir la nouvelle question';
                //On lance le message de saisie
                return Poll.launchUpdateMessage(options, function onLaunch(err, message){
                    if(err)
                        return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                            function () {return res.end()});
                    debug('message sent');
                    return res.end();
                })
            }
        });
        break;
        case 'modify':
        return Poll.getPoll({chatId: options.chat.id}, function onGetPoll(err, pollFinded) {
            if (err) 
                return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                    function () {return res.end()});
            if (!pollFinded) {
                return Help.showMessage('noPoll', {chatId: options.chat.id}, function (err) {
                    if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                        function () {return res.end()});
                        return res.end()
                });
            }

            if(pollFinded.type != 'building'){
                return Help.showMessage('launchedPoll', {from: options.from,chatId: options.chat.id}, function onSend(err) {
                    if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                        function () {return res.end()});
                        return res.end();
                })
            }
            options.poll = pollFinded;
            return Choice.sendModifyInline(options, function onSend(err, message) {
                if (err) 
                    return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                        function () {return res.end()});
                if (message) 
                    debug('Inline Message sended');
                return res.end();
            })
        });
        break;

        case 'detailsvote':
        return Poll.getPoll({chatId: options.chat.id}, function onGetPoll(err, pollFinded){
            if(err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                function(){return res.end()});

                if(!pollFinded){
                    return Help.showMessage('noPoll', {chatId: options.chat.id}, function (err) {
                        if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                            function () {return res.end()});
                            return res.end()
                    });
                }

                if(pollFinded.type != 'ready'){
                    return Help.showMessage('buildingPoll', {chatId: options.chat.id}, function(err){
                        if(err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                            function(){return res.end()});
                            return res.end();
                    });
                }
                options.poll = pollFinded;
                return Choice.sendDetailsResult(options, function onSend(err, message){
                    if(err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                        function(){return res.end()});
                        return res.end();
                })
            });
        break;

        case 'vote':
        //On verifie bien qu'on a des param 
        if(!commands.param)
            return res.end();
        return Poll.getPoll({_id: commands.param}, function onGetPoll(err, pollFinded) {
            if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                function () {return res.end()});
                if (!pollFinded) {
                    return Help.showMessage('noPoll',{chatId:options.chat.id}, function onSend(err) {
                        if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                            function () {return res.end()});
                            return res.end();
                    })
                }
                if (pollFinded.type != 'ready') {
                    return Help.showMessage('buildingPoll', {chatId: options.chat.id}, function onSend(err){
                        if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                            function () {return res.end()});
                            return res.end();
                    })
                }
                options.poll = pollFinded;
                return Choice.sendVoteInline(options, function onSend(err) {
                    if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                        function () {return res.end()});
                        return res.end();
                })
            });
        break;

        case 'voteChoice':
        return Poll.getPoll({chatId: options.chat.id}, function onGetPoll(err, pollFinded) {
            if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                function () {return res.end()});
                if (!pollFinded) {
                    return Help.showMessage({chatId: options.chat.id}, function onSend(err) {
                        if (err) debug('Error while sending no message');
                        return res.end();
                    })
                }
                if (pollFinded.type != 'ready') {
                    return Help.showMessage('buildingPoll', {chatId: options.chat.id}, function onSend(err){
                        if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                            function () {return res.end()});
                            return res.end();
                    })
                }
                options.poll = pollFinded;
                return Choice.saveVoteChoice(options,
                    function onVote(err, message) {
                        if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                            function () {return res.end()});
                            if (!message) debug('Save vote failed');
                        if (message) debug('Save vote success');

                        return res.end();
                    })
            });
        break;

        case 'results':
        return Poll.getPoll({chatId: options.chat.id}, function onGetPoll(err, pollFinded) {
            if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                function () {return res.end()});
                if (!pollFinded) {
                    return Help.showMessage('noPoll',{chatId: options.chat.id}, function onSend(err) {
                        if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                            function () {return res.end()});
                            return res.end();
                    })
                }
                options.poll = pollFinded;
                return Choice.sendResults(options, function onSend(err, message) {
                    if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                        function () {return res.end()});
                        if (message) debug('results sended');
                    return res.end();
                })
            });
        break;


        case 'noLinkOpen':
        return Help.showNoLinkPopUp(options, function onShown(err) {
            if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                function () {return res.end()});
                return res.end();
        });
        break;

        case 'deletechoice':
        return Poll.getPoll({chatId: options.chat.id}, function onGetPoll(err, pollFinded){
            if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                function () {return res.end()});
                if(!pollFinded){
                    return Help.showMessage('noPoll',{chatId:options.chat.id}, function onSend(err) {
                        if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                            function () {return res.end()});
                            return res.end();
                    })
                }
                if(pollFinded.type != 'building'){
                    return Help.showMessage('launchedPoll', {from: options.from,chatId: options.chat.id}, function onSend(err) {
                        if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                            function () {return res.end()});
                            return res.end();
                    })
                }
                options.poll = pollFinded;
                return Choice.deleteChoice(options, function onLaunch(err){
                    if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                        function () {return res.end()});
                        return res.end();
                })
            });
        
        case 'deleteChoiceReal':

        if(!commands.param)
            return res.end();

        var poll_id = commands.param;

        return Poll.getPoll({_id: poll_id}, function onGetPoll(err, pollFinded){
            if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                function () {return res.end()});
                if(!pollFinded){
                    return Help.showMessage('noPoll',{chatId:options.chat.id}, function onSend(err) {
                        if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                            function () {return res.end()});
                            return res.end();
                    })
                }
                if(pollFinded.type != 'building'){
                    return Help.showMessage('launchedPoll', {from: options.from,chatId: options.chat.id}, function onSend(err) {
                        if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                            function () {return res.end()});
                            return res.end();
                    })
                }

                options.poll = pollFinded;
                return Choice.deleteChoiceReal(options, function onLaunch(err){
                    if (err) 
                        return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                            function () {return res.end()});

                    options.update_message = options.message.message_id;
                    return Choice.sendOptionsKeyboard(options, function onSend(err, message){
                        if(err)
                            return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                                function () {return res.end()});
                        return res.end();
                    })
                })
            });
        break;
        
        case 'modifyChoice':

        debug('got in modify choice');
        return res.end();
        return Poll.getPoll({chatId: options.chat.id}, function onGetPoll(err, pollFinded) {
            if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                function () {return res.end()});
                if (!pollFinded) {
                    return Help.showMessage('noPoll',{chatId:options.chat.id}, function onSend(err) {
                        if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                            function () {return res.end()});
                            return res.end();
                    })
                }
                if(pollFinded.type != 'building'){
                    return Help.showMessage('launchedPoll', {from: options.from,chatId: options.chat.id}, function onSend(err) {
                        if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                            function () {return res.end()});
                            return res.end();
                    })
                }
                options.poll = pollFinded;
                return Choice.sendModifyInlineChoice(options, function onSend(err) {
                    if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                        function () {return res.end()});
                        debug('Inline Message sended');
                    return res.end();
                })
            });
        break;

        case 'modifyChoiceType':
        return Poll.getPoll({chatId: options.chat.id}, function onGetPoll(err, pollFinded) {
            if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                function () {return res.end()});
                if (!pollFinded) {
                    return Help.showMessage('noPoll',{chatId: options.chat.id}, function onSend(err) {
                        if (err) debug('Error while sending no message');
                        return res.end();
                    })
                }
                if(pollFinded.type != 'building'){
                    return Help.showMessage('launchedPoll', {from: options.from,chatId: options.chat.id}, function onSend(err) {
                        if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                            function () {return res.end()});
                            return res.end();
                    })
                }
                options.poll = pollFinded;
                return Choice.sendModifyInlineType(options, function onSend(err) {
                    if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                        function () {return res.end()});
                        return res.end();
                })
            });
        break;

        case 'saveAttr':
        return Poll.getPoll({chatId: options.chat.id}, function onGetPoll(err, pollFinded) {
            if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                function () {return res.end()});
                if (!pollFinded) {
                    return Help.showMessage('noPoll', {chatId: options.chat.id}, function onSend(err) {
                        if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                            function () {return res.end()});
                            return res.end();
                    })
                }
                if(pollFinded.type != 'building'){
                    return Help.showMessage('launchedPoll', {from: options.from,chatId: options.chat.id}, function onSend(err) {
                        if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                            function () {return res.end()});
                            return res.end();
                    })
                }
                options.poll = pollFinded;
                return Choice.saveAttr(options, function onSave(err) {
                    if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                        function () {return res.end()});
                        return res.end();
                })
            });
        break;

        case 'help':
        Help.sendHelpMessage(options, function onMessageSent(err, message) {
            if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                function () {return res.end()});
                if (!message) {
                    debug('No message sent');
                    return res.end();
                }
                debug('Help Message Sent');
                return res.end();
            });
        break;
        
        case 'noRight':
        Help.sendHelpMessage(options, function onMessageSent(err, message) {
            if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                function () {return res.end()});
                if (!message) {
                    debug('No message sent');
                    return res.end();
                }
                debug('Help Message Sent');
                return res.end();
            });
        break;
        default:
        res.end();
        break;
    }
};