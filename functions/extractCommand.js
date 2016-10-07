/**
 * Created by Tanoh Kevin on 06/10/2016.
 */

module.exports = function extractCommand(string){

    var myRegex = /\/([^.@]+)(.+)$/;
    var result = myRegex.exec(string);
    return {
        command: result[1],
        param: result[2]
    };
};