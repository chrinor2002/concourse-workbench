const Hapi = require('hapi');
const Inert = require('inert');
const h2o2 = require('h2o2');
const Wreck = require('wreck');
const good = require('good');
const _ = require('lodash');
const url = require('url');

const baseForward = {
    protocol: process.env.CONCOURSE_URL_PROTOCOL || 'https',
    slashes: true,
    host: process.env.CONCOURSE_URL_HOST
};

function doRedirect(request, reply) {
    var targetRedirect = _.extend({}, baseForward, {
        pathname: request.params.apipath,
        query: request.query
    })

    return reply.redirect(url.format(targetRedirect));
}

/**
 * Handler for environment requests. Takes JS_* environment variables from 
 * peocess.env and passes them back to the front end.
 */
function getEnv(request, reply) {
    var frontEndEnv = _.pickBy(process.env, (value, key) => {
        return _.startsWith(key, 'JS_');
    });

    reply(frontEndEnv);
}

function getResponseHeader(response, header, asArray) {
    var head = response.headers[header.toLowerCase()];
    var headParts = _.map(head.split(/;\s*/), (str) => {
        if (str.includes('=')){
            return str.split(/\s*=\s*/);
        } else {
            return str;
        }
    });
    if (_.isNil(asArray) || asArray === false) {
        headParts = headParts[0];
    }
    return headParts;
}

function handleConcoursePublic(err, res, request, reply, settings, ttl) {
    Wreck.read(res, {}, function (err, payload) {
        var body = payload;

        var contentType = getResponseHeader(res, 'content-type', true);
        if (contentType[0] === 'text/css') {
            body = payload.toString(contentType[1].encoding);
            body = body.replace(/\/public\//g, '/c/public/');
        }

        reply(body).headers = res.headers;
    });
}

var config = {
    debug: {
        request: ['error', 'database', 'read']
    }
};
var server = new Hapi.Server(config);
server.connection({ port: 8888 });

server.register([
    h2o2,
    Inert,
    {
        register: good,
        options: {
            reporters: {
                myConsoleReporter: [{
                    module: 'good-squeeze',
                    name: 'Squeeze',
                    args: [{ log: '*', response: '*' }]
                }, {
                    module: 'good-console'
                }, 'stdout']
            }
        }
    }
    ], (err) => {

    if (err) {
        console.error('Failed loading plugins');
        process.exit(1);
    }

    server.route({
        method: 'GET',
        path: '/{param*}',
        handler: {
            directory: {
                path: 'public'
            }
        }
    });

    server.route({
        method: 'GET',
        path: '/e',
        config: {
            handler: getEnv
        }
    });

    server.route({
        method: 'GET',
        path: '/c/{apipath*}',
        handler: {
            proxy: {
                uri: url.format(_.extend({}, baseForward, {
                    pathname: '{apipath}'
                }))
            }
        }
    });

    server.route({
        method: 'GET',
        path: '/c/public/{publicpath*}',
        handler: {
            proxy: {
                uri: url.format(_.extend({}, baseForward, {
                    pathname: '/public/{publicpath}'
                })),
                onResponse: handleConcoursePublic
            }
        }
    });

    server.route({
        method: 'GET',
        path: '/favicon.ico',
        handler: {
            proxy: {
                uri: url.format(_.extend({}, baseForward, {
                    pathname: '/favicon.ico'
                }))
            }
        }
    });

    server.route({
        method: 'GET',
        path: '/r/{apipath*}',
        config: {
            handler: doRedirect
        }
    });

    server.start(() => {
        console.log('Server running at:', server.info.uri);
    });
});


