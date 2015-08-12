
angular.module('site360.controllers', [])

// Application
.controller('ApplicationController',
  function($rootScope, $scope, $state, $ionicModal, $ionicPopup, $q, $filter, Store, User, Positions, Locations, Notifications) {

  $scope.regex = {
    email: /^([A-Za-z0-9]{1,}([-_\.\+&'][A-Za-z0-9]{1,}){0,}){1,}@(([A-Za-z0-9]{1,}[-]{0,1})\.){1,}[A-Za-z]{2,6}$/,
    phone: /^\+?[0-9\-\ \(\)]{8}[^a-z]*$/i
  }

  $scope.openUrl = function(url) {
    window.open(url, '_system')
  }

  $scope.throwError = function(message) {
    $ionicPopup.alert({
      title: 'Error',
      template: message || 'Something went wrong.',
      okType: 'button-assertive'
    })
  }

  $scope.ValidationClass = function($scope) {
    return function(field, fn) {
      var condition = true

      if (fn) {
        condition = fn()
      }

      var invalid = (
        field &&
        $scope.blurred[field.$name] &&
        (field.$invalid || !condition)
      )

      return invalid ? 'item-invalid' : ''
    }
  }

  $scope.logout = function() {
    User.logout().then(function() {
      location.reload()
    }) 
  }

  $scope.photos = Store.get('photos') || []
  
  $scope.addNotificationsToMenu = function() {
    Notifications.get().then(function(notifications) {
      $rootScope.notifications = notifications
    })
  }

  var addMenu = function() {
    var deferred = $q.defer()
    var body = angular.element(document.body)
    $scope.user = User.current()

    $ionicModal
      .fromTemplateUrl('templates/menu.html', {
        scope: $scope, 
        animation: 'slide-in-up'
      })
      .then(function(modal) {
        var backdrop = angular.element(modal.el)
        var el = angular.element(modal.modalEl)

        el.addClass('menu-modal')
        backdrop.addClass('menu-modal-backdrop')

        $scope.$on('modal.shown', function() {
          $scope.user = User.current()
          body.addClass('menu-modal-active')
        })

        $scope.$on('modal.hidden', function() {
          body.removeClass('menu-modal-active')
        })

        $scope.menu = modal
        $scope.hideIf = function(state) {
          if ($state.$current.name == state) {
            $scope.menu.hide()
          } 
        }

        $scope.canHasFeedback = function() {
          return false // !!window.hockeyapp
        }

        $scope.feedback = function() {
          if ($scope.canHasFeedback()) {
            hockeyapp.feedback()
          }
        }

        // Return the modal
        deferred.resolve(modal)
      })
  
    return deferred.promise
  }

  addMenu().then(function(menu) {
    var timeout = null
    $scope.menu = menu

    $rootScope.$on('$stateChangeStart', function (e, next) {
      if ($scope.menu.isShown()) {
        clearTimeout(timeout)
        timeout = setTimeout(function() {
          $scope.menu.hide()
        }, 60)
      }
    })

    $scope.$on('$destroy', function() {
      $scope.menu.remove()
    })
  })
})

// Welcome
.controller('WelcomeController',
  function($scope, $state, Global) {

  Global.hasBeenWelcomed(true)
})

// Login
.controller('LoginController',
  function($rootScope, $scope, $state, $ionicViewService, $ionicPopup, Global, User, Positions, Sites, Notifications, PushNotifications) {

  if (Global.isLoggedIn()) {
    User.logout()
  }  

  $scope.user = {}
  $scope.blurred = {}
  $scope.validationClass = $scope.ValidationClass($scope)

  var failed

  $scope.success = function() {
    return failed == undefined
  }

  $scope.$watch('user.password', function() {
    failed = undefined
  })

  $scope.login = function(form) {
    var invalidFields = form.$error.required

    if (invalidFields.length) {
      return invalidFields.forEach(function(field) {
        $scope.blurred[field.$name] = true
      })
    }

    var attempt = User.login(
      form.email.$viewValue,
      form.password.$viewValue
    )
     
    var succeed = function(response) {
      document.activeElement.blur()
      Global.isLoggedIn(true)
      Sites.init()
      Notifications.init()
      PushNotifications.init()

      var user = response.data.user
      var hasSites = user.sites['0']
      var isAdmin = (
        user.roles[0].name == 'companyAdmin' ||
        user.roles[0].name == 'communicationsManager'
      )
      
      if (!hasSites && !isAdmin) {
        return User.logout().then(function() {
          $ionicPopup.alert({
            title: 'Error',
            template: 'Sorry, you aren’t assigned to any sites.',
            okType: 'button-assertive'
          }).then(function() {
            location.reload()
          })
        })
      }

      $rootScope.selectedType = 'Received'
      $ionicViewService.nextViewOptions({ disableAnimate: true }) 

      setTimeout(function() {
        $state.go('notifications')
      })
    }

    var fail = function(message) {
      document.activeElement.blur()
      failed = true
      $scope.blurred.password = true
    }

    attempt.then(succeed, fail)
  }
})

// Reset password
.controller('ResetPasswordController',
  function($scope, $state, User) {

  var failed
  $scope.user = {}
  $scope.blurred = {}
  $scope.validationClass = $scope.ValidationClass($scope)

  $scope.notUnknownError = function() {
    return !failed || failed == 404
  }

  $scope.failMessage = function() {
    return failed == 404 ? 'not found' : ''
  }

  $scope.success = function() {
    return failed == undefined
  }

  $scope.$watch('user.email', function() {
    failed = undefined
  })

  $scope.reset = function() {
    User.resetPassword($scope.user.email).then(
      function() { $state.go('login') },
      function(res) {
        failed = res.status
        if (failed != 404) {
          $scope.throwError()
          failed = undefined
        }
      }
    )
  }  
})

// Sign up
.controller('SignUpController',
  function($scope, $state) {

  $scope.user = {}
  $scope.blurred = {}
  $scope.validationClass = $scope.ValidationClass($scope)

  $scope.passwordsMatch = function() {
    var filled = $scope.user.password && $scope.user.passwordConfirmation
    var match = $scope.user.password == $scope.user.passwordConfirmation

    return filled ? match : true
  }

  $scope.signup = function() {
    var invalidFields = (form.$error || {}).required || []

    if ($scope.user.password != $scope.user.passwordConfirmation) {
      invalidFields.push({ $name: 'passwordConfirmation' })
    }

    if (invalidFields.length) {
      return invalidFields.forEach(function(field) {
        $scope.blurred[field.$name] = true
        $scope.user[field.$name] = ''
      })
    }

    console.log('signup', $scope.user)
  }
})

// Profile
.controller('ProfileController',
  function($scope, $state, $ionicModal, $ionicActionSheet, $ionicPopup, $filter, Store, User, Locations, Media) {

    var leftButtonClasses = 'button button-icon button-clear icon ion-navicon'
    var rightButtonClasses = 'button button-clear'
    
    $scope.addNotificationsToMenu()

    $scope.blurred = {}
    $scope.validationClass = $scope.ValidationClass($scope)

    $scope.editing = false
    $scope.leftButton = ''
    $scope.rightButton = 'Edit'
    $scope.leftButtonClasses = leftButtonClasses 
    $scope.rightButtonClasses = rightButtonClasses 

    $scope.needsMessage = function() {
      return !$scope.user.avatar ||
        $scope.needsUserDetails()
    }

    $scope.needsUserDetails = function() {
      return !$scope.user.firstName ||
        !$scope.user.lastName
    }
    
    var enterEditMode = function() {
      $scope.editing = true
      $scope.leftButton = 'Cancel'
      $scope.rightButton = 'Save'
      $scope.rightButtonClasses = rightButtonClasses + ' button-balanced'
      $scope.leftButtonClasses = rightButtonClasses
    }

    var exitEditMode = function(saved) {
      var exit = function() {
        $scope.editing = false
        $scope.leftButton = ''
        $scope.rightButton = 'Edit'
        $scope.rightButtonClasses = rightButtonClasses
        $scope.leftButtonClasses = leftButtonClasses
      }
      if (saved) {
        $scope.user.avatar = $scope.user.tempPhoto || $scope.user.photo || $scope.user.avatar
        var invalidFields = (form.$error || {}).required || []

        if (invalidFields.length) {
          return invalidFields.forEach(function(field) {
            $scope.blurred[field.$name] = true
          })
        }

        if ($scope.user.tempPhoto) {
          Media.upload($scope.user, $scope.user.tempPhoto, {
            id: $scope.user.id,
            type: 'user'
          })
            .then(function() {
              console.log('SUCCE$$')
              console.log(arguments) 
              $scope.user.photo = null
              $scope.user.tempPhoto = null
              User.current($scope.user).then(exit)
            }, function() {
              console.log('FAILURE')
              console.log(arguments)
              $ionicPopup.alert({
                title: 'Error',
                template: 'There was a problem uploading this photo.',
                okType: 'button-assertive'
              })
            })
        }
        else {
          $scope.user.photo = null
          $scope.user.tempPhoto = null
          User.current($scope.user).then(exit, function(message) {
            $ionicPopup.alert({
              title: 'Error',
              template: message || 'Something went wrong.',
              okType: 'button-assertive'
            })
          })
        }
      }
      else {
        $scope.user.tempPhoto = null
        util.merge($scope.user, User.current())
        exit()
      }
    }

    var save = function() {
      exitEditMode(true)
    }

    $scope.leftButtonClick = function() {
      $scope.leftButton == 'Cancel' ?
        exitEditMode(false) : 
        $scope.menu.show()
    }

    $scope.rightButtonClick = function() {
      $scope.rightButton == 'Edit' ?
        enterEditMode() :
        save()
    }

    $scope.user = User.current() || {}
    $scope.user.roleIds = $scope.user.roleIds || []

    $scope.photos = Store.get('photos') || []

    $scope.needsPhoto = function() {
      return $scope.editing &&
        !$scope.user.avatar &&
        !$scope.user.tempPhoto
    }
  
    $scope.usePhoto = function(image) {
      $scope.user.tempPhoto = image
    }

    var map = {
      locationId: { title: 'City/Town' }
    }

    Locations.get().then(function(locations) {
      $scope.$watch('user.locationId', function(val) {
        $scope.user.location = $filter('nameForThing')(val, locations)
      })

      map.locationId.options = [{ name: 'Not specified', id: null }]
        .concat($filter('sortByName')(locations))
    })
    
    $scope.openSelectFor = function(field, cancel) {  
      util.disableInputForASplitSecond(field)

      if (cancel) {
        return
      }

      setTimeout(function() {
        $scope.blurred[field] = true
      }, 100)

      $scope.selectedOption = $scope.user[field]
      $scope.title = map[field].title
      $scope.options = map[field].options

      $scope.select.show()

      $scope.selectOption = function(option) {

        $scope.selectedOption = option.id
        $scope.user[field] = option.id
        $scope.select.hide()
      }
    }

    $ionicModal
      .fromTemplateUrl('templates/select-search.html', {
        scope: $scope,
        animation: 'slide-in-right'
      })
      .then(function(modal) {
        $scope.select = modal
        $scope.done = function() {
          $scope.select.hide()
        }
        $scope.$on('$destroy', function() {
          $scope.select.remove()
        })
      })

    $scope.selectProfilePhoto = function() {
      if (!navigator.camera) {
        $scope.$emit('launchImagePicker', 'profile-photo-picker')
        return
      }

      $ionicActionSheet.show({
        buttons: [
          { type: 'CAMERA', text: 'Take Photo' },
          { type: 'PHOTOLIBRARY', text: 'Choose Existing' }
        ],
        cancelText: 'Cancel',
        buttonClicked: function(index) {
          var sourceType = Camera.PictureSourceType[this.buttons[index].type]
          $scope.$emit('launchImagePicker', 'profile-photo-picker', sourceType)
          return true
        }
      })
    }
  })

// Notifications
.controller('NotificationsController',
  function($rootScope, $scope, $state, $ionicModal, $ionicScrollDelegate, User, Sites, Notifications) {
  $scope.addNotificationsToMenu()

  $scope.showNotificationsSearch = function() {
    $state.go('notificationsSearch', {}, { location: false })
  }

  $scope.showNotificationCreate = function() {
    $state.go('notificationCreate', {}, { location: false })
  }

  $scope.doRefresh = function() {
    if (!User.current()) {
      return
    }

    $rootScope.refresh()
    $scope.$broadcast('scroll.refreshComplete')
  }

  Sites.get().then(function(sites) {
    $scope.sites = sites
    $rootScope.selectedSite = $rootScope.selectedSite
  })

  $rootScope.selectedType = (
    $rootScope.selectedType ||
    'Received'
  )

  $scope.selectType = function(type) {
    $ionicScrollDelegate.scrollTop(false)
    $rootScope.selectedType = type
  }

  $scope.selectSite = function(site) {
    $rootScope.selectedSite = site
    $rootScope.selectedType = 'Received'
    $ionicScrollDelegate.scrollTop(false)
    if ($scope.modal.isShown()) {
      $scope.modal.hide()
    }
  }

  $scope.isSelectedSite = function(site) {
    return $rootScope.selectedSite == site
  }

  $scope.openSiteSelector = function() {
    var hasSelectedSite = !!$rootScope.selectedSite
    $scope.modal.animation = hasSelectedSite ? 'slide-in-up' : 'none'
    $scope.modal.backdropClickToClose = hasSelectedSite

    return $scope.modal.show()
  }

  $ionicModal
    .fromTemplateUrl('templates/notifications-site-selector.html', {
      scope: $scope,
      animation: 'slide-in-up'
    })
    .then(function(modal) {
      var backdrop = angular.element(modal.el)
      backdrop.addClass('selector-modal-backdrop')
      $scope.modal = modal
      $scope.$on('$destroy', function() {
        $scope.modal.remove()
      })

      if (!$rootScope.selectedSite) {
        $scope.openSiteSelector()
      }
    })
})

// Notifications Search
.controller('NotificationsSearchController',
  function($rootScope, $scope, $state, Notifications) {

  $scope.$watch('query', function(value) {
    $rootScope.query = value 
  })

  $scope.done = function() {
    $state.transitionTo('notifications')
      .then(function() {
        // Our scope is dead, so unset on rootScope.
        $rootScope.query = ''
      })
  }

  Notifications.get().then(function(notifications) {
    $rootScope.notifications = notifications
  })
})

// Notification
.controller('NotificationController',
  function($filter, $scope, $state, User, Notifications) {

  $scope.back = function() {  
    history.back()
  }

  $scope.canEditNotification = function() {
    return User.current().canEditNotifications || false
  }

  $scope.edit = function() {
    $state.go(
      'notificationEdit',
      { id: $scope.notification.id },
      { location: false }
    )
  }

  $scope.showNotificationPhotos = function() {
    // We don’t add a history state for the
    // photos page because it wrecks havoc
    // with the back button on notifications
    // selected from search results.
    $state.go(
      'notificationPhotos',
      { id: $scope.notification.id },
      { location: false }
    )
  }
  
  Notifications
    .get($state.params.id)
    .then(function(notification) {
      $scope.notification = notification
      var exists = !!notification
      var unread = exists ?
        !notification.read || !notification.read.viewedAt :
        false

      if (exists && unread) {
        Notifications.markAsRead(notification)
      }
    })
})

// Notification Photos
.controller('NotificationPhotosController',
  function($filter, $scope, $state, $ionicScrollDelegate, $ionicSlideBoxDelegate, Notifications) {

  $scope.zooming = false
  $scope.toggleZooming = function() {
    $scope.zooming = !$scope.zooming
  }
 
  $scope.$watch('zooming', function() {
    $ionicScrollDelegate.zoomTo(1)
    $ionicSlideBoxDelegate.enableSlide(!$scope.zooming)
  })

  $scope.back = function() {
    $state.go('notification', { id: $state.params.id })
  }

  Notifications
    .get($state.params.id)
    .then(function(notification) {
      $scope.notification = notification
    })
})

// Notification Create
.controller('NotificationCreateController',
  function($rootScope, $scope, $state, $filter, $ionicModal, $ionicPopup, $ionicLoading, API, Store, User, Notifications, Sites, NotificationTypes, AlertTypes) {

  var isEditing = $scope.isEditing = $state.params.id != undefined
  var user = User.current()

  $scope.canEditNotification = function() {
    return user && user.canEditNotifications
  }

  $scope.canSetStatus = function() {
    return user && user.canSetStatus
  }

  $scope.optionalLabel = function(field) {
    return $scope.canSetStatus() ? field :
      field + ' (optional)'
  }

  $scope.cancel = function() {
    Notifications.refresh();
    $state.go('notifications');
  }

  $scope.notification = { attachments: [] }

  if (isEditing) {
    if (!$scope.canEditNotification()) {
      return $state.go(
        'notification',
        { id: $state.params.id },
        { location: false }
      )
    }

    Notifications
      .get($state.params.id)
      .then(function(notification) {
        $scope.notification = notification
        $scope.notification.oldAttachments = $filter('array')(notification.attachments)
        $scope.notification.attachments = $filter('array')(notification.attachments)
        $scope.notification.statusId = $filter('idForName')(notification.status, statusTypes)
      })
  }

  $scope.blurred = {}
  $scope.validationClass = $scope.ValidationClass($scope)

  var map = {
    siteId: { title: 'Site' },
    notificationTypeId: { title: 'Notification Type' },
    alertTypeId: { title: 'Alert Type' },
    statusId: { title: 'Notification Status' }
  }
 
  Sites.get().then(function(sites) {
    $scope.$watch('notification.siteId', function(val) {

      $scope.notification.site = $filter('nameForThing')(val, sites)
    })
    map.siteId.options = sites
  })

  NotificationTypes.get().then(function(types) {
    $scope.$watch('notification.notificationTypeId', function(val) {
      $scope.notification.notificationType = $filter('nameForThing')(val, types)
      map.alertTypeId.options = [{ name: 'No alert type', id: null }]
        .concat($filter('sortByName')($filter('alertTypesForNotificationType')(val, types)))

      if (!isEditing || !$scope.notification.notificationTypeId) {
        $scope.notification.alertTypeId = null
      }
    })

    map.alertTypeId.options = [{ name: 'No alert type', id: null }]

    map.notificationTypeId.options = [{ name: 'No notification type', id: null }]
      .concat($filter('sortByName')(types))
  })

  AlertTypes.get().then(function(types) {
    $scope.$watch('notification.alertTypeId', function(val) {
      $scope.notification.alertType = $filter('nameForThing')(val, types)
    })
  })

  var statusTypes = [
    { id: 0, name: 'Pending' },
    { id: 1, name: 'Published' },
    { id: 2, name: 'Rejected' },
    { id: 3, name: 'Delete' }
  ]

  $scope.$watch('notification.statusId', function(val) {
    $scope.notification.status = $filter('nameForThing')(val, statusTypes)
  })

  map.statusId.options = statusTypes
  $scope.notification.statusId = $scope.canSetStatus() ? 1 : 0
  $ionicModal
    .fromTemplateUrl('templates/select.html', {
      scope: $scope,
      animation: 'slide-in-right'
    })
    .then(function(modal) {
      $scope.select = modal
      $scope.$on('$destroy', function() {
        $scope.select.remove()
      })
    })

  $ionicModal
    .fromTemplateUrl('templates/notification-photos.html', {
      scope: $scope,
      animation: 'slide-in-right'
    })
    .then(function(modal) {
      $scope.photoViewer = modal
      $scope.back = function() {
        $scope.photoViewer.hide()
      }
      $scope.viewPhotos = function() {
        $scope.photoViewer.show()
      }
      $scope.$on('$destroy', function() {
        $scope.photoViewer.remove()
      })
    })

  $ionicModal
    .fromTemplateUrl('templates/camera-roll.html', {
      scope: $scope,
      animation: 'slide-in-right'
    })
    .then(function(modal) {
      $scope.cameraRoll = modal
      $scope.selected = isEditing ? $scope.notification.attachments.slice() : []
      $scope.photos = isEditing ? $scope.notification.attachments.slice() : []
      $scope.photos.forEach(function(photo) {
        if (!photo.url) {
          photo.url = $filter('thumbnailUrl')(photo)
        } 
      })
      $scope.toggle = function(photo) {
        var index = $scope.selected.indexOf(photo)
        index >= 0 ?
          $scope.selected.splice(index, 1) :
          $scope.selected.push(photo)
      }
      $scope.discard = function() {
        $scope.selected = $scope.notification.attachments.slice()
        $scope.cameraRoll.hide()
      }
      $scope.use = function() {
        $scope.cameraRoll.hide()
        $scope.notification.attachments = $scope.selected
      }
      $scope.$on('$destroy', function() {
        $scope.cameraRoll.remove()
      })
    })

  $scope.openCameraRoll = function() {
    $scope.selected = $scope.notification.attachments.slice()
    $scope.cameraRoll.show()
  }

  $scope.addPhoto = function(photo) {
    var alreadyAdded = !!util.pluck($scope.photos, function(p) {
      return photo.url == p.url
    })

    if (!alreadyAdded) {
      $scope.photos.push(photo)
      $scope.selected.push(photo)

      // We could cache the image data, but localStorage
      // has a 5mb limit, and at this stage I can’t be
      // bothered switching to IndexedDB.
      // Store.set('photos', $scope.photos)
    }
  }

  $scope.openSelectFor = function(field, cancel) {    
    util.disableInputForASplitSecond(field)

    if (cancel) {
      return
    }

    setTimeout(function() {
      $scope.blurred[field] = true
    }, 100)

    $scope.selectedOption = $scope.notification[field]
    $scope.title = map[field].title
    $scope.options = map[field].options

    $scope.select.show()

    $scope.selectOption = function(option) { 
      $scope.selectedOption = option.id
      $scope.notification[field] = option.id  
      $scope.select.hide()
    }
  }

  var highlightInvalidFields = function(form) {
    var invalidFields = (form.$error || {}).required || []

    invalidFields.forEach(function(field) {
      $scope.blurred[field.$name] = true
    })

    return !!invalidFields.length
  }

  $scope.validate = function(form) {
    if (highlightInvalidFields(form)) {
      $ionicPopup.alert({
        title: 'Error',
        template: 'Please fill in all the highlighted fields.',
        okType: 'button-assertive'
      })
    }
  }

  var processing = false
  $scope.create = function(notification) {
    if (processing || highlightInvalidFields(form)) {
      return
    }

    processing = true

    $ionicLoading.show({
      template: (isEditing ? 'Updating' : 'Creating') + ' notification…'
    })

    var attempt = Notifications.create(notification, isEditing)
    var succeed = function(response) {
      processing = false
      Notifications.refresh().then(function() {
        console.log('About to transition to new notification')
        ionic.requestAnimationFrame(function() {
          $ionicLoading.hide()
          if (response.data.status == 'Archived') {
            $state.transitionTo('notifications');
          }
          else {
            $state.transitionTo('notification', {
              id: response.data.id
            })
          }
        })
      })
    }

    var fail = function(response) {
      processing = false

      Notifications.refresh().then(function() {
        $ionicLoading.hide()
        $ionicPopup.alert({
          title: 'Error',
          template: (function () {
            var messages = []
            if (response.data instanceof Object) {
              for (var field in response.data) {
                if (response.data.hasOwnProperty(field)) {
                  messages.push(response.data[field].join('<br>'))
                }
              }
            }
            return messages.length ?
              messages.join('<br>') :
              'Something went wrong.'
          })(),
          okType: 'button-assertive'
        })
      })
    }

    attempt.then(succeed, fail)
  }
})

.controller('SettingsController',
  function($scope, $state, $ionicModal, User) {

  $scope.addNotificationsToMenu()

  var leftButtonClasses = 'button button-icon button-clear icon ion-navicon'
  var rightButtonClasses = 'button button-clear'

  var password = document.getElementById('password')
  var changePassword = document.getElementById('change-password')

  $scope.user = User.current()
  $scope.blurred = {}
  $scope.validationClass = $scope.ValidationClass($scope)
  $scope.editing = false
  $scope.passwordsMatch = function() {
    var filled = $scope.user.password && $scope.user.passwordConfirmation
    var match = $scope.user.password == $scope.user.passwordConfirmation

    return filled ? match : true
  }

  var failed = undefined

  $scope.success = function() {
    return failed == undefined
  }

  $scope.$watch('user.oldPassword', function() {
    failed = undefined
  })

  $scope.leftButton = ''
  $scope.rightButton = 'Edit'
  $scope.leftButtonClasses = leftButtonClasses 
  $scope.rightButtonClasses = rightButtonClasses 
  
  var enterEditMode = function() {
    $scope.blurred = {}
    password.style.display = 'none'
    $scope.editing = true
    $scope.leftButton = 'Cancel'
    $scope.rightButton = 'Save'
    $scope.leftButtonClasses = rightButtonClasses
    $scope.rightButtonClasses = 'button button-clear button-balanced'
  }

  var exitEditMode = function() {
    password.style.display = 'block'
    $scope.editing = false
    $scope.leftButton = ''
    $scope.rightButton = 'Edit'
    $scope.leftButtonClasses = leftButtonClasses
    $scope.rightButtonClasses = rightButtonClasses
  }

  var save = function() {
    var invalidFields = (form.$error || {}).required || []

    if (invalidFields.length) {
      return invalidFields.forEach(function(field) {
        $scope.blurred[field.$name] = true
      })
    }

    User.current($scope.user).then(
      function success() {
        exitEditMode()
      },
      function error(message) {
        failed = true
        if (/old password/.test(message)) {
          $scope.blurred.oldPassword = true
        }
      }
    )
  }

  var cancel = function() {
    util.merge($scope.user, User.current())
    exitEditMode()
  }

  $scope.leftButtonClick = function() {
    $scope.leftButton == 'Cancel' ?
      cancel() : 
      $scope.menu.show()
  }

  $scope.rightButtonClick = function() {
    $scope.rightButton == 'Edit' ?
      enterEditMode() :
      save()
  }
})
