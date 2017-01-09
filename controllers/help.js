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

    return MessageModel.findOne({Id: options.messageId, chatId: options.chatId, treated: false},
        function onFind(err, messageFound){
            if(err) return cb(err);
            if(!messageFound) return cb(null, {command: 'notFound'});

            if(typeof messageFound.userId != 'undefined') {
                if (messageFound.userId != options.from.id)
                    return cb(null, {command: 'noRight'});
            }

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
    var myRegex = /\/([^.@]+)(.*)$/;

    if(myRegex.test(command)){
        var result = myRegex.exec(command);
        return callback(null, {command: result[1], param: result[2]});
    }
    return callback(null, null);
};
module.exports =  {
    extractCommand: function extractCommand(options, callback){

        var message = options.message;
        var messageId = null;
        if(options.typeQuery == 'command'){
            var command = message.text;

            if(message.hasOwnProperty('reply_to_message')){
                messageId = message['reply_to_message']['message_id'];

                return searchCommand({messageId :messageId, chatId: message.chat.id, from: message.from},
                    function onExtract(err, commandFound){
                        if(err) return callback(err);
                        if(commandFound){
                            if(!commandFound.param)
                                commandFound.param = [message.text];
                            else
                                commandFound.param.push(message.text);
                            return callback(null, commandFound);
                        }
                        return getCommandRegex(command, callback);
                    })
            }else{
                return getCommandRegex(command, callback);
            }
        }else if(options.typeQuery == 'callback'){
            messageId = message['message_id'];
            var chatId = message.chat.id;

            //On verfie si ce n'est pas un bouton qui execute une commande
            var myCommandRegex = /^executeCommand(\/.+)$/;
            if(myCommandRegex.test(options.data)){
                var result = myCommandRegex.exec(options.data);
                return getCommandRegex(result[1], callback);
            }else{
                return searchCommand({messageId: messageId, chatId: chatId, from: options.from},
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
            callback_query_id:  options.queryId
        };

        return Functions.callTelegramApi('answerCallbackQuery', callBackOptions,
            function onSend(err, backMessage){
                if(err || backMessage.ok == false) return callback(err);
                return callback(null, backMessage);
            }
            );
    },
    showMessage: function onShow(action, options, callback){
        var messageToSend = {
            text: '<pre>Commande inconnue. /help pour la liste des commandes </pre>',
            chat_id: options.chatId,
            parse_mode: 'HTML'
        };

        switch (action){
            case 'noPoll':
            messageToSend.text = '<pre>Pas de Poll disponible pour cette action</pre>';
            break;
            case 'noChoice':
            messageToSend.text = '<pre>Veuillez ajouter plus de choix</pre>';
            break;
            case 'pollAlready':
            messageToSend.text = '<pre>Impossible un poll exite déja</pre>';
            break;
            case 'error':
            messageToSend.text = '<pre>Une erreur interne est survenue</pre>';
            debug('Error: '+options.command+' '+options.err);
            break;
            case 'buildingPoll':
            messageToSend.text = '<pre>Le poll n\'est pas encore lancé! : </pre>/launch';
            break;
            case 'launchedPoll':
            var username = (typeof options.from.username === 'undefined')
            ? options.from['first_name'] + '' + options.from['last_name']: '@'+options.from.username;
            messageToSend.text = username + ' <pre> Impossible Le poll est lancé</pre>';
            break;

        }

        return Functions.callTelegramApi('sendMessage', messageToSend,
            function onSend(err, backMessage){
                if (err) return messageEvent.emit('error', err, callback);
                return messageEvent.emit('messageSent', backMessage, callback); 
            });
    }
};
