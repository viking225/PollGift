/**
 * Created by Tanoh Kevin on 06/10/2016.
 */
var Models = require('./../models');
var MessageModel = Models.message;

module.exports = function extractCommand(message){

    var myRegex = /\/([^.@]+)(.+)$/;
    var command = message.text;
    var result = myRegex.exec(command);

    if(command || result){
        return  {
            command: result[1],
            param: result[2]
        };
    }else{
        //Onj check si c'est une reponse a un message
        if(message['reply_to_message']){
            var messageId = message['reply_to_message']._id;
            MessageModel.findOne({Id: messageId, chatId: message.chat.id}, function onFind(err, messageFound){

            });
        }
        return null;
    }


};