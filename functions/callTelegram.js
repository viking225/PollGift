/**
 * Created by Tanoh Kevin on 06/10/2016.
 */

var coreConfig = require('../config').default;
var request = require('request');
var requestURL = coreConfig.telegramURL + coreConfig.pathRequest;


module.exports = function callTelegram(func, options, cb){

    requestURL += func;
    request.post({url:requestURL, formData: options},
        function optionalCallback(err, httpResponse, body) {
            if (err) return cb(err);
            return cb(null, body);
        });

};