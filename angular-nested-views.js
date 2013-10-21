;(function() {
    'use strict';

    var ActionRouteProvider = function($routeProvider) {
        this.$routeProvider = $routeProvider;

        this.pathPerAction = {};
    };


    ActionRouteProvider.prototype = (function() {

        /**
         * @param {string|{url: string}} routeOrRelativeUrl
         * @returns {string}
         */
        var determineRelativeUrl = function(routeOrRelativeUrl) {
            return (typeof routeOrRelativeUrl === 'string') ? routeOrRelativeUrl : routeOrRelativeUrl.url;
        };

        /**
         * @param {Object.<string>} pathPerAction
         * @param {string} action
         * @param {string} relativeUrl
         * @returns {string}
         */
        var determineAndStoreActionPath = function(pathPerAction, action, relativeUrl) {
            var lastDotIndex = action.lastIndexOf('.');

            var path;

            if (lastDotIndex !== -1) {
                var parentAction = action.substring(0, lastDotIndex);

                var pathOfParentAction = pathPerAction[parentAction];
                if (!pathOfParentAction) {
                    pathOfParentAction = '';
                }

                path = pathOfParentAction + relativeUrl;
            } else {
                path = relativeUrl;
            }

            pathPerAction[action] = path;

            return path;
        };

        /**
         * @param {Object.<Array.<string>>} paramsPerAction
         * @param {string} action
         * @param {Object.<string>} pathPerAction
         */
        var initParamsPerAction = function(paramsPerAction, action, pathPerAction) {
            var previousAction = null;

            var subActions = action.split('.');

            angular.forEach(subActions, function(subAction) {
                var currentAction = previousAction ? previousAction + '.' + subAction : subAction;

                var paramsForCurrentAction = [];

                var path = pathPerAction[currentAction];
                if (path) {
                    angular.forEach(path.split(/\W/), function(param) {
                        if (!(new RegExp("^\\d+$").test(param)) &&
                            param && (new RegExp("(^|[^\\\\]):" + param +
                            "(\\W|$)").test(path))) {
                            paramsForCurrentAction.push(param);
                        }
                    });

                    paramsPerAction[currentAction] = paramsForCurrentAction;
                }

                previousAction = currentAction;
            });
        };


        return {
            constructor: ActionRouteProvider,

            abstractAction: function(action, relativeUrl) {
                determineAndStoreActionPath(
                    this.pathPerAction, action, relativeUrl);
                return this;
            },

            /**
             * @param {string} action
             * @param {string|Object} routeOrRelativeUrl
             * @returns {ActionRouteConfigurer}
             */
            whenAction: function(action, routeOrRelativeUrl) {
                var relativeUrl = determineRelativeUrl(routeOrRelativeUrl);

                var path = determineAndStoreActionPath(this.pathPerAction, action, relativeUrl);

                var route = (typeof routeOrRelativeUrl === 'object') ? angular.copy(routeOrRelativeUrl) : {};
                if (typeof routeOrRelativeUrl === 'object') {
                    delete route.url;
                }

                route.action = action;

                route.paramsPerAction = {};
                initParamsPerAction(route.paramsPerAction, action, this.pathPerAction);

                this.$routeProvider.when(path, route);

                return this;
            },

            otherwise: function(params) {
                this.$routeProvider.otherwise(params);
                return this;
            },

            $get: function() {
                return null;
            }
        };
    }());

    var requiredModules = [];

    if (angular.version.major > 1 || (angular.version.major === 1 && angular.version.minor >= 2)) {
        requiredModules.push('ngRoute');
    }

    angular.module('angularNestedViews.actionRoute', requiredModules)
        .provider('$actionRoute', ['$routeProvider', function($routeProvider) {
            return new ActionRouteProvider($routeProvider);
        }]);

}());
;;(function() {
    'use strict';

    var ngSwitchWhenCompileAlreadyWrapped = false;

    var wrapNgSwitchWhenCompile = function(compileFn) {
        return function wrappedNgSwitchWhenCompile(element, attrs, transclude) {
            var wrappedTransclude = wrapNgSwitchWhenCompileTransclude(transclude);
            return compileFn(element, attrs, wrappedTransclude);
        };
    };


    var wrapNgSwitchWhenCompileTransclude = function(transclude) {

        return function wrappedNgSwitchWhenCompileTransclude(scope, cloneLinkingFn) {

            var intermediateChildScope;
            var intermediateElement = angular.element('<span>');

            var createIntermediateChildScopeAndElement = function() {
                var result = scope.$new();
                transclude(result, wrappedCloneLinkingFn);

                return result;
            };

            var wrappedCloneLinkingFn = function wrappedCloneLinkingFn(clonedElement, scope) {
                intermediateElement.append(clonedElement);
                cloneLinkingFn(intermediateElement, scope);
            };

            intermediateChildScope = createIntermediateChildScopeAndElement();

            scope.$on('$routeChangeSuccess', function(event, current, previous) {
                var routeParamChanged = false;

                var currentAction = scope.$_currentAction();

                var purgeScopeOnRouteParams = current.paramsPerAction ? current.paramsPerAction[currentAction] : null;
                if (!purgeScopeOnRouteParams) {
                    return;
                }

                var purgeScopeOnRouteParamsLength = purgeScopeOnRouteParams.length;

                for (var i = 0; i < purgeScopeOnRouteParamsLength && !routeParamChanged; i++) {
                    routeParamChanged = isRouteParamChanged(current, previous, purgeScopeOnRouteParams[i]);
                }

                if (routeParamChanged) {
                    intermediateChildScope.$destroy();
                    intermediateElement.children().remove();

                    intermediateChildScope = createIntermediateChildScopeAndElement();
                }
            });
        };
    };

    var isRouteParamChanged = function(currentRoute, previousRoute, name) {
        return currentRoute.params[name] && previousRoute.params[name] &&
                currentRoute.params[name] !== previousRoute.params[name];
    };


    var requiredModules = [];

    if (angular.version.major > 1 || (angular.version.major === 1 && angular.version.minor >= 2)) {
        requiredModules.push('ngRoute');
    }


    angular.module('angularNestedViews.decoratedNgSwitchWhenDirective', requiredModules)
        .config(['$routeProvider', '$provide', function($routeProvider, $provide) {

            $provide.decorator('ngSwitchWhenDirective', ['$delegate', function($delegate) {
                var ngSwitchWhenDefinition = $delegate[0];

                if (!ngSwitchWhenCompileAlreadyWrapped) {
                    ngSwitchWhenDefinition.compile = wrapNgSwitchWhenCompile(ngSwitchWhenDefinition.compile);

                    ngSwitchWhenCompileAlreadyWrapped = true;
                }

                return $delegate;
            }]);
        }]);

}());;;(function() {
    'use strict';

    angular.module('angularNestedViews',
        [
            'angularNestedViews.rootScopeAdditions',
            'angularNestedViews.decoratedNgSwitchWhenDirective',
            'angularNestedViews.actionRoute'
        ]);

}());
;;(function() {
    'use strict';

    /** const */
    var subActionIndexProperty = '$$_subActionIndex';

    angular.module('angularNestedViews.rootScopeAdditions', [])
        .run(['$rootScope', '$route', function($rootScope, $route) {

            $rootScope.$$_subActions = [];

            $rootScope.$$_currentAction = null;

            $rootScope.nextSubAction = function() {
                var $scope = this;

                var index;

                if ($scope.hasOwnProperty(subActionIndexProperty)) {
                    index = $scope[subActionIndexProperty];
                } else {
                    index = $scope.$parent &&
                        angular.isDefined($scope.$parent[subActionIndexProperty]) ?
                                $scope.$parent[subActionIndexProperty] + 1 : 0;

                    $scope[subActionIndexProperty] = index;
                }

                return $rootScope.$$_subActions[index];
            };

            $rootScope.currentAction = function() {
                return $rootScope.$$_currentAction;
            };

            $rootScope.$_currentAction = function() {
                var $scope = this;

                var subActionIndex = $scope[subActionIndexProperty];

                if (typeof subActionIndex !== 'number') {
                    throw 'No current action found';
                }

                return $rootScope.$$_subActions
                    .slice(0, subActionIndex + 1)
                    .join('.');
            };


            $rootScope.$on('$routeChangeSuccess', function() {
                if (!$route.current) {
                    return;
                }

                var action = $route.current.action;
                if (!action) {
                    return;
                }

                $rootScope.$$_currentAction = action;
                $rootScope.$$_subActions = action.split('.');
            });
        }]);

}());
