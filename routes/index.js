var express = require('express');
var request = require('request');
var coreConfig = require('../config').default;
var commandsJson = require('../config').commands;
var router = express.Router();
var Functions = require('../functions');
var controllers = require('../controllers');
var Help = controllers.help;
var Poll = controllers.poll;
var Choice = controllers.choice;
const https = require('https');
var debug = require('debug')('PollGiftBot:index');

router.post('/',
    function onCommandReceived(req, res){

        var options = {message: null};
        try{            
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
            }
        }catch(e){
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
                res.end();
            }
            else{
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
        return Poll.getPoll({chatId: options.chat.id}, function onGetPoll(err, pollFinded) {
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

                return Poll.createPoll(options, function onPollCreate(err, message) {
                    if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                        function () {return res.end()});
                        return res.end();
                });
            });
        break;

        case 'add':
        return Poll.getPoll({chatId: options.chat.id}, function onGetPoll(err, pollFinded) {
            if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
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
                if (err) {
                    debug('error while adding Choice to poll' + err);
                    return res.end();
                }
                if (choiceAdd) {
                    debug('Choice added');
                    return res.end();
                }
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

        case 'sendToGroup': 
        return Poll.getPoll({chatId: options.chat.id}, function onGetPoll(err, pollFinded){
            if(err) 
                return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                    function() {return res.end()});
            if(!pollFinded){
                return Help.showMessage('noPoll', {chatId: options.chat.id}, function (err) {
                    if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                        function () {return res.end()});
                        return res.end()
                });
            }

            options.poll = pollFinded;
            return Poll.sendToGroup(options, function onSend(err, message){
                if(err)
                    return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                        function () {return res.end()});
                return res.end();
            })


        })
        return res.end();
        break;

        case 'modify':
        return Poll.getPoll({chatId: options.chat.id}, function onGetPoll(err, pollFinded) {
            if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
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
                }
                )
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
                return Choice.deleteChoiceReal(options, function onLaunch(err){
                    if (err) return Help.showMessage('error', {command: commands.command, err: err, chatId: options.chat.id},
                        function () {return res.end()});
                        return res.end();
                })
            });
        break;
        case 'modifyChoice':
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