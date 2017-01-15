/**
 * Created by Tanoh Kevin on 06/10/2016.
 */

var coreConfig = require('../config').default;
var request = require('request');
var requestURL = coreConfig.telegramURL + coreConfig.pathRequest;


module.exports = function callTelegram(func, options, cb){

    if(func == 'sendMessage' || func == 'editMessageText'){
        if(!options.hasOwnProperty('reply_markup')) {
            var ReplyKeyboardHide = {
                hide_keyboard: true
            };
            options.reply_markup = JSON.stringify(ReplyKeyboardHide);
        }
        if(!options.hasOwnProperty('disable_notification')){
            options.disable_notification = 'true';
        }
    }
    var getUrl = requestURL;
    getUrl += func;

    try{
        request.post({url:getUrl, formData: options},
            function optionalCallback(err, httpResponse, body) {
                if (err) 
                    return cb(err);
                return cb(null, JSON.parse(body));
            });
    }catch(e){
        return cb(e);
    }


};