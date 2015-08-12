angular.module('site360.services', [])

.service('Store', function() {
  var store = localStorage || sessionStorage || {}
  this.get = function(key) {
    return angular.fromJson(store[key])
  }
  this.set = function(key, value) {
    store[key] = angular.toJson(value)
    return value
  }
  this.unset = function(key) {
    store.removeItem(key)
    return !store[key]
  } 
})

.service('API', function($rootScope, $q, $http, Store) {
  var cache = {}
  var root = this.root = (
    'http://admin.site360.com.au' ||
    'http://site360.testing.digital8.com.au' ||
    'http://10.20.1.185'
  )

  var method = function(name) {
    return function(endpoint, data) {
      if (!/^\/auth$/.test(endpoint)) {
        endpoint = '/api' + endpoint
      }

      var url = root + endpoint

      if (!/\?/.test(url)) {
        url += '?no-cache=' + +new Date
      }
  
      var request = $http({
        method: name,
        url: url,
        data: data,
        withCredentials: true
      })

      var log = function() {
        console.log(JSON.stringify(arguments))
      }

      // request.then(log, log)
      return request
    }
  }

  var filtered = function(data, filter) {
    if (!filter || !data) {
      return data
    }

    var result = data.filter(function(item) {
      var match = true

      for (var key in filter) {

        if (item.hasOwnProperty(key) && item[key] != filter[key]) {
          match = false
          break
        } 
      }

      if (match) {
        return item
      }
    })

    if (!result.length) {
      return null
    }

    if (result.length == 1) {
      return result[0]
    }

    return result
  }

  this.get = method('GET')
  this.post = method('POST')
  this.patch = method('PATCH')
  this.put = method('PUT')
  this.delete = method('DELETE') 

  this.setToken = function(token) {
    token = token || Store.get('token')

    if (token) {
      Store.set('token', token)
      $http.defaults.headers.common['X-Auth-Token'] = token
    }
  }

  this.getData = function(endpoint, filter, force) {
    var deferred = $q.defer()
    var cached = cache[endpoint]

    if (force) {
      console.log('forced to skip cache for', endpoint)
    }

    if (filter) {
      cached = filtered(cached, filter)
    }

    if (cached && !force) {
      console.log(endpoint, 'from cache')
      deferred.resolve(cached)
    }
    else if (!endpoint) {
      console.log('No endpoint')
      deferred.reject()
    }
    else {
      console.log('getting', endpoint)
      this.get(endpoint)
        .then(function(response) {          
          var raw = util.dateify(
            util.camelKeys(response.data)
          )

          var data = []
          for (var i in raw) {
            if (raw.hasOwnProperty(i)) {
              data.push(raw[i])  
            }
          }
          cache[endpoint] = data
          deferred.resolve(filtered(data, filter))
        }, function() {
          console.log('GET failed')
          $rootScope.ping()
        })
    }

    return deferred.promise
  }

  this.setToken()
})

.service('Global', function(API, Store) {
  var flag = function(key) {
    return function(value) {
      if (value == true || value == false) {
        Store.set(key, value)
      }
      return Store.get(key)
    }
  }

  this.ping = function(callback) {
    API.get('/auth').then(function(response) {
      var isLoggedIn = Store.set('isLoggedIn', !/404$/.test(response.data))
      callback(null, isLoggedIn)
    }, function(error) {
      callback(error)
    })
  }

  this.isLoggedIn = flag('isLoggedIn')
  this.hasBeenWelcomed = flag('hasBeenWelcomed') 
})

.service('PushNotifications', function(API, User, Notifications) {
  var PW_APP_ID = util.PW_APP_ID
  var GOOGLE_ID = util.GOOGLE_ID
  var PushNotifications = this

  this.init = function() {
    var platform = ionic.Platform
    var config = (
      platform.isIOS() ? { pw_appid: PW_APP_ID } :
      platform.isAndroid() ? { projectid: GOOGLE_ID, appid: PW_APP_ID } :
      platform.isWindowsPhone() ? { serviceName: '', appid: PW_APP_ID } :
      null
    )

    var canAcceptPushNotifications = (
      config &&
      window.plugins &&
      window.plugins.pushNotification &&
      User.current()
    )

    if (canAcceptPushNotifications) {
      console.log('CAN ACCEPT PUSH NOTIFICATIONS')
      var pushwoosh = this._pushwoosh = window.plugins.pushNotification
      pushwoosh.onDeviceReady(config)
      pushwoosh.setApplicationIconBadgeNumber(0)
      pushwoosh.registerDevice(function(response) {
        var token = response.deviceToken || response
        console.log('DEVICE REGISTERED WITH PUSHWOOSH', token)
        PushNotifications.register(token)
        document.addEventListener('push-notification', function(e) {
          console.log('RECEIVED PUSH NOTIFICATION', e)
          PushNotifications.queue(e.notification)
        })
      })
    }
    else {
      console.log('CAN’T ACCEPT PUSH NOTIFICATIONS')
    }
  }

  this.register = function(id) {
    var user = User.current()
    var company = user.companyId

    API.post('/companies/' + company + '/hwids', { hwid: id })
      .then(
        console.log.bind(console),
        console.error.bind(console)
      )
  }

  this.queue = function(notification) {
    console.log('GOT A NOTIFICATION')
    setTimeout(function() {
      Notifications.refresh()
    })
  }

  this.setBadge = function(number) {
    if (this._pushwoosh) {
      this._pushwoosh.setApplicationIconBadgeNumber(number)
    }
  }
})

