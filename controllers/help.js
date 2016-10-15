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

module.exports =  {
    extractCommand: function extractCommand(message, callback){

        var myRegex = /\/([^.@]+)(.+)$/;
        var command = message.text;

        if(myRegex.test(command)){
            var result = myRegex.exec(command);
            return callback(null, {command: result[1], param: result[2]});
        }else{
            if(message.hasOwnProperty('reply_to_message')){
                var messageId = message['reply_to_message']['message_id'];

                return MessageModel.findOne({Id: messageId, chatId: message.chat.id, treated: false}, function onFind(err, messageFound){
                    if(err) return callback(err);
                    if(!messageFound) return callback(null, {command: 'help'});
                    var returnVal = {
                        command: messageFound.command,
                        param: message.text,
                        dbMessage: messageFound
                    };
                    return callback(null, returnVal);
                });
            }

        }
        return callback(null, {command: 'help'});
    },
    sendHelpMessage: function sendHelp(options, callback){

        var messageOptions = {};
        var message = '<pre>Commande inconnue voici mes commandes: </pre>';

        if(options.commands.command == 'help')
            message = "<pre>Bonjour je suis le PollBot voici mes commandes: </pre> ";

        for(var index in commandsJson){

            if(commandsJson.hasOwnProperty(index)){
                var commandArray = commandsJson[index];

                message += '<pre>' + commandArray['Command'] + ' </pre> ';
                message += commandArray['Description'] + ' ';
            }
        }

        messageOptions.text = message;
        messageOptions.chat_id = options.chat.id;
        messageOptions.parse_mode = 'HTML';
        messageOptions

        Functions.callTelegramApi('sendMessage', messageOptions,
            function onSend(err, backMessage){
                if (err) return messageEvent.emit('error', err, callback);
                return messageEvent.emit('messageSent', backMessage, callback);
            });

    }
};
