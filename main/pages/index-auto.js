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
    },
    success: function (result) {
      console.info('one step successfully:', result)

      var data = typeof result === 'string' ? $.parseJSON(result) : result

      $.each(data.links, function (i, link) {
        var img = $('<img>')

        img.addClass('image')
        img.attr('src', link.format ? link.format : link.quality)
        
        container.append(img)
      })
    },
    error: function (error) {
      console.error('one step failed:', error)
    }
  }

  var multipleUploader = new MultipleUploader({
    container: '#images',
    trigger: '#submit',
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

  multipleUploader.init(function () {
    console.log(multipleUploader)
  })

})(window)