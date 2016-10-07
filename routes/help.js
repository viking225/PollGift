/**
 * Created by Tanoh Kevin on 25/09/2016.
 */
var express =  require('express');
var router = express.Router();
var http = require('http');
var config = require('../config');
var EventEmitter = require('events').EventEmitter();
var fs = require('fs');
var FormData = require('form-data');

/*List All Function available*/
router.get('/',
    function showCommands(req, res, next){
        res.render('help', {commands: config.commands});
    }
);

module.exports = router;