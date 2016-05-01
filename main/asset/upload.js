(function (win, $) {
  var iframeCount = 0

  function Uploader(index, superior) {
    if (!(this instanceof Uploader)) {
      return new Uploader(index)
    }

    this.formTargetIframePrefix = 'iframe-uploader-'
    this.superior = superior // access options and config in MultipleUploader instance form superior
    this.index = index //  index is the order of adding action
    /*
     * state indicates the status of Uploader instance for uploading
     * 'pending' means that Uploader instance is waiting for uploading
     * 'fulfilled' means that Uploader instance has uploaded successfully
     * 'rejected' means that Uploader instance has uploaded failed
     * */
    this.state = 'pending'
    /*
     * If the total size of selected images is beyond the uploadSizeLimit(MB)
     * Uploader instance will upload these images by a few steps
     * */
    this.steps = []
    // the sum of stepSuccessTimes and stepErrorTimes must be equal to the length of steps
    this.stepSuccessTimes = 0
    this.stepErrorTimes = 0
    this.inputFiles = null // inputFiles caches the FileList Object given by input DOM
    /*
     * the FileList Object can not be handled, so using the filesMap to manage the queue for uploading
     * actually when users remove images to upload, the images removed will be popped form filesMap
     * */
    this.filesMap = undefined
    this.filesSize = undefined // the total size of images in filesMap

    this.render()
    this.bind()
  }

  $.extend(Uploader.prototype, {
    render: function () {
      var self = this
      var superior = self.superior

      var options = superior.options
      var config = superior.config

      self.input = self.buildInput({
        type: 'file',
        hidefocus: true,
        'data-index': self.index
      }, ['name', 'accept', 'multiple'])

      if (config.supportFormData) {
        // use formData to upload
        self.input.hide().appendTo(options.container)
      }
      else {
        // use iframe to upload
        self.formTargetIframe = $('<iframe name="' + self.formTargetIframePrefix + iframeCount++ + '"></iframe>').hide()

        self.form = self.buildForm({
          method: 'post',
          enctype: 'multipart/form-data'
        }, ['action']).hide()

        self.form.append(
          self.buildInput({
            type: 'text',
            name: 'type',
            value: 'html'
          })
        )

        self.input.css({
          position: 'absolute',
          right: 0,
          top: 0,
          'font-size': '100px',
          filter: 'progid:DXImageTransform.Microsoft.Alpha(Opacity=0)'
        })

        options.trigger
          .css('position', 'relative')
          .append(self.input)
      }
    },

    setDynamicProps: function (dom, dynamicProps) {
      if (!dynamicProps) return null

      var options = this.superior.options

      $.each(dynamicProps, function (i, prop) {
        var value = options[prop]
        value && (dom.attr(prop, value))
      })
    },

    buildInput: function (aptoticProps, dynamicProps) {
      var input = $('<input>', aptoticProps)

      this.setDynamicProps(input, dynamicProps)
      input.css({
        outline: 0,
        cursor: 'pointer'
      })

      return input
    },

    buildForm: function (aptoticProps, dynamicProps) {
      var form = $('<form>', aptoticProps)

      this.setDynamicProps(form, dynamicProps)
      form.attr('target', this.formTargetIframe.attr('name'))

      return form
    },

    bind: function () {
      var self = this

      self.input.change(function (e) {
        // inputFiles caches the FileList Object given by input DOM or the file path in IE7-IE9
        self.inputFiles = (this.files && this.files.length) ? this.files : e.target.value

        self.census()

        self.change()
      })
    },

    census: function () {
      var self = this
      var superior = self.superior

      var options = superior.options
      var config = superior.config

      if (!config.supportFormData) return null

      self.filesMap = new Array()
      self.filesSize = 0
      $.each(self.inputFiles, function (i, file) {
        // the unit of file.size is B, and the unit of uploadSizeLimit is MB
        // metric.convert is 1024 * 1024
        var allow = file.size < options.uploadSizeLimit * config.metric.convert

        // If file.size is beyond the uploadSizeLimit, this file will not be uploaded
        self.filesSize += allow ? file.size : 0

        self.filesMap.push({
          index: i,
          name: file.name,
          size: file.size,
          allow: allow
        })
      })
    },

    change: function (removedFileIndex) {
      var self = this
      var superior = self.superior

      var options = superior.options
      var config = superior.config

      var changeInfo = {
        index: self.index,
        inputFiles: self.inputFiles,
        filesMap: self.filesMap,
        sizeUnit: config.metric.unit,
        removedFileIndex: removedFileIndex  // removedFileIndex is undefined when add images especially
      }

      $.extend(changeInfo, self.addition(removedFileIndex))

      options.change && options.change(changeInfo)

      if (removedFileIndex === undefined) {
        options.autoSubmit && superior.submit()
        !config.supportFormData && superior.add(false)
      }
    },

    addition: function (removedFileIndex) {
      var self = this
      var superior = self.superior

      var config = superior.config

      if (config.supportFormData) {
        self.setSteps()

        return {
          state: self.state,
          filesLength: self.filesMap.length,
          filesSize: +parseFloat(self.filesSize / config.metric.convert).toFixed(2)
        }
      }
      else {
        superior.counter.pendings += removedFileIndex === undefined ? 1 : -1
        if (removedFileIndex === undefined) {
          self.form.append(self.input)
        } else {
          self.state = 'rejected'
        }

        return {
          state: self.state,
          filesLength: removedFileIndex === undefined ? 1 : 0,
          filesSize: self.filesSize
        }
      }
    },

    setSteps: function () {
      var self = this
      var superior = self.superior

      var options = superior.options
      var config = superior.config
      var limit = options.uploadSizeLimit * config.metric.convert

      // reset self.steps and minus self.steps
      superior.counter.steps -= self.steps.length
      self.steps = []

      var filesAllow = $.grep(self.filesMap, function (file) {
        return file.allow
      })

      if (!filesAllow.length) {
        self.state = 'rejected'
        superior.counter.steps -= self.steps.length
      }
      else {
        self.steps.push([])
        var sum = 0

        $.each(filesAllow, function (i, file) {
          if (sum + file.size > limit) {
            // add new step, reset sum to 0
            self.steps.push([file.index])
            sum = file.size
          }
          else {
            // append file.index to the last step in self.steps, add file.size to sum
            self.steps[self.steps.length - 1].push(file.index)
            sum += file.size
          }
        })

        superior.counter.steps += self.steps.length
      }
    },

    transition: function () {
      var self = this
      var superior = self.superior

      var config = superior.config

      if (config.supportFormData) {
        // finish all the steps, then change the state to fulfilled or rejected
        if (self.stepSuccessTimes + self.stepErrorTimes == self.steps.length) {
          self.state = self.stepErrorTimes == 0 ? 'fulfilled' : 'rejected'
        }
        superior.counter.steps--
      }
      else {
        self.state = self.stepErrorTimes == 0 ? 'fulfilled' : 'rejected'
        superior.counter.pendings--
      }

      superior.mayCompleted()
    },

    submit: function () {
      if (this.superior.config.supportFormData) {
        this.uploadFormData()
      } else {
        this.uploadIframe()
      }
    },

    uploadFormData: function () {
      var self = this
      var superior = self.superior

      var options = superior.options
      var config = superior.config

      // upload all the images one by one step
      $.each(self.steps, function (i, step) {
        var formData = new FormData()

        $.each(step, function (j, index) {
          formData.append(options.name, self.inputFiles[index])
          // use scopes to distinguish strictly the image(avoiding the same name image in different directory)
          formData.append('scopes', [self.index, index].join('_'))
        })

        var ajaxConfig = {
          data: formData,
          context: self,
          success: self.success,
          error: self.error
        }

        $.extend(ajaxConfig, config.ajaxConfig)

        $.ajax(ajaxConfig)
      })
    },

    uploadIframe: function () {
      var self = this
      var superior = self.superior

      var options = superior.options

      var selector = 'input[name="' + options.name + '"]'
      if (!self.form.find(selector).length) return null

      $('body').append(self.formTargetIframe)

      self.formTargetIframe.one('load', function () {
        var response = $(this).contents().find('body').html()

        $(this).remove()

        if (!response.length) {
          self.error()
        } else {
          self.success(response)
        }
      })

      self.form.prepend(
        self.buildInput({
          type: 'text',
          name: 'scopes',
          value: [self.index, 0].join('_')
        })
      )

      self.form.appendTo(options.container)

      self.form.submit()
    },

    success: function (data) {
      var options = this.superior.options

      this.stepSuccessTimes++
      this.superior.submitData.push(data)

      options.success && options.success(data)
      this.transition()
    },

    error: function (error) {
      var options = this.superior.options

      this.stepErrorTimes++

      options.error && options.error(error)
      this.transition()
    },

    trigger: function () {
      var self = this
      var config = self.superior.config

      config.supportFormData && self.input.trigger('click')
    }
  })

  // There just need only one MultipleUploader instance for uploading images
  // The sole MultipleUploader instance manages the common options and config
  // and offers actions and listeners for users to handle (e.g. add, remove, submit, what to do when all completed)
  function MultipleUploader(options) {
    if (!(this instanceof MultipleUploader)) {
      return new MultipleUploader(options)
    }

    this.options = {
      container: null, // the root DOM for uploading image
      trigger: null, // MultipleUploader need a trigger to add or submit
      name: null, // this name will be set as the name of input DOM when using formData to upload images
      action: null, // the value of form-action or the url of $.ajax config
      accept: null, // the value of input-accept attribute
      multiple: true, // the value of input-multiple attribute
      autoSubmit: false, // MultipleUploader support two process to uploading images
      /*
       * All the images selected will be auto-submit and uploaded when autoSubmit is true
       * If autoSubmit is false, all the images selected will be cached momentarily(managed by filesMap of Uploader instance)
       * and users can remove(MultipleUploader remove) some selected image before confirming to upload images
       * finally users can submit(MultipleUploader submit) and begin to upload images
       * */
      uploadSizeLimit: 5, // the limit size for uploading once(and this is also the limit size of one image )
      headers: null, // the headers of $.ajax config
      progress: null, // the listener of uploading start
      completed: null, // the listener of all the images uploaded
      change: null, // the listener of input change, including the change occured when remove images before uploading
      success: null,  // the listener of one post or one $.ajax successfully
      error: null // the listener of one post or one $.ajax failed
    }

    options.container = $(options.container)
    options.trigger = $(options.trigger)

    $.extend(this.options, options)

    this.config = {
      metric: {
        convert: 1024 * 1024,  // the formula to convert
        unit: 'MB'  // the unit to convert
      },
      supportFormData: window.FormData ? true : false,
      // the common of $.ajax config
      ajaxConfig: {
        type: 'post',
        processData: false,
        contentType: false,
        url: this.options.action,
        headers: this.options.headers
      }
    }

    this.uploaderList = [] // the array of Uploader instances
    this.submitData = [] // the final data which merges all the result

    this.counter = {
      steps: 0, // the sum of all the steps in each uploader(formData)
      pendings: 0 // the sum of all the pending uploaders(IE7-IE9)
    }
  }

  $.extend(MultipleUploader.prototype, {
    init: function () {
      var self = this
      var options = self.options
      var config = self.config

      if (config.supportFormData) {
        options.trigger.on('click', function () {
          self.add(true)
        })
      }
      else {
        self.add(false)
      }
    },

    add: function (trigger) {
      // index is the order of adding action
      var index = this.uploaderList.length
      var uploader = new Uploader(index, this)

      this.uploaderList.push(uploader)

      trigger && uploader.trigger()
    },

    remove: function (index, fileName) {
      var self = this
      var config = self.config

      var removedFileIndex = null
      var uploader = this.uploaderList[index]

      if (config.supportFormData) {
        // fileName is the name of image expected to remove
        // index is the scope of the image(avoiding the same name image in different directory)
        uploader.filesMap = $.grep(uploader.filesMap, function (file) {
          var result = (fileName !== file.name)

          if (fileName === file.name) {
            uploader.filesSize -= file.allow ? file.size : 0
            removedFileIndex = file.index
          }

          return result
        })
      }
      else {
        // IE7-IE9
        removedFileIndex = 0
      }

      uploader.change(removedFileIndex)
    },

    submit: function () {
      var self = this
      var config = self.config

      if (self.counter.steps || self.counter.pendings) {
        if (this.options.progress && typeof this.options.progress === 'function') {
          this.options.progress()
        }
      }

      self.submitData = []
      if (config.supportFormData) {
        $.each(this.uploaderList, function (i, uploader) {
          // cancel the selecting will also create a uploader, but its steps is empty(formData)
          if (uploader.state == 'pending' && uploader.steps.length) {
            uploader.submit()
          }
        })
      }
      else {
        $.each(this.uploaderList, function (i, uploader) {
          // cancel the selecting will also create a uploader, but its steps is empty(IE7-IE9)
          if (uploader.state == 'pending' && uploader.inputFiles !== null) {
            uploader.submit()
          }
        })
      }
    },

    mayCompleted: function () {
      var self = this
      var options = self.options
      var config = self.config

      if ((config.supportFormData && self.counter.steps == 0) || (!config.supportFormData && self.counter.pendings == 0)) {
        if (options.completed && typeof options.completed === 'function') {
          options.completed(this.submitData)
        }
      }

      config.autoSubmit && self.init()
    }
  })

  win.MultipleUploader = MultipleUploader
})(window, $)