.service('Media', function($q, $http, API, Store) {
  var media = Store.get('media') || []

  this.get = function(file) {
    return false
    return util.pluck(media, function(item) {
      return (
        item.filename == file.info.name &&
        item.size == file.info.size
      )
    })
  }

  this.upload = function(user, file, entity) {
    var deferred = $q.defer()
    var token = $http.defaults.headers.common['X-Auth-Token']
    var company = user.companyId

    var xhr = new XMLHttpRequest
    var data = new FormData
 
    xhr.open('POST', API.root + '/api/companies/' + company + '/media', true)
    xhr.setRequestHeader('Accept', 'application/json')
    xhr.setRequestHeader('X-Auth-Token', token)

    xhr.onerror = function(error) {
      console.log(error)
      deferred.reject(error)
    }

    xhr.onload = function() {
      var response = JSON.parse(xhr.response)
      var uploaded = response.file ?
        (response.file[0] || response.file) :
        response.files[response.files.length - 1]

      if (!uploaded) {
        deferred.reject('Something went wrong.')
        return
      }
      
      uploaded.url = (
        API.root + '/uploads/companies/' +
        company + '/' + uploaded.filename
      )

      if (uploaded.thumbnail) {
        uploaded.thumbnail = (
          API.root + '/uploads/companies/' +
          company + '/' + uploaded.thumbnail
        )
      }

      deferred.resolve(uploaded)
      media.push(uploaded)
      Store.set('media', media)
    }

    if (entity) {
      data.append('entityType', entity.type)
      data.append('entityId', entity.id)
    }

    data.append('file', file.data)
    xhr.send(data)

    return deferred.promise 
  }

  this.remove = function(user, file) {
    var company = user.companyId
    return API.delete('/companies/' + company + '/media/' + file.id)
  }
})

.service('User', function($rootScope, $q, API, Store) {
  var user = this

  this.current = function(user) {
    if (user) {
      var deferred = $q.defer()
      var endpoint = '/update-profile'
      delete user.avatar

      API.put(endpoint, util.snakeKeys(user))
        .then(function(response) {
          var erroneous = response.data instanceof Array

          if (erroneous) {
            deferred.reject(response.data.join(', '))
            return
          }

          var updated = util.camelKeys(response.data)
          var merged = util.merge(user, updated)

          delete merged.password
          delete merged.oldPassword
          delete merged.passwordConfirmation

          Store.set('currentUser', merged)
          deferred.resolve(merged)
        })

      return deferred.promise
    }

    return Store.get('currentUser')
  }

  this.login = function(email, password) {
    var credentials = {
      username: email,
      password: password
    }

    var attempt = API.post('/auth', credentials)
    var succeed = function(response) {
      var data = util.camelKeys(response.data)

      ;(function() {
        var roles = data.user.roles
        var canSetStatus = false
       
        for (var id in roles) {
          if (!roles.hasOwnProperty(id)) {
            continue
          }

          var role = roles[id]
          var allowed = (
            role.name == 'companyAdmin' ||
            role.name == 'communicationsManager'
          )

          if (allowed) {
            canSetStatus = true
          }
        }

        data.user.canSetStatus =
        data.user.canEditNotifications = canSetStatus
      })()

      API.setToken(data.token)
      Store.set('currentUser', data.user)
      $rootScope.$broadcast('login')
    }

    attempt.then(succeed)
    return attempt
  }

  this.resetPassword = function(address) {
    return API.post('/user/forgot', { email: address })
  }

  this.logout = function() {
    var deferred = $q.defer()

    API.setToken()
    Store.unset('token') &&
    Store.unset('isLoggedIn') &&
    Store.unset('currentUser') ?
      deferred.resolve() :
      deferred.reject()

    return deferred.promise 
  }
})

.service('Positions', function(API) {
  var endpoint = '/positions'

  this.get = function(id) {
    return API.getData(id ?
      endpoint + '/' + id :
      endpoint
    )
  }
})

