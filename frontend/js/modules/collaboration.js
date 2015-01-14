'use strict';

angular.module('esn.collaboration', ['restangular'])
  .factory('collaborationService', function() {

    function isManager(collaboration, user) {
      return collaboration.creator === user._id;
    }

    return {
      isManager: isManager
    };
  })
  .factory('collaborationAPI', ['Restangular', function(Restangular) {
    function getWhereMember(tuple) {
      return Restangular.all('collaborations/membersearch').getList(tuple);
    }

    function getMembers(objectType, id, options) {
      return Restangular.one('collaborations').one(objectType, id).all('members').getList(options);
    }

    function getMember(objectType, id, member) {
      return Restangular.one('collaborations').one(objectType, id).one('members', member).get();
    }

    function getExternalCompanies(objectType, id, options) {
      return Restangular.one('collaborations').one(objectType, id).getList('externalcompanies', options);
    }

    function getInvitablePeople(objectType, id, options) {
      var query = options || {};
      return Restangular.one('collaborations').one(objectType, id).all('invitablepeople').getList(query);
    }

    function requestMembership(objectType, id, member) {
      return Restangular.one('collaborations').one(objectType, id).one('membership', member).put();
    }

    return {
      getMembers: getMembers,
      getMember: getMember,
      getWhereMember: getWhereMember,
      getExternalCompanies: getExternalCompanies,
      getInvitablePeople: getInvitablePeople,
      requestMembership: requestMembership
    };
  }])
  .controller('collaborationListController', ['$scope', 'domain', 'user', function($scope, domain, user) {
    $scope.domain = domain;
    $scope.user = user;
  }])
  .directive('collaborationCreateButton', function() {
    return {
      restrict: 'E',
      templateUrl: '/views/modules/collaboration/create-collaboration-button.html'
    };
  })
  .directive('collaborationMembersWidget', ['$rootScope', 'collaborationAPI', function($rootScope, collaborationAPI) {
    return {
      restrict: 'E',
      replace: true,
      scope: {
        collaboration: '=',
        objectType: '@'
      },
      templateUrl: '/views/modules/collaboration/collaboration-members-widget.html',
      link: function($scope, element, attrs) {
        $scope.inSlicesOf = attrs.inSlicesOf && angular.isNumber(parseInt(attrs.inSlicesOf, 10)) ?
          parseInt(attrs.inSlicesOf, 10) : 3;
        $scope.error = false;

        function sliceMembers(members) {
          if ($scope.inSlicesOf < 1 || !angular.isArray(members)) {
            return members;
          }
          var array = [];
          for (var i = 0; i < members.length; i++) {
            var chunkIndex = parseInt(i / $scope.inSlicesOf, 10);
            var isFirst = (i % $scope.inSlicesOf === 0);
            if (isFirst) {
              array[chunkIndex] = [];
            }
            array[chunkIndex].push(members[i]);
          }
          return array;
        }

        $scope.updateMembers = function() {
          collaborationAPI.getMembers($scope.objectType, $scope.collaboration._id, { limit: 16 }).then(function(result) {
            var total = parseInt(result.headers('X-ESN-Items-Count'), 10);
            var members = result.data;
            $scope.more = total - members.length;
            $scope.members = sliceMembers(members);
          }, function() {
            $scope.error = true;
          });
        };

        var communityJoinRemover = $rootScope.$on('community:join', $scope.updateMembers);
        var communityLeaveRemover = $rootScope.$on('community:leave', $scope.updateMembers);
        element.on('$destroy', function() {
          communityJoinRemover();
          communityLeaveRemover();
        });
        $scope.updateMembers();
      }
    };
  }])
  .directive('collaborationMemberAvatar', function() {
    return {
      restrict: 'E',
      replace: true,
      scope: {
        member: '=',
        collaboration: '='
      },
      templateUrl: '/views/modules/collaboration/collaboration-member-avatar.html',
      controller: function($scope) {
        var title = '';
        if ($scope.member.user.firstname || $scope.member.user.lastname) {
          title = ($scope.member.user.firstname || '') + ' ' + ($scope.member.user.lastname || '');
        } else {
          title = $scope.member.user.emails[0];
        }

        $scope.tooltip = {
          title: title
        };

        if ($scope.collaboration.creator === $scope.member.user._id) {
          $scope.creator = true;
        }
      }
    };
  })
  .directive('collaborationInviteUsers', ['$q', 'collaborationAPI', 'collaborationService', 'session',
    function($q, collaborationAPI, collaborationService, session) {
      return {
        restrict: 'E',
        replace: true,
        scope: {
          objectType: '@',
          collaboration: '='
        },
        templateUrl: '/views/modules/collaboration/collaboration-invite-users.html',
        link: function($scope, $element) {
          $scope.placeholder = 'User name';
          $scope.displayProperty = 'displayName';
          $scope.running = false;

          $scope.getErrorDiv = function() {
            return $element.find('[error-container]');
          };
          $scope.getRunningDiv = function() {
            return $element.children('.form-container').children('form').find('[running-container]');
          };
          $scope.getButtonContent = function() {
            return $element.children('.form-container').children('form').find('[button-content]');
          };
          $scope.getSuccessDiv = function() {
            return $element.children('.form-container').children('form').find('[success-container]');
          };

          $scope.showErrorMessage = function() {
            $scope.getErrorDiv().removeClass('hidden');
          };
          $scope.hideErrorMessage = function() {
            $scope.getErrorDiv().addClass('hidden');
          };

          $scope.showRunning = function() {
            $scope.getRunningDiv().removeClass('hidden');
            $scope.getButtonContent().addClass('hidden');
          };
          $scope.hideRunning = function() {
            $scope.getRunningDiv().addClass('hidden');
            $scope.getButtonContent().removeClass('hidden');
          };

          $scope.showSuccessMessage = function() {
            $scope.getSuccessDiv().removeClass('hidden');
          };
          $scope.hideSuccessMessage = function() {
            $scope.getSuccessDiv().addClass('hidden');
          };

          $scope.resetMessages = function() {
            $scope.hideErrorMessage();
            $scope.hideSuccessMessage();
          };

          $scope.getInvitablePeople = function(query) {
            $scope.query = query;
            var deferred = $q.defer();
            collaborationAPI.getInvitablePeople($scope.objectType, $scope.collaboration._id, {search: query, limit: 5}).then(
              function(response) {
                response.data.forEach(function(user) {
                  if (user.firstname && user.lastname) {
                    user.displayName = user.firstname + ' ' + user.lastname;
                  }
                  else {
                    user.displayName = user.emails[0];
                  }
                  $scope.query = '';
                });
                deferred.resolve(response);
              },
              function(error) {
                deferred.resolve(error);
              }
            );
            return deferred.promise;
          };

          $scope.inviteUsers = function() {
            $scope.hideSuccessMessage();
            $scope.hideErrorMessage();
            $scope.noUser = false;
            $scope.invalidUser = false;
            if ($scope.query && $scope.query !== '') {
              $scope.invalidUser = $scope.query;
              $scope.showErrorMessage();
              if (!$scope.users || $scope.users.length === 0) {
                $scope.query = '';
                return;
              }
            } else if (!$scope.users || $scope.users.length === 0) {
              $scope.noUser = true;
              $scope.showErrorMessage();
              return;
            }
            if ($scope.running) {
              return;
            }
            $scope.resetMessages();
            $scope.running = true;
            $scope.showRunning();

            var promises = [];
            $scope.users.forEach(function(user) {
              promises.push(collaborationAPI.requestMembership($scope.objectType, $scope.collaboration._id, user._id));
            });

            $q.all(promises).then(
              function() {
                $scope.users = [];
                $scope.running = false;
                $scope.hideRunning();
                $scope.showSuccessMessage();
                if ($scope.query && $scope.query !== '') {
                  $scope.invalidUser = $scope.query;
                  $scope.showErrorMessage();
                }
              },
              function(error) {
                $scope.users = [];
                $scope.error = error.data;
                $scope.running = false;
                $scope.hideRunning();
                $scope.showErrorMessage();
              }
            );
          };

          if (collaborationService.isManager($scope.collaboration, session.user)) {
            $element.removeClass('hidden');
          }
        }
      };
    }]);

