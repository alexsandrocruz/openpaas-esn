'use strict';

var expect = require('chai').expect,
    request = require('supertest'),
    fs = require('fs-extra');

describe('The jwt API', function() {

  var userId, webserver, fixtures, helpers;

  beforeEach(function(done) {
    var self = this;

    helpers = this.helpers;
    this.mongoose = require('mongoose');
    this.testEnv.initRedisConfiguration(this.mongoose, this.helpers.callbacks.noErrorAnd(function() {
      self.testEnv.initCore(function() {
        webserver = helpers.requireBackend('webserver').webserver;
        fixtures = helpers.requireFixture('models/users.js')(helpers.requireBackend('core/db/mongo/models/user'));

        fixtures.newDummyUser().save(helpers.callbacks.noErrorAnd(function(saved) {
          userId = saved._id + '';
          done();
        }));
      });
    }));
  });

  afterEach(function(done) {
    this.mongoose.connection.db.dropDatabase();
    this.mongoose.disconnect(done);
  });

  describe('POST /api/jwt/generate', function() {

    it('should send back 401 if user is not logged in', function(done) {
      helpers.api.requireLogin(webserver.application, 'post', '/api/jwt/generate', done);
    });

    it('should send back a new jwt when logged in', function(done) {

      var conf = this.helpers.requireBackend('core/esn-config')('jwt'),
          publicKey = fs.readFileSync(this.testEnv.fixtures + '/crypto/public-key', 'utf8'),
          privateKey = fs.readFileSync(this.testEnv.fixtures + '/crypto/private-key', 'utf8');

      conf.store({publicKey: publicKey, privateKey: privateKey, algorithm: 'RS256'}, function() {
        helpers.api.loginAsUser(webserver.application, fixtures.emails[0], fixtures.password, helpers.callbacks.noErrorAnd(function(loggedInAsUser) {
          loggedInAsUser(request(webserver.application)
            .post('/api/jwt/generate'))
            .expect(200)
            .end(helpers.callbacks.noErrorAnd(function(res) {
              expect(res.body).to.exist;

              done();
            }));
        }));
      });
    });
  });

});
