var express = require('express');
var request = require('request');
var coreConfig = require('../config').default;
var router = express.Router();
var Functions = require('../functions');
var controllers = require('../controllers');
var Help = controllers.help;
var Poll = controllers.poll;
var Choice = controllers.choice;
const https = require('https');
var debug = require('debug')('PollGiftBot:index');

/* GET home page. */
router.get('/', function(req, res, next) {
    var requestURL = coreConfig.telegramURL + coreConfig.pathRequest + 'getMe';
    request(requestURL, function(err, response , body){
        if(err) return res.respond(err, response.statusCode);
        return res.respond(body);
    })
});

router.post('/',
    function onCommandReceived(req, res, next){

        var options = {
            message: null
        };

        try{
            if(req.body.message){
                options = {
                    message: req.body.message,
                    chat: req.body.message.chat
                };
                options.typeQuery = 'command';

            }else if(req.body['callback_query']){
                options.message = req.body['callback_query'].message;
                options.from = req.body['callback_query'].from;
                options.chat = req.body['callback_query'].message.chat;
                options.data = req.body['callback_query'].data;
                options.typeQuery = 'callback'
            }
        }catch(e){
            console.log(e);
            return res.end();
        }

        if(options.message == null){
            debug('No Text to ananlyse');
            return res.end();
        }

        if(options.message['new_chat_participant'] || options.message['left_chat_participant']){
            return res.end();
        }

        try {
            return Help.extractCommand(options, function onExtract(err, command){
                if(err){
                    debug('Error while extracting command');
                    res.writeHead(err.statusCode);
                    return res.end();
                }
                options.commands = command;
                launchCommands(res, options);
            });
        }catch (error){
            debug(error);
        }
    });

module.exports = router;

var launchCommands = function(res, options){

    var commands = options.commands;
    if(commands.command == 'incase'){
    }
    else if(commands.command == 'delete'){
        return Poll.launchDeletePoll(options, function onDel(err, pollInstance){
            if(err){
                console.log(err);
                debug('Error while deleting poll');
                res.writeHead(err.statusCode);
                return res.end();
            }
            if(!pollInstance){
                debug('Poll delete instance not launched');
                return res.end();
            }

            debug('Poll delete instance launched');
            return res.end();
        });
    }
    else if(commands.command == 'deleteConfirm'){
        return Poll.delete(options, function onDel(err, poll){
            if(err){
                debug('error while deleting poll');
                return res.end();
            }
            if(!poll){
                debug('Could not delete poll');
                return res.end();
            }
            debug('Poll deleted');
            return res.end();
        });
    }
    else if(commands.command == 'createpoll'){
        return Poll.createPoll(options, function onPollCreate(err, poll){
            if(err){
                debug('error While creating poll');
                res.writeHead(err.statusCode);
                return res.end();
            }
            if(!poll){
                debug('Poll Already Exist');
                return res.end();
            }

            debug('New Poll Created');
            return res.end();
        });
    }
    else if(commands.command == 'add'){
        //On va get le poll et verfier qu'il est dans le bon etat et que c'est la bonne personne qui veut faire la modif

        return Poll.getPoll({chatId: options.chat.id, type: 'building'} ,
            function onGetPoll(err, pollFinded){
                if(err){
                    debug('error while fetching Poll' +err);
                    return res.end();
                }

                options.poll = pollFinded;

                return Choice.addChoice(options, function onAdd(err, choiceAdd){
                    if(err) {
                        debug('error while adding Choice to poll' + err);
                        return res.end();
                    }
                    if(choiceAdd){
                        debug('Choice added');
                        return res.end();
                    }
                });
            });
    }else if(commands.command == 'modify'){
        //envoyer des commandes inline et sauvegarder les messages

        return Poll.getPoll({chatId: options.chat.id, type: 'building'},
            function onGetPoll(err, pollFinded){
                if(err){
                    debug('error while Fetching Poll'+err);
                    return res.end();
                }

                options.poll = pollFinded;
                return Choice.sendModifyInline(options, function onSend(err, message){
                        if(err){
                            debug('error while sending inline modify');
                            return res.end();
                        }

                        if(message){
                            debug('Inline Message sended');
                            return res.end();
                        }
                    }
                )
            }
        );
    }
    else if(commands.command == 'modifyChoice'){

        return Poll.getPoll({chatId: options.chat.id, type: 'building'}, function onGetPoll(err, pollFinded){
            if(err){
                debug('error while Fetching Poll'+err);
                return res.end();
            }

            options.poll = pollFinded;
            return Choice.sendModifyInlineChoice(options, function onSend(err, message){
                if(err) {
                    debug('error while sending inline modify'+err);
                    return res.end();
                }
                debug('Inline Message sended');
                return res.end();
            })
        })
    }else if(commands.command == 'modifyChoiceType'){
        return Poll.getPoll({chatId: options.chat.id, type: 'building'}, function onGetPoll(err, pollFinded){
            if(err){
                debug('error while Fetching poll'+err);
                return res.end();
            }

            options.poll = pollFinded;
            return Choice.sendModifyInlineType(options, function onSend(err, message){
                if(err){
                    debug('error while sending inline modify Type'+err);
                    return res.end();
                }
                debug('Inline Type Sended');
                return res.end();
            })
        });
    }else if(commands.command == 'saveAttr'){
        return Poll.getPoll({chatId: options.chat.id, type: 'building'}, function onGetPoll(err, pollFinded){
            if(err){
                debug('error while Fetching poll'+err);
                return res.end();
            }

            options.poll = pollFinded;
            return Choice.saveAttr(options, function onSave(err, choice) {
                if(err){
                    debug('error in SaveAttr '+err);
                    return res.end();
                }
                if(!choice){
                    debug('No choice to save');
                    return res.end();
                }

                debug('Choice Modified');
                return res.end();
            })
        })
    }
    else{
        Help.sendHelpMessage(options, function onMessageSent(err, message){
            if(err){
                debug('error while sending help');
                res.writeHead(err.statusCode);
                return res.end();
            }
            if(!message) {
                debug('No message sent');
                return res.end();
            }
            debug('Help Message Sent');
            return res.end();
        });
    }
};