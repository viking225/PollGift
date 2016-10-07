/**
 * Created by Tanoh Kevin on 07/10/2016.
 */

var Functions = require('../functions');
var commandsJson = require('../config').commands;
var EventEmitter = require('events').EventEmitter;
var messageEvent = new EventEmitter();

module.exports =  {
    sendHelpMessage: function sendHelp(options, callback){

        var messageOptions = {};
        var message = '<pre>Commande inconnue voici mes commandes: </pre>';

        messageEvent.on('messageSent', function onSend(message){
            return callback(null, message);
        });

        messageEvent.on('error', function onErr(err){
            console.log('laucn err');
            return callback(err);
        });

        if(options.command == 'help')
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

        Functions.callTelegramApi('sendMessage', messageOptions,
            function onSend(err, backMessage){
                if (err) return messageEvent.emit('error', err);
                return messageEvent.emit('messageSent', backMessage);
            });

    }
};
