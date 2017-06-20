const Hapi = require('hapi');
const Inert = require('inert');
const h2o2 = require('h2o2');
const Wreck = require('wreck');
const good = require('good');
const _ = require('lodash');
const url = require('url');

const packageInfo = require('./package.json');

const baseForward = {
    protocol: getEnvParam('CONCOURSE_URL_PROTOCOL', 'https'),
    slashes: true,
    host: getEnvParam('CONCOURSE_URL_HOST')
};
const baseProxyOptions = {
    uri: url.format(_.extend({}, baseForward, {
        pathname: '{apipath}'
    })),
    passThrough: true
};

function doRedirect(request, reply) {
    var targetRedirect = _.extend({}, baseForward, {
        pathname: request.params.apipath,
        query: request.query
    });

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

    // Extend with special env variables we need on both ends
    _.extend(frontEndEnv, {
        JS_PRIVILEGED_FILTER: getEnvParam('PRIVILEGED_FILTER')
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

function getEnvParam(name, defaultValue) {
    var value = process.env[name];
    if (!_.isNil(value)) {
        if (_.indexOf(value, '{') === 0 || _.indexOf(value, '[') === 0) {
            value = JSON.parse(value);
        }
        return value;
    }
    return defaultValue;
}

function getBasicAuthHeaders() {
    var basicAuth = getEnvParam('CONCOURSE_BASIC_AUTH');
    if (_.isNil(basicAuth)) {
        var message = 'Privileged access is disabled.';
        var err = new Error(message);
        err.httpCode = 401;
        err.httpMessage = message;
        throw err;
    }
    return {
        Authorization: 'Basic ' + new Buffer(basicAuth.username + ':' + basicAuth.password).toString('base64')
    };
}

function login() {
    return new Promise((resolve, reject) => {
        var loginUrl = _.extend({}, baseForward, {
            pathname: '/api/v1/teams/main/auth/token'
        });

        Wreck.get(url.format(loginUrl), {
            headers: getBasicAuthHeaders(),
            json: true
        }, (err, response, payload) => {
            if (err) {
                reject(err);
            } else if (response.statusCode !== 200) {
                reject(new Error('login returned status: ' + response.statusCode));
            } else {
                resolve(payload);
            }
        });
    });
}

function handlePrivileged(request, reply) {
    var filter = getEnvParam('PRIVILEGED_FILTER');
    if (filter) {
        var regex = new RegExp('api/v1/teams/([^/]+)/pipelines/([^/]+)/jobs/([^/]+)/([^/]+)$');
        var matches = regex.exec(request.params.apipath);
        //var teamName = matches[1];
        var pipelineName = matches[2];
        var jobName = matches[3];
        var action = _.get({
            builds: 'trigger',
            pause: 'pause',
            unpause: 'pause'
        }, matches[4]);

        // check that the "path" is "allowed"
        var allowed = _.get(filter, [pipelineName, jobName, action]);
        if (!allowed) {
            reply('forbidden by administrator').code(403);
            return;
        }
    }

    login().then((loginResponse) => {
        request.headers.Authorization = `${loginResponse.type} ${loginResponse.value}`;
        reply.proxy(baseProxyOptions);
    }).catch((err) => {
        console.error(err);
        reply(err.httpMessage || 'login failed').code(err.httpCode || 500);
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
            proxy: baseProxyOptions
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
        path: '/c/privileged/{apipath*}',
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


