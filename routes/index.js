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

        if(!options.message.text){
            debug('No Text to ananlyse');
            return res.end();
        }

        try {
            return Help.extractCommand(options.message, function onExtract(err, command){
                if(err){
                    debug('Error while extracting command');
                    res.writeHead(err.statusCode);
                    return res.end();
                }
                debug(command);
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
    }else if(commands.command == 'deleteConfirm'){
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