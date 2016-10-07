var express = require('express');
var request = require('request');
var coreConfig = require('../config').default;
var router = express.Router();
var Functions = require('../functions');
var controllers = require('../controllers');
var Help = controllers.help;
var Poll = controllers.poll;
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

        console.log('in post');
        options.command = command.command;
        console.log(req.body);

        debug('end here');
        return res.respond(200);

        if(command.command == 'incase'){

        }
        else if(command.command == 'createpoll'){

            return Poll.createPoll(options, function onPollCreate(err, poll){
                if(err){
                    debug('error While creating poll');
                    res.writeHead(err.statusCode);
                    return res.end();
                }else{
                    console.log(poll);
                    return res.end();
                }
            });
        }
        else{
            Help.sendHelpMessage(options, function onMessageSent(err, message){
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
