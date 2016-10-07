/**
 * Created by Tanoh Kevin on 29/09/2016.
 */
var uri = require('mongodb-uri');
var infra = require('./infra');

var mongo = infra['mongodb'];

module.exports = {
    uri: uri.format({
        username: mongo.username,
        password: mongo.password,
        hosts: mongo.hosts,
        database: mongo.name
    })
};
