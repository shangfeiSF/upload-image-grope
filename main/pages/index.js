(function (win) {
  var MultipleUploader = win.MultipleUploader
  var container = $('#images')

  var callbacks = {
    progress: function () {
      console.info('Uploading....')
    },
    completed: function (data) {
      console.info('Completed All:', data)
    },
    change: function (feedback) {
      console.warn('Update Info', feedback)

      if (win.FormData) {
        var inputFiles = feedback.inputFiles
        var filesMap = feedback.filesMap

        if (feedback.removedFileIndex !== undefined) {
          var scope = [feedback.index, feedback.removedFileIndex].join('_')

          $.each(container.find('.wrap'), function (i, wrap) {
            var wrap = $(wrap)
            wrap.data('scope') === scope && wrap.remove()
          })
        }
        else {
          $.each(filesMap, function (i, file) {
            var original = inputFiles[file.index]

            if (!/^image\//.test(original.type)) return

            var wrap = $('<div class="wrap">')
            wrap.data('scope', [feedback.index, file.index].join('_'))

            var img = $('<img class="image">')
            wrap.append(img)

            if (!file.allow) {
              wrap.data('state', 'rejected')
              wrap.append($('<div class="rejected">'))
            } else {
              wrap.data('state', 'pending')
            }

            var remove = $('<i  class="remove"></i>')
            remove.data('index', feedback.index)
            remove.data('name', file.name)
            wrap.append(remove)

            var reader = new FileReader()
            reader.onload = (function (img) {
              return function (e) {
                img.attr('src', e.target.result)
              }
            })(img)
            reader.readAsDataURL(original)

            container.append(wrap)
          })
        }
      } else {
        if (feedback.removedFileIndex !== undefined) {
          var scope = [feedback.index, feedback.removedFileIndex].join('_')

          $.each(container.find('.item'), function (i, item) {
            var item = $(item)
            item.data('scope') === scope && item.remove()
          })
        }
        else {
          var filePath = feedback.inputFiles

          var item = $('<div class="item">')
          item.data('scope', [feedback.index, 0].join('_'))
          item.data('state', 'pending')

          var remove = $('<i  class="delete"></i>')
          remove.data('index', feedback.index)
          remove.data('name', filePath)
          item.append(remove)

          var content = $('<div class="filePath">')
          content.html(filePath)

          item.append(content)
          container.append(item)
        }
      }
    },
    success: function (result) {
      console.info('one step successfully:', result)

      if (win.FormData) {
        var links = result.links
        var wraps = container.find('.wrap')

        $.each(links, function (i, link) {
          var target = $.grep(wraps, function (wrap) {
            return $(wrap).data('scope') === link.scope
          })

          if (target.length === 1) {
            var target = $(target.pop())
            target.data('state', 'fulfilled')

            var image = target.find('.image')
            image.remove()
            image.attr('src', link.format ? link.format : link.original)
            image.removeClass('loading')
            target.prepend(image)
          }
        })
      }
    },
    error: function (error) {
      console.error('one step failed:', error)
    }
  }

  var multipleUploader = new MultipleUploader({
    container: '#images',
    trigger: '#add',
    name: 'images',
    action: '/upload',
    accept: 'image/*',
    multiple: true,
    autoSubmit: false,
    uploadSizeLimit: 0.7,
    headers: {
      "X-CSRF-Token": $('meta[name="csrf-token"]').attr('content')
    },
    progress: callbacks.progress,
    completed: callbacks.completed,
    change: callbacks.change,
    success: callbacks.success,
    error: callbacks.error
  })

  multipleUploader.init(function () {
    console.log(multipleUploader)
  })

  container.on('click', function (e) {
    var target = $(e.target)
    if (target.hasClass('remove') || target.hasClass('delete')) {
      var index = target.data('index')
      var name = target.data('name')

      multipleUploader.remove(index, name)
    }
  })

  $('#upload').on('click', function () {
    var wraps = container.find('.wrap')

    var pends = $.grep(wraps, function (wrap) {
      return $(wrap).data('state') === 'pending'
    })

    $.each(pends, function (i, allow) {
      $(allow).find('.image').addClass('loading').attr('src', 'http://localhost:8080/images/loading.gif')
    })
    multipleUploader.submit()
  })
})(window)