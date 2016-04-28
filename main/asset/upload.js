(function (win, $, _) {
  var iframeCount = 0

  function Uploader(index, superior) {
    if (!(this instanceof Uploader)) {
      return new Uploader(index)
    }

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
    this.filesMap = []
    this.filesSize = 0 // the total size of images in filesMap

    this.render()
    this.bind()
  }

  _.extend(Uploader.prototype, {
    render: function () {
      var options = this.superior.options
      var config = this.superior.config

      this.input = this.buildInput({
        type: 'file',
        hidefocus: true
      }, ['name', 'accept', 'multiple'])

      if (config.supportFormData) {
        // use formData to upload
        this.input.appendTo(options.container)
      }
      else {
        // use iframe to upload
        this.formTargetIframe = this.buildIframe({
          name: 'iframe-uploader-' + iframeCount++
        })

        this.form = this.buildForm({
          method: 'post',
          enctype: 'multipart/form-data'
        }, ['action'])

        this.form.append(this.input)
        this.form.appendTo(options.container)
      }
    },

    setDynamicProps: function (dom, dynamicProps) {
      if (!dynamicProps) return null

      var options = this.superior.options

      for (var i = 0, len = dynamicProps.length; i < len; i++) {
        var prop = dynamicProps[i]
        var value = options[prop]
        value && (dom.attr(prop, value))
      }
    },

    buildInput: function (aptoticProps, dynamicProps) {
      var input = $('<input>', aptoticProps)

      this.setDynamicProps(input, dynamicProps)
      input.css({
        outline: 0,
        cursor: 'pointer'
      }).hide()

      return input
    },

    buildIframe: function (aptoticProps, dynamicProps) {
      var iframe = $('<iframe>', aptoticProps)

      this.setDynamicProps(iframe, dynamicProps)

      return iframe
    },

    buildForm: function (aptoticProps, dynamicProps) {
      var form = $('<form>', aptoticProps)

      this.setDynamicProps(form, dynamicProps)
      form.attr('target', this.formTargetIframe.attr('name')).hide()

      return form
    },

    bind: function () {
      var self = this
      self.input.change(function (e) {
        // inputFiles caches the FileList Object given by input DOM
        self.inputFiles = (this.files && this.files.length) ? this.files : e.target.value
        // build filesMap and calculate filesSize
        self.census()
        // calculate steps to upload
        self.change()
      })
    },

    census: function () {
      var self = this
      var options = self.superior.options
      var config = self.superior.config

      var files = self.inputFiles
      for (var i = 0, len = files.length; i < len; i++) {
        var file = files[i]
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
      }
    },

    change: function (removedFileIndex) {
      var self = this
      var options = self.superior.options
      var config = self.superior.config

      self.setSteps()

      // offer the update info to custom change
      options.change && options.change({
        index: self.index,
        state: self.state,
        inputFiles: self.inputFiles,
        filesMap: self.filesMap,
        filesLength: self.filesMap.length,
        filesSize: +parseFloat(self.filesSize / config.metric.convert).toFixed(2),
        sizeUnit: config.metric.unit,
        /*
         * the index of image removed form filesMap
         * or removedFileIndex is undefined when add images
         * */
        removedFileIndex: removedFileIndex
      })

      if (options.autoSubmit) {
        self.superior.submit()
      }
    },

    setSteps: function () {
      var self = this
      var options = self.superior.options
      var config = self.superior.config
      var limit = options.uploadSizeLimit * config.metric.convert

      // reset self.steps and minus self.steps form pendingLength
      self.superior.pendingLength -= self.steps.length
      var filesAllow = $.grep(self.filesMap, function (file) {
        return file.allow
      })
      self.steps = []

      if (!filesAllow.length) {
        self.state = 'rejected'
        self.superior.pendingLength -= self.steps.length
      } else {
        self.steps.push([])
        var sum = 0

        for (var i = 0, len = filesAllow.length; i < len; i++) {
          var file = filesAllow[i]

          if (sum + file.size > limit) {
            // add new step, reset sum to 0
            self.steps.push([file.index])
            sum = file.size
          } else {
            // append file.index to the last step in self.steps, add file.size to sum
            self.steps[self.steps.length - 1].push(file.index)
            sum += file.size
          }
        }

        self.superior.pendingLength += self.steps.length
      }
    },

    switch: function () {
      var self = this
      // finish all the steps, then change the state to fulfilled or rejected
      if (self.stepSuccessTimes + self.stepErrorTimes == self.steps.length) {
        self.state = self.stepErrorTimes == 0 ? 'fulfilled' : 'rejected'
      }
      // finish one step, then minus one form pendingLength
      self.superior.pendingLength--
      self.superior.mayCompleted()
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
      var options = self.superior.options
      var config = self.superior.config

      // upload all the images one by one step
      for (var i = 0, len = self.steps.length; i < len; i++) {
        var step = self.steps[i]

        var formData = new FormData()

        for (var j = 0; j < step.length; j++) {
          var index = step[j]
          formData.append(options.name, self.inputFiles[index])
          // use scopes to distinguish strictly the image(avoiding the same name image in different directory)
          formData.append('scopes', [self.index, index].join('_'))
        }

        var ajaxConfig = {
          data: formData,
          context: self,
          success: self.success,
          error: self.error
        }

        _.extend(ajaxConfig, config.ajaxConfig)

        $.ajax(ajaxConfig)
      }
    },

    // TODO: more test
    uploadIframe: function () {
      var self = this
      $('body').append(self.formTargetIframe)

      self.formTargetIframe.one('load', function () {
        $('<iframe src="javascript:false"></iframe>').appendTo(self.form).remove()

        var response = $(this).contents().find('body').html()

        $(this).remove()

        if (!response) {
          self.error()
        } else {
          self.success(response)
        }
      })

      self.form.submit()
    },

    success: function (data) {
      var options = this.superior.options

      this.stepSuccessTimes++
      this.superior.submitData.push(data)

      options.success && options.success(data)
      this.switch()
    },

    error: function (error) {
      var options = this.superior.options

      this.stepErrorTimes++

      options.error && options.error(error)
      this.switch()
    },

    trigger: function () {
      this.input.trigger('click')
    }
  })

  // There just need only one MultipleUploader instance for uploading images
  // The sole MultipleUploader instance manages the common options and config
  // and offers actions and listeners for users to handle (e.g. add, remove, submit, what to do when all completed)
  function MultipleUploader(options) {
    if (!(this instanceof MultipleUploader)) {
      return new MultipleUploader(options)
    }

    options.container = $(options.container)

    this.options = {
      container: null, // the root DOM for uploading image
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

    _.extend(this.options, options)

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
    this.pendingLength = 0 // the sum of all the steps in each uploader
    this.submitData = [] // the final data which merges all the result
  }

  _.extend(MultipleUploader.prototype, {
    add: function () {
      // index is the order of adding action
      var index = this.uploaderList.length
      var uploader = new Uploader(index, this)

      this.uploaderList.push(uploader)

      // open the system Interface for selecting images(trigger the click evnet of input)
      uploader.trigger()
    },

    remove: function (fileName, index) {
      // fileName is the name of image expected to remove
      // index is the scope of the image(avoiding the same name image in different directory)
      var uploader = this.uploaderList[index]

      var fileIndex = null
      uploader.filesMap = $.grep(uploader.filesMap, function (file) {
        var result = (fileName !== file.name)
        if (fileName === file.name) {
          uploader.filesSize -= file.allow ? file.size : 0
          fileIndex = file.index
        }
        return result
      })

      // handle the fileMaps
      uploader.change(fileIndex)
    },

    submit: function () {
      if (this.pendingLength) {
        if (this.options.progress && typeof this.options.progress === 'function') {
          this.options.progress()
        }
      }

      this.submitData = []
      $.each(this.uploaderList, function (i, uploader) {
        // cancel the selecting will also create a uploader, but its steps is empty
        if (uploader.state == 'pending' && uploader.steps.length) {
          uploader.submit()
        }
      })
    },

    mayCompleted: function () {
      if (this.pendingLength == 0) {
        if (this.options.completed && typeof this.options.completed === 'function') {
          this.options.completed(this.submitData)
        }
      }
    }
  })

  win.MultipleUploader = MultipleUploader
})(window, $, _)