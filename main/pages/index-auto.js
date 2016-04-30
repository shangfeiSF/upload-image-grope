(function (win) {
  var MultipleUploader = win.MultipleUploader
  var container = $('#images-auto')

  var callbacks = {
    progress: function () {
      console.info('Uploading....')
    },
    completed: function (data) {
      console.info('Completed All:', data)
    },
    change: function (feedback) {
      console.warn('Update Info', feedback)
    },
    success: function (result) {
      console.info('one step successfully:', result)
      var data = typeof result === 'string' ? JSON.parse(result) : result

      $.each(data.links, function (i, link) {
        container.append($('<img>', {
          src: link.format ? link.format : link.quality
        }))
      })
    },
    error: function (error) {
      console.error('one step failed:', error)
    }
  }

  var multipleUploader = new MultipleUploader({
    container: '#images-auto',
    name: 'images',
    action: '/upload',
    accept: 'image/*',
    multiple: true,
    autoSubmit: true,
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

  $('#upload-auto').on('click', function () {
    multipleUploader.add()
  })
})(window)