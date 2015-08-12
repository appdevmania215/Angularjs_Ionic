angular.module('site360.filters', [])

.filter('fullName', function(User) {
  return function(person) {
    var user = User.current()

    if (!person) {
      return ''
    }

    if (user && person.id == user.id) {
      person = user
    }

    return (
      person.firstName + ' ' +
      person.lastName
    )
  }
})

.filter('siteAddress', function() {
  return function(site) {
    return (
      site.street + '\n' +
      site.suburb + ', ' +
      site.state + ' ' +
      site.postcode
    )
  }
})

.filter('idForName', function() {
  return function(name, things) {
    return (things.filter(function(t) {
      return t.name == name
    })[0] || {}).id
  }
})

.filter('nameForThing', function() {
  return function(id, things) {  
    return (things.filter(function(t) {    
      return t.id == Number(id)
    })[0] || {}).name
  }
})

.filter('alertTypesForNotificationType', function($filter) {
  return function(id, things) {
    return $filter('array')((things.filter(function(t) {
      return t.id == Number(id)
    })[0] || {}).alertTypes)
  }
})

.filter('forSite', function() {
  return function(items, site) {
    if (!site) {
      return
    }

    var result = []
    var item = null

    for (var i in items) {
      if (!items.hasOwnProperty(i)) {
        continue
      }

      item = items[i]

      var itemSiteId = item.siteId

      if (!itemSiteId) {
        itemSiteId = item.site ? item.site.id : null
      }

      if (itemSiteId == site.id) {
        result.push(item)
      }
    }

    return result
  }
})

.filter('forType', function(User) {
  var user = User.current()
  return function(items, type) {
    var result = []

    for (var i in items) {
      if (!items.hasOwnProperty(i)) {
        continue
      }

      var item = items[i]
      var sentItem = type == 'Sent' && item.reporter.id == user.id
      var receivedItem = type == 'Received' && item.reporter.id != user.id
      var acceptableItem = sentItem || receivedItem

      if (acceptableItem) {
        result.push(item)
      }
    }

    return result
  }
})

.filter('lowerMeridiem', function() {
  return function(time) {
    var parts = time.match(/^(.+)(am|pm)$/i)
    return parts && parts.length == 3 ?
      parts[1] + parts[2].toLowerCase() :
      time
  }
})

.filter('cropDate', function($filter) {
  return function(date, format) {
    var today = $filter('date')(new Date, format)
    return date.replace(today, '')
  }
})

.filter('wordLimit', function() {
  return function(text, count) {
    return text
      .split(' ')
      .slice(0, count)
      .join(' ') +
      '…'
  }
})

.filter('charLimit', function() {
  return function(text, count) {
    if (text.length <= count) {
      return text
    }

    var words = text.split(' ')

    var result = ''
    var i = 0
    var l = words.length
    var n = 0
    var m = 0

    for (; i < l; i++) {
      m = result.length
      n = words[i].length

      if (m >= count) {
        break
      }
      else if (m + n + 1 < count) {
        result += ' ' + words[i]
      }
      else {
        var diff = (m + n) - count - 2
        result += ' ' + words[i].substr(0, n - diff)
      }
    }

    return result + '…'
  }
})

.filter('titleCase', function() {
  return function(text) {
    return text ? util.toTitleCase(text) : ''
  }
})

.filter('unreadCount', function() {
  return function(collection) {
    return collection ? collection.filter(function(item) {
      return !item.read || !item.read.viewedAt
    }).length : 0
  }
})

.filter('urlify', function() {
  return function(url) {
    return /^https?:\/\//.test(url) ? url : 'http://' + url 
  }
})

.filter('imageUrl', function(API) {
  return function(attachment, property) {
    if (!attachment) return

    property = property || 'filename'

    if (attachment[property]) {
      return (
        API.root + '/uploads/companies/1/' +
        attachment[property].replace(/^.*\/([^\/]+)$/, '$1')
      )
    }

    return attachment.url
  }
})

.filter('thumbnailUrl', function($filter, API) {
  return function(attachment) {
    if (!attachment) return
    return $filter('imageUrl')(attachment, 
      attachment.thumbnail ? 'thumbnail' : 'filename'
    )
  }
})

.filter('numberOfImages', function($filter) {
  return function(object) {
    return $filter('array')(object).filter(function(a) {
      return a.key && a.key == 'image'
    }).length
  }
})

.filter('images', function($filter) {
  return function(object) {
    return $filter('array')(object).filter(function(a) {
      return a && a.key ? a.key == 'image' : true
    })
  }
})

.filter('numberOfKeys', function() {
  return function(object) {
    return Object.keys(object).length
  }
})


.filter('numberOfKeys', function() {
  return function(object) {
    return Object.keys(object).length
  }
})

.filter('array', function() {
  return function(object) {
    if (Array.isArray(object)) {
      return object
    }

    var array = []
    if (object instanceof Object) {
      for (var key in object) {
        if (object.hasOwnProperty(key)) {
          array.push(object[key])
        }
      }
    }
    return array.reverse()
  }
})

.filter('each', function() {
  return function (object, fn) {
    var index = 0
    for (var key in object) {
      if (object.hasOwnProperty(key)) {
        fn.call(object, object[key], index++)
      }
    }
  }
})

.filter('sortByName', function() {
  return function (array) {
    return (array || []).sort(function (a, b) {
      return a.name > b.name ? 1 : -1    
    })
  }
})
