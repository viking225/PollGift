/**
 * Created by Tanoh Kevin on 07/10/2016.
 */

 var Functions = require('../functions');
 var commandsJson = require('../config').commands;
 var EventEmitter = require('events').EventEmitter;
 var Models = require('./../models');
 var MessageModel = Models.message;
 var messageEvent = new EventEmitter();
 var debug = require('debug')('PollGiftBot:helpC');


 messageEvent.on('messageSent', function onSend(message, callback){
    return callback(null, message);
});

 messageEvent.on('error', function onErr(err, callback){
    return callback(err);
});

 var searchCommand  = function(options, cb){

    return MessageModel.findOne(options.filter,
        function onFind(err, messageFound){
            if(err) 
                return cb(err);
            if(!messageFound) 
                return cb(null, {command: 'notFound'});

            var returnVal = {
                command: messageFound.command,
                dbMessage: messageFound,
                param: []
            };

            var extractSubElement =  returnVal.command.match(/([^\/]+)/g);
            if(extractSubElement){
                returnVal.command = extractSubElement[0];
                for(var index=1; index<extractSubElement.length; index++){
                    if(extractSubElement[index])
                        returnVal.param.push(extractSubElement[index]);
                }
            }

            return cb(null, returnVal);
        });
};

var getCommandRegex = function onGet(command, callback){
    var myRegex = new RegExp('([^.@\/]+)','g');

    if(myRegex.test(command)){
        var result = command.match(myRegex);
        var command = result[0];
        result.splice(0,1);

        return callback(null, {command: command, param: result});
    }
    return callback(null, null);
};
module.exports =  {
    extractCommand: function extractCommand(options, callback){

        var myCommandRegex = /^executeCommand(\/.+)$/;
        var message = options.message;
        var messageId = null;

        //Prevoir une liste de commandes pouvant etre servies par luser
        var avUserCommands = ['/createpoll'];

        if(options.typeQuery == 'command'){
            var command = message.text;

            if(avUserCommands.indexOf(command) > -1){
                command = command.substring(1)
                return callback(null, {command: command, param: []});
            }

            return searchCommand({filter: {nextAction: true , userId: options.from.id, treated: false}},
                function onExtract(err, commandFound){
                    if(err) 
                        return callback(err);
                    debug(commandFound);

                    if(commandFound.dbMessage){
                        if(!commandFound.param)
                            commandFound.param = [message.text];
                        else
                            commandFound.param.push(message.text);

                        //On definit le message en treated
                        commandFound.dbMessage.treated = true;
                        commandFound.dbMessage.nextAction = false;

                        var newMessage = new Models.message(commandFound.dbMessage);
                        return newMessage.save({}, function onSave(err, savedMessage){
                            if(err)
                                return callback(err);
                            
                            debug(savedMessage);

                            return callback(null, commandFound);
                        })
                    }
                    return callback(null, null);
            })
            
        }else if(options.typeQuery == 'callback'){

            //On verfie si ce n'est pas un bouton qui execute une commande
            if(myCommandRegex.test(options.data)){
                var result = myCommandRegex.exec(options.data);
                return getCommandRegex(result[1], callback);
            }else{
                var messageId = message['message_id'];
                var chatId = message.chat.id;

                return searchCommand({filter:{Id: messageId, chatId: chatId, from: options.from.id, treated: false}},
                    function onExtract(err, commandFound){
                        if(err) return callback(err);
                        commandFound.param = options.data;
                        return callback(null, commandFound);
                    });
            }
        }
        return callback(null, {command: 'notFound'});
    },
    sendHelpMessage: function sendHelp(options, callback){

        var messageOptions = {
            text: '<pre>Commande inconnue. /help pour la liste des commandes </pre>',
            chat_id: options.chat.id,
            parse_mode: 'HTML'
        };

        if(options.commands.command == 'noRight'){
            var username = (typeof options.from.username === 'undefined')
            ? options.from['first_name'] + '' + options.from['last_name']: '@'+options.from.username;
            messageOptions.text = 'NOPE ! ' + username + '<pre>Vous n\'avez pas le droit de réaliser cette action </pre>';
        }

        if(options.commands.command == 'help') {
            var message = "<pre>Bonjour je suis le PollBot voici mes commandes: </pre> ";
            var commands;
            if(options.chat.type == 'private')
                commands = commandsJson['private']
            else
                commands = commandsJson['group'];

            for (var index in commands) {
                if (commands.hasOwnProperty(index)) {
                    var commandArray = commands[index];
                    message +=  '/' + commandArray['Command']+' '+commandArray['Description']+'. ';
                }
            }
            messageOptions.text = message;
        }

        return Functions.callTelegramApi('sendMessage', messageOptions,
            function onSend(err, backMessage){
                if (err) return messageEvent.emit('error', err, callback);
                return messageEvent.emit('messageSent', backMessage, callback);
            });

    },
    showNoLinkPopUp : function showPopUp(options, callback){
        var message = 'Pas de lien';
        var callBackOptions = {
            text: message,
            callback_query_id:  JSON.stringify(options.queryId)
        };

        return Functions.callTelegramApi('answerCallbackQuery', callBackOptions,
            function onSend(err, backMessage){
                if(err || backMessage.ok == false) return callback(err);
                return callback(null, backMessage);
            });
    },
    showMessage: function onShow(action, queryId, callback){
        var messageToSend = {
            text: '',
            callback_query_id: queryId
        };

        switch (action){
            case 'noPoll':
            messageToSend.text = 'Pas de Poll disponible pour cette action';
            break;
            case 'noChoice':
            messageToSend.text = 'Veuillez ajouter plus de choix';
            break;
            case 'pollAlready':
            messageToSend.text = 'Impossible un poll exite déja';
            break;
            case 'error':
            messageToSend.text = 'Une erreur interne est survenue';
            break;
            case 'buildingPoll':
            messageToSend.text = 'Le poll n\'est pas encore lancé!';
            break;
            case 'launchedPoll':
            messageToSend.text = username + ' <pre> Impossible Le poll est lancé</pre>';
            break;

        }

        return Functions.callTelegramApi('answerCallbackQuery', messageToSend,
            function onSend(err, backMessage){
                if (err) return messageEvent.emit('error', err, callback);
                return messageEvent.emit('messageSent', backMessage, callback); 
            });
    },
    answerInlineQuery: function sendAnswer(options, callback){
        var answerQuery = {
            inline_query_id: options.inline_query_id,
            results: JSON.stringify(options.pollInline),
            cache_time: 100
        }
        return Functions.callTelegramApi('answerInlineQuery', answerQuery,
            function onSend(err, backMessage){
                if(err|| backMessage.ok == false)
                    return callback(err);
                return callback(null, backMessage);
            });
    }
};
