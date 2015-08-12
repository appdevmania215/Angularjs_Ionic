angular.module('site360.directives', [])

.directive('breakNewLines', function() {
  return {
    restrict: 'A',
    link: function($scope, element) {
      setTimeout(function() {
        var html = element.text().replace(/\n/g, '<br>')
        element.html(html)
      })
    }
  }
})

// For some reason naming the directive 'autofocus' causes
// issues on the NotificationsSearch page. Weird as.
.directive('autofocusify', function() {
  return {
    restrict: 'A',
    link: function($scope, element, attrs) {
      var field = element[0]
      var delay = Number(attrs.autofocusify) || 0

      setTimeout(field.focus.bind(field), delay)
    }
  }
})

.directive('imagepicker', function() {
  return {
    restrict: 'A',
    link: function($scope, element, attrs) {
      if (attrs.imagepickerOpenOnClick) {
        element.on('click', function() {
          $scope.$emit('launchImagePicker', element.attr('id'))
        })
      }

      $scope.$on('launchImagePicker', function(e, id, sourceType) {
        if (attrs.disabled || element.attr('id') != id) {
          return
        }

        if (navigator.camera) {
          console.log('NAVIGATOR.CAMERA') 
          var options = {
            cameraDirection: Camera.Direction.BACK,
            correctOrientation: true,
            destinationType: Camera.DestinationType.DATA_URL,
            encodingType: Camera.EncodingType.JPEG,
            quality: 49,
            sourceType: (sourceType == undefined ?
              Camera.PictureSourceType.CAMERA :
              sourceType
            )
          }

          if (attrs.imagepickerFrontFacing) {
            options.cameraDirection = Camera.Direction.FRONT
          }

          if (attrs.imagepickerWidth && attrs.imagepickerHeight) {
            options.targetWidth = Number(attrs.imagepickerWidth)
            options.targetHeight = Number(attrs.imagepickerHeight)
          }

          if (sourceType == undefined && attrs.multiple) {
            options.sourceType = Camera.PictureSourceType.PHOTOLIBRARY
          }

          return navigator.camera.getPicture(function(data) {
            setTimeout(function() {
              $scope.$apply(function() {
                $scope[attrs.imagepickerCallback]({
                  data: data,
                  url: 'data:image/jpeg;base64,' + data
                })
              })
            })
          }, console.error.bind(console), options)
        }
      
        var input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.multiple = attrs.multiple || false
        input.onchange = function() {
          input.blur()
          Array.prototype.forEach.call(input.files, function(file) {
            util.dataURI(file, function(error, data) {
              $scope.$apply(function() {
                $scope[attrs.imagepickerCallback]({
                  data: data.replace(/^.*,(.+)$/, '$1'),
                  url: data
                })
              })
            })
          })
        }
        input.click()
      })
    }
  }
})
