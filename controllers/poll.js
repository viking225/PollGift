/**
 * Created by Tanoh Kevin on 29/09/2016.
 */
 var Models = require('./../models');
 var Model = Models.poll;
 var EventEmitter = require('events').EventEmitter;
 var messageEvent = new EventEmitter();
 var Functions = require('../functions');
 var debug = require('debug')('PollGiftBot:pollC');
 var ChoiceController = null;
 var pollsPopulate = null;


 var launchReturnMessage = function onCreate(cb, options){
    var messageOptions = options.messageToSend;

    return Functions.callTelegramApi('sendMessage', messageOptions,
        function onSend(err, backMessage){
            if (err) return cb(err);
            if(backMessage.ok == false)
                return cb(new Error(backMessage.description));
            return cb(null, backMessage);
        });
};

var saveNewMessage = function onSave(options, cb){
    var messageToSave = options['messageToSave'];

    return messageToSave.save({}, function onSave(err, savedMessage){
        if(err) return cb(err);
        return cb(null, savedMessage)
    })
};

var deleteMyPoll = function deleteMyPoll(Poll, options, cb){
    return Poll.getPoll({chatId: options.chat.id}, function onFind(err, pollFinded){
        if(err) return cb(err);
        if(!poll)
            return cb(null);

        if(options.commands.param[0].toLowerCase() == 'y'){
            pollFinded.deleted = true;
            var updatePoll = Model(pollFinded);

            return updatePoll.save(options, function onSave(err, savedPoll){
                if(err) return cb(err);
                options.poll = savedPoll;
                options.messageToSend = {
                    text: '<pre>Poll deleted , Bye Bye result</pre>',
                    chat_id: options.chat.id,
                    parse_mode: 'HTML'
                } ;
                return launchReturnMessage(cb, options);
            });
        }
        else{
            return cb(null)
        }

    });
};

var formatMessage = function(polls, cb){
    var results = [];
    var compteur = 0;

    //Le sticker de creattion de nouveau messaeg
    compteur ++;
    var obj = {
        type: 'sticker',
        id: compteur+'',
        sticker_file_id: 'BQADBAADaAADsZotA08J7aKo7J64Ag',
        input_message_content: {
            message_text: '/createpoll'
        }
    }
    results.push(obj);

    //on parcours les polls
    for(var index in polls){
        if(polls.hasOwnProperty(index)){
            compteur++;
            var poll = polls[index];
            var question_text = poll.name.length > 1 ? poll.name : 'Votez !';
            var input_message_content = {
                message_text: '<b>'+ question_text +'</b>',
                parse_mode: 'HTML'
            }

            var reply_markup = {
                inline_keyboard: poll.keyboards
            }

            var obj = {
                type: 'article',
                id: compteur+'',
                title: poll.name,
                description: '',
                input_message_content: input_message_content,
                reply_markup: reply_markup
            }
            results.push(obj);
        }
    }
    return cb(null, results);
}