.service('Locations', function(API, User) {
  var endpoint

  this.init = function() {
    endpoint = '/locations'
  }

  this.get = function(id) {
    return API.getData(id ?
      endpoint + '/' + id :
      endpoint
    )
  }

  this.refresh = function() {
    return API.getData(endpoint, null, true)
  }

  this.init()
})

.service('Sites', function(API, User) {
  var companyId
  var endpoint

  this.init = function() {
    companyId = (User.current() || {}).companyId
    endpoint = '/companies/' + companyId + '/sites'
  }

  this.get = function(id) {
    if (!companyId) {
      this.init()
    }

    return API.getData(id ?
      endpoint + '/' + id :
      endpoint
    )
  }

  this.refresh = function() {
    if (!companyId) {
      this.init()
    }

    return API.getData(endpoint, null, true)
  }

  this.init()
})

.service('AlertTypes', function(API) {
  var endpoint = '/alert_types'

  this.get = function(id) {
    return API.getData(id ?
      endpoint + '/' + id :
      endpoint
    )
  }
})

.service('NotificationTypes', function(API) {
  var endpoint = '/notification_types'

  this.get = function(id) {
    return API.getData(id ?
      endpoint + '/' + id :
      endpoint
    )
  }
})

.service('Notifications', function($rootScope, $q, $filter, API, User, Sites, AlertTypes, NotificationTypes, Media) {
  var user
  var userId
  var companyId
  var endpoint
  var created = []

  this.init = function() {
    user = User.current() || {}
    companyId = user.companyId
    userId = user.id
    endpoint = '/companies/' + companyId
  }

  this.get = function(id) {
    if (!companyId) {
      this.init()
    }

    var deferred = $q.defer()

    if (id != undefined) {
      var filter = { id: Number(id) }
    }

    API.getData(endpoint + '/notifications', filter)
      .then(function(notifications) {
        if (filter && filter.id && notifications instanceof Array) {
          notifications = notifications[0]
        }
        deferred.resolve(notifications)
      })

    return deferred.promise 
  }

  this.refresh = function() {
    if (!companyId) {
      this.init()
    }

    var fetch = API.getData(endpoint + '/notifications', null, true)

    fetch.then(function(notifications) {
      var hasLocalNotifications = $rootScope.notifications && $rootScope.notifications[0]
      if (!hasLocalNotifications) {
        return
      }

      var hasCurrentNotifications = util.equal(notifications, $rootScope.notifications)
      if (!hasCurrentNotifications) {
        console.log('Updating notifications')

        // Prepend created notifications
        if (created.length) {
          notifications.splice
            .bind(notifications, 0, 0)
            .apply(notifications, created)

          created = []
        }

        $rootScope.notifications = notifications
      }
      else {
        console.log('Local notifications are up to date')
      }
    })

    return fetch
  }

  this.create = function(data, isEditing) {
    var deferred = $q.defer()
    var media = []

    data.oldAttachments = data.oldAttachments || []
    data.attachments = data.attachments || []

    $filter('each')(data.oldAttachments, function(attachment) {
      var stillAttached = !!($filter('array')(data.attachments).filter(function(a) {
        return a.id == attachment.id
      }) || [])[0]

      if (!stillAttached) {
        var remove = Media.remove(user, attachment)
        media.push(remove)
      }
    })

    $filter('each')(data.attachments, function(attachment, i) {
      if (!attachment.data) {
        return
      }

      var upload = !isEditing ?
        Media.upload(user, attachment) :
        Media.upload(user, attachment, {
          id: data.id,
          type: 'notification'
        })

      upload.then(function(response) {
        data.attachments[i] = response
      })

      media.push(upload)
    })

    $q.all(media).then(function() {
      data.reportedBy = userId
      data.status = data.status || 'Pending'

      if (!user.canSetStatus) {
        data.status = 'Pending'
      }

      if (data.status == 'Delete') {
        data.status = 'Archived'
      }

      var request = isEditing ?
        API.put(endpoint + '/notifications/' + data.id, util.snakeKeys(data)) :
        API.post(endpoint + '/notifications', util.snakeKeys(data))

      request.then(function(response) {
        deferred.resolve(response) 
      }, function(error) {
        deferred.reject(error)
      })
    })

    return deferred.promise
  }

  this.markAsRead = function(notification) {
    var deferred = $q.defer()

    API.post(endpoint + '/sent-notifications', {
      id: notification.id,
      read: util.snakeKeys(notification.read)
    })
    .then(function(response) {
      var data = util.dateify(util.camelKeys(response.data))
      $rootScope.notifications = $rootScope.notifications
        .map(function(n) {
          if (n.id == notification.id) {
            n.read = data
          }
          return n
        })

      setTimeout(function() {
        deferred.resolve(response)
      })
    }, function(error) {
      deferred.reject(error)
    })

    return deferred.promise
  }

  this.init()
})
