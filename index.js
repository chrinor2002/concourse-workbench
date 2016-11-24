const Hapi = require('hapi');
const Inert = require('inert');
const h2o2 = require('h2o2');
const good = require('good');
const _ = require('lodash');
const url = require('url');

const baseForward = {
    protocol: 'https',
    slashes: true,
    host: 'concourse.appcarousel.com'
};

function doRedirect(request, reply) {
    var targetRedirect = _.extend({}, baseForward, {
        pathname: request.params.apipath,
        query: request.query
    })

    return reply.redirect(url.format(targetRedirect));
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
        path: '/r/{apipath*}',
        config: {
            handler: doRedirect
        }
    });

    server.start(() => {
        console.log('Server running at:', server.info.uri);
    });
});


