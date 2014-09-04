#!/usr/bin/env node

var yargs = require('yargs')
    .options('p', {
      alias: 'npme-path',
      describe: 'path of npm Enterprise installation',
      default: '/etc/npme'
    })
    .options('s', {
      alias: 'sudo',
      describe: 'should privileged commands be run with sudo?',
      boolean: true,
      default: true
    })
    .options('u', {
      alias: 'user',
      describe: 'default npmE user',
      default: 'ubuntu'
    })
    .options('g', {
      alias: 'group',
      describe: 'default npmE group',
      default: 'ubuntu'
    }),
  fs = require('fs'),
  logger = require('../lib/logger'),
  npme = require('../lib'),
  path = require('path'),
  util = new (require('../lib/util'))(),
  npmeJson = require('../lib/npme'),
  commands = {
    'install': {
      description: 'install:\tinstall npm Enterprise on a (preferably) blank operating system.\n',
      command: function(args) {
        // create a bin for npme.

        // have we already installed?
        if (fs.existsSync('/etc/npme/.license.json')) {
          logger.success("npme is already installed, upgrading.");

          // write the current package.json.
          fs.writeFileSync(
            path.resolve(args['npme-path'], './package.json'),
            JSON.stringify(npmeJson, null, 2)
          );

          // upgrayedd.
          async.series([
            function(done) {
              util.exec('npm cache clear; npm install --registry=https://enterprise.npmjs.com --always-auth', {
                cwd: args['npme-path']
              }, function() {
                done();
              });
            },
            function(done) {
              util.exec('ndm restart', {cwd: args['npme-path']}, function(err) { done() });
            }
          ]);
        } else {
          var command = 'ln -s --force ' + path.resolve('../.bin/npme') + ' /usr/bin/npme';

          if (args.sudo) command = 'sudo ' + command;

          util.exec(command, {}, function(err) {
            require('../lib')({
              sudo: args.sudo,
              user: args.user,
              group: args.group
            }); // initial install.
          });
        }
      }
    },
    'start': {
      description: 'start:\t\tstart npmE and all its services.\n',
      command: function(arguments) {
        util.exec('ndm start', {cwd: arguments['npme-path']}, function(err) {
          logger.success('npmE is now running (curl http://localhost:8080).');
        });
      }
    },
    'stop': {
      description: 'stop:\t\tstop npmE services.\n',
      command: function(arguments) {
        util.exec('ndm stop', {cwd: arguments['npme-path']}, function(err) {});
      }
    },
    'restart': {
      description: 'restart:\trestart npmE services.\n',
      command: function(arguments) {
        util.exec('ndm restart', {cwd: arguments['npme-path']}, function(err) {});
      }
    },
    'add-package': {
      description: 'add-package:\tadd a package to the package-follower whitelist (add-package jquery).\n',
      command: function(arguments) {
        var package = arguments._[1] || '';
        util.exec('ndm run-script manage-whitelist add-package ' + package, {cwd: arguments['npme-path']}, function(err) {});
      }
    },
    'reset-follower': {
      description: 'reset-follower:\treindex from the public registry all packages listed in whitelist.\n',
      command: function(args) {
        async.series([
          function(done) {
            util.exec('ndm stop policy-follower', {
              cwd: args['npme-path']
            }, function() { done(); });
          },
          function(done) {
            util.exec('rm .sequence', {
              cwd: path.resolve(args['npme-path'], './node_modules/@npm/policy-follower')
            }, function() { done(); });
          },
          function(done) {
            util.exec('ndm start policy-follower', {
              cwd: args['npme-path']
            }, function() { done(); });
          }
        ], function() {
          logger.success('reset policy follower.')
        });
      }
    },
    'update': {
      description: "update:\t\tupdate npm Enteprise.",
      command: function(args) {
        util.exec('npm cache clear; npm install npme', {
          cwd: '/tmp'
        }, function() {
          logger.success('npm Enterprise was upgraded!');
        });
      }
    }
  },
  usageString = "npm Enterprise. It's npm, but you run it yourself!\n\n";

// generate usage string.
Object.keys(commands).forEach(function(command) {
  usageString += commands[command].description;
});

yargs.usage(usageString);

// display help if command is not recognized.
if (yargs.argv.help || !commands[yargs.argv._[0]]) {
  logger.log(yargs.help());
} else {
  // update config singleton and run command.
  var argv = yargs.normalize().argv;
  console.log(argv)

  commands[yargs.argv._[0]].command(argv);
}

process.on('uncaughtException', function(err) {
  logger.error(err.message);
  process.exit(0);
});
