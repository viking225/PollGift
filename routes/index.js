var express = require('express');
var request = require('request');
var coreConfig = require('../config').default;
var router = express.Router();
var Functions = require('../functions');
var controllers = require('../controllers');
var Help = controllers.help;
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
        var options = {message: req.body.message, chat: req.body.message.chat};
        var command = Functions.getCommand(options.message.text);

        options.command = command.command;

        if(command.command == 'incase'){

        }
        else{
            return Help.sendHelpMessage(options, function onMessageSent(err, message){
                if(err){
                    debug('error while sending help');
                    res.writeHead(err.statusCode);
                    return res.end();
                }else {
                    debug('Help Message Sent');
                    return res.end();
                }
            });
        }
    });

module.exports = router;
