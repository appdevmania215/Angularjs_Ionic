!(function() {

var pathless = /^#?\/?$/

angular.module('site360', ['ionic', 'site360.controllers', 'site360.services', 'site360.filters', 'site360.directives'])
  .config(function($stateProvider, $urlRouterProvider, $locationProvider) {
    $stateProvider
      .state('welcome', {
        url: '^/welcome',
        controller: 'WelcomeController',
        templateUrl: 'templates/welcome.html',
        data: { restricted: false }
      })

      .state('login', {
        url: '^/login',
        controller: 'LoginController',
        templateUrl: 'templates/login.html',
        data: { restricted: false }
      })

      .state('reset-password', {
        url: '^/login/reset-password',
        controller: 'ResetPasswordController',
        templateUrl: 'templates/reset-password.html',
        data: { restricted: false }
      })

      /*
      .state('sign-up', {
        url: '^/sign-up',
        controller: 'SignUpController',
        templateUrl: 'templates/sign-up.html',
        data: { restricted: false }
      })
      */

      .state('profile', {
        url: '^/profile',
        controller: 'ProfileController',
        templateUrl: 'templates/profile.html',
        data: { restricted: true }
      })

      .state('notifications', {
        url: '^/notifications',
        controller: 'NotificationsController',
        templateUrl: 'templates/notifications.html',
        data: { restricted: true }
      })

      .state('notificationsSearch', {
        url: '^/notifications/search',
        controller: 'NotificationsSearchController',
        templateUrl: 'templates/notifications-search.html',
        data: { restricted: true }
      })

      .state('notificationCreate', {
        url: '^/notifications/create',
        controller: 'NotificationCreateController',
        templateUrl: 'templates/notification-create.html',
        data: { restricted: true }
      })

      .state('notification', {
        url: '^/notifications/:id',
        controller: 'NotificationController',
        templateUrl: 'templates/notification.html',
        data: { restricted: true }
      })

      .state('notificationPhotos', {
        url: '^/notifications/:id/photos',
        controller: 'NotificationPhotosController',
        templateUrl: 'templates/notification-photos.html',
        data: { restricted: true }
      })

      .state('notificationEdit', {
        url: '^/notifications/:id/edit',
        controller: 'NotificationCreateController',
        templateUrl: 'templates/notification-create.html',
        data: { restricted: true }
      })

      .state('settings', {
        url: '^/settings',
        controller: 'SettingsController',
        templateUrl: 'templates/settings.html',
        data: { restricted: true }
      })

    $urlRouterProvider
      .otherwise(function($injector, $location) {
        if (!pathless.test($location.$$path)) {
          $location.path('/welcome').replace()
        }
      })
  })

  .run(function($ionicPlatform, $rootScope, $location, $state, API, Store, Global, User, Sites, Locations, Notifications, PushNotifications) {
    $ionicPlatform.ready(function() { 
      if (window.StatusBar) {
        // org.apache.cordova.statusbar required
        StatusBar.styleLightContent()
      }

      /*
      if (window.hockeyapp) {
        var IOS_HAID = '99122a92716c4069deccda1a5d44e767'
        var ANDROID_HAID = 'a5fb70a94b3be5fad39450ab3fb0b4fb'
        var id = (
          ionic.Platform.isIOS() ? IOS_HAID :
          ionic.Platform.isAndroid() ? ANDROID_HAID :
          null
        )

        var success = function() {
          console.log('HockeyApp has been started.')
        }

        var failure = function(error) {
          console.log('HockeyApp failed to start.', error)
        }

        hockeyapp.start(success, failure, id)
      }
      */

      PushNotifications.init()
    })

    window.$ionicPlatform = $ionicPlatform

    var ping = $rootScope.ping = function() {
      Global.ping(function(error, stillLoggedIn) {
        if (error || !stillLoggedIn) {
          if (User.current()) {
            User.logout().then(function() {
              location.reload()
            })
          }
        }
      })
    }

    var timeout = null
    var refresh = $rootScope.refresh = function() {
      if (timeout) {
        clearTimeout(timeout)
        console.log('CLEARED TIMEOUT')
      }

      if (Global.isLoggedIn()) {
        Locations.refresh()
        Sites.refresh()
        Notifications.refresh()
          .then(function(notifications) {
            PushNotifications.setBadge(0)
            $rootScope.notifications = notifications
            timeout = setTimeout(refresh, 1000 * 60)
          })
      }
    }

    ping()
    refresh()
    $ionicPlatform.on('resume', refresh)

    $rootScope.selectedType = 'Received'
    $rootScope.query = ''
    $rootScope.$on('login', refresh)
    $rootScope.$on('$stateChangeStart', function (e, next) {
      var hasBeenWelcomed = Global.hasBeenWelcomed()
      var isLoggedIn = Global.isLoggedIn()

      if (!next.data.restricted) {
        if (!hasBeenWelcomed && next.name != 'welcome') {
          e.preventDefault()
          $state.go('welcome')
        }
        return
      }

      if (!isLoggedIn) {
        console.log(hasBeenWelcomed ? 'gonna redirect' : 'staying put')
        e.preventDefault()
        $state.go(hasBeenWelcomed ? 'login' : 'welcome')
        return
      }
    })

    if (pathless.test($location.$$path)) {
      Global.hasBeenWelcomed()
        ? Global.isLoggedIn()
          ? $location.path('/notifications').replace()
          : $location.path('/login').replace()
        : $location.path('/welcome').replace()
    }
  })

})()