var poll = {
    init: function onInit(){
        poll.ChoiceController = require('./choice');
        pollsPopulate = null;
        return true;
    },
    launchUpdateMessage: function launchMessage(options, cb){
        var Poll = this;
        Poll.init();

        options.messageToSend = {
            text: options.updateText,
            parse_mode: 'HTML',
            chat_id: options.chat.id,
            reply_markup: JSON.stringify({
                force_reply: true
            })
        };

        return launchReturnMessage(function onSend(err, backMessage){
            if(err)
                return cb(err);

            //save new message en attente
            var messageToSave = new Models.message({
                userId: options.from.id,
                chatId: options.messageToSend.chat_id,
                Id: backMessage.result['message_id'],
                command: options.commands.command + '/'
            });

            return saveNewMessage({messageToSave: messageToSave}, cb);
        }, options);
    },
    updatePoll: function updatePoll(options, cb){
        var Poll = this;
        Poll.init();

        var pollToSave = new Model(options.poll);
        return pollToSave.save({}, function onSave(err, savedPoll){
            if(err)
                return cb(err);
            if(!savedPoll)
                return (null, null);

            if(options.bFirstTime)
                return cb(null, savedPoll);
            
            options.messageToSend = {
                text: 'Poll mis a jour',
                chat_id: options.chat.id,
                parse_mode: 'HTML'
            }
            return launchReturnMessage(cb, options);
        });
    },
    createPoll: function createPoll(options, cb) {
        var Poll = this;
        Poll.init();
        return Poll.getPoll({chatId: options.chat.id},
            function onFind(err, poll){
                if(err) return cb(err);
                if(poll) {
                    options.poll = null;
                    options.messageToSend = {
                        text: '<pre>Un poll existe deja pour ce groupe veuillez le supprimer avant</pre>',
                        chat_id: options.chat.id,
                        parse_mode: 'HTML'
                    } ;
                    return launchReturnMessage(cb, options);
                }

                var newPoll = new Model({
                    chatId: options.chat.id,
                    userId: options.message.from.id
                });

                newPoll.save({}, function onSave(err, savedPoll){
                    if(err)
                        return cb(err);
                    return cb(null, savedPoll);
                });
            }
            );
    },
    delete: function deletePoll(options, cb){
        var Poll = this;
        Poll.init();

        //On met le message comme treated
        options.messageToSave = options.commands.dbMessage;
        options.messageToSave.treated = true;

        return saveNewMessage(options, function onMessageSaved(err, savedMessage){
            if(err) return cb(err);
            return deleteMyPoll(Poll, options, cb);
        });
    },
    launch: function launchPoll(options, cb){
        var Poll = this;
        Poll.init();

        options.poll.type = 'ready';
        var newPoll = new Model(options.poll);
        return newPoll.save({}, function onSave(err, savedVote){
            if(err) return cb(err);
            if(!savedVote) return cb(new Error('Pas de sauvegarde du vote'));

            var messageToSend = {
                text: '<pre>Le Poll est lancé !</pre>',
                chat_id: options.chat.id,
                parse_mode: 'HTML'
            } ;

            return launchReturnMessage(function(err, message){
                if(err) return cb(err);
                return cb(null, message);
            }, {messageToSend: messageToSend});
        });
    },
    launchDeletePoll: function launchDeletePoll(options, cb){
        var Poll = this;
        Poll.init();

        if(!options.poll){
            return cb(new Error('No Poll passed'));
        }
        var poll = options.poll;

        var reply_markup = JSON.stringify({
            inline_keyboard: [
            [{text: 'Oui', callback_data: 'Y'}],
            [{text: 'Non', callback_data: 'N'}],
            ],
            one_time_keyboard: true
        });

        var messageOptions = {
            text: '<pre>Voulez vous vraiment supprimer le poll actif ?</pre>',
            chat_id: options.chat.id,
            parse_mode: 'HTML',
            reply_markup: reply_markup
        } ;
        return launchReturnMessage(function(err, messageSent){
            if(err)
                return cb(err);
            options.messageToSave = new Models.message({
                chatId: messageSent.result.chat.id,
                userId: options.message.from.id,
                Id: messageSent.result['message_id'],
                command: 'deleteConfirm'
            });
            return saveNewMessage(options, cb);
        }, {messageToSend: messageOptions})
    },
    getPoll: function getPoll(options, callback){
        if(typeof options.deleted == "undefined")
            options.deleted = false;
        return Model
        .findOne(options)
        .exec(callback);
    },
    getPolls: function(options, cb){
        var Poll = this;
        Poll.init();

        var populate = false;
        if(typeof options.populate != 'undefined')
            populate = options.populate;
        return Model.find(options.filter, function onFind(err, polls){
            if(err)
                return cb(err);

            if(polls[0] != null){
                if(!populate)
                    return cb(null, polls);

                pollsPopulate = [];
                for(var index in polls){
                    if(polls.hasOwnProperty(index)){
                        var poll = polls[index];

                        (function (innerPoll){
                            //On recherche les choix pour ce poll sans populate les vols
                            Poll.ChoiceController.getChoices({filter:{_poll: poll._id}}, function onFind(err, choices){
                                if(err)
                                    return cb(err);
                                var populatedPoll = {
                                    _id: innerPoll._id,
                                    type: innerPoll.type,
                                    name: innerPoll.name,
                                    userId: innerPoll.userId,
                                    birthday: innerPoll.birthday,
                                    choices: choices
                                }

                                Poll.populatePoll(polls.length, populatedPoll, cb);
                            })
                        })(poll);
                    }
                }
            }else
                return cb(null, null);
        })
    },
    populatePoll: function onPopulate(pollsLength, poll, callback){
        pollsPopulate.push(poll);
        if(pollsPopulate.length == pollsLength)
            return callback(null, pollsPopulate);
    },
    formatAnswerQuery: function onFormat(options, cb){
    var Poll = this;
        Poll.init()
        var polls = options.polls;
        var inlinePolls = [];

        pollsPopulate = [];
        if(!polls)
            return formatMessage(polls, cb);

        for(var index in polls){
            if(polls.hasOwnProperty(index)){
                var poll = polls[index];

                (function (innerPoll){
                    //On rempli chaque poll avec les choix possibles
                    Poll.ChoiceController.constructKeyboard({choices: innerPoll.choices, chatType: 'private', sendName: innerPoll.name}, 
                        function onBuild(err, keyboards){
                            if(err)
                                return cb(err);
                            var populatePoll = {
                                _id: innerPoll._id,
                                type: innerPoll.type,
                                name: innerPoll.name,
                                userId: innerPoll.userId,
                                birthday: innerPoll.birthday,
                                choices: innerPoll.choices,
                                keyboards: keyboards
                            }

                            Poll.populatePoll(polls.length, populatePoll, function onMerge(err, pollsPopulate){
                                if(err)
                                    return cb(err);
                                debug('merged');
                                formatMessage(pollsPopulate, cb);
                            });
                        })

                })(poll);

            }
        }
    }
};

module.exports = poll;