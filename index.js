const Hapi = require('hapi');
const Inert = require('inert');
const h2o2 = require('h2o2');
const Wreck = require('wreck');
const good = require('good');
const _ = require('lodash');
const url = require('url');

const packageInfo = require('./package.json');

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
 * process.env and passes them back to the front end.
 */
function getEnv(request, reply) {
    var frontEndEnv = _.pickBy(process.env, (value, key) => {
        return _.startsWith(key, 'JS_');
    });

    _.extend(frontEndEnv, {
        package: _.pick(packageInfo, [
            'version'
        ])
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

function login() {
    var loginUrl = new url.URL('/api/v1/teams/main/auth/token', url.format(baseForward));
    // TODO: load from env
    loginUrl.username = 'concourse';
    loginUrl.password = 'garbage';

    return new Promise((resolve, reject) => {
        Wreck.get(loginUrl.toString(), { json: true }, (err, response, payload) => {
            if (err) {
                reject(err);
                return
            }

            if (response.statusCode != 200) {
                reject(new Error("login returned status: " + response.statusCode));
                return
            }

            resolve(payload);
        });
    });
}

function handlePrivileged(request, reply) {
    // Try: http://localhost:8888/c/privileged/api/v1/teams/main/pipelines/rubicon/jobs/qa-smoke/builds

    // TODO: filter request based on whitelist loaded from env here

    login().then((loginResponse) => {
        request.headers.Authorization = `${loginResponse.type} ${loginResponse.value}`;

        var targetUrl = url.format(_.extend({}, baseForward, {
            pathname: request.path
        }));

        console.log("FUCK YEAH: ", targetUrl);

        reply.proxy()

    }).catch((err) => {
        console.error(err);
        reply("Login failed").code(500);
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
        path: '/search/{pattern*}',
        handler: {
            file: 'public/index.html'
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

    server.route({
        method: 'POST',
        path: '/c/privileged/{publicpath*}',
        config: {
            handler: handlePrivileged,
            payload: {
                output: 'stream',
                parse: false
            }
        }
    });

    server.start(() => {
        console.log('Server running at:', server.info.uri);
    });
});


