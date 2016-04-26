define(['jquery', 'underscore'], function ($, _) {
    var iframeCount = 0

    function Uploader(index, superior) {
      if (!(this instanceof Uploader)) {
        return new Uploader(index)
      }

      this.superior = superior // superior方便引用options config
      this.index = index // index表示输入的序号
      this.state = 'pending' //state：'pending'表示等待上传，'fulfilled'表示上传成功，'rejected'表示不上传或上传失败
      this.steps = [] // steps表示一次input的多张图片需要分成若干step来post
      this.stepSuccessTimes = 0
      this.stepErrorTimes = 0
      this.inputFiles = null // inputFiles缓存了input中输入的文件对象FileList
      this.filesMap = [] // filesMap是上传队列，用户撤销已经缓存的文件上传动作，即删除filesMap中的项
      this.filesSize = 0 // filesSize是上传图片的总字节数

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
          // formData提交，只需要一个隐藏input type=file
          this.input.appendTo(options.container)
        } else {
          // iframe提交，另外需要一个form和一个iframe
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
        // change只会执行一次：add()之后uploader.trigger()时弹出系统选择框
        self.input.change(function (e) {
          // 将input的FileList缓存到inputFiles
          self.inputFiles = (this.files && this.files.length) ? this.files : e.target.value
          self.census()
          self.change()
        })
      },

      census: function () {
        var self = this
        var options = self.superior.options
        var config = self.superior.config

        var files = self.inputFiles
        // 构造filesMap：[{文件索引index，文件名称name，文件大小size，文件大小限制allow}, ……]
        for (var i = 0, len = files.length; i < len; i++) {
          var file = files[i]
          var allow =file.size < options.uploadSizeLimit * config.metric.convert

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
        var removedFileIndex = removedFileIndex === undefined ? 'add' : removedFileIndex

        self.setSteps()

        //console.log(self)
        //console.log("steps--", self.steps)
        //console.log("pendingLength--", self.superior.pendingLength)

        // 调用自定义的change回调
        options.change && options.change({
          index: self.index,
          state: self.state,
          inputFiles: self.inputFiles,
          filesMap: self.filesMap,
          filesLength: self.filesMap.length,
          filesSize: +parseFloat(self.filesSize / config.metric.convert).toFixed(2),
          sizeUnit: config.metric.unit,
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


        // 重置self.steps，pendingLength
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
              // 累计超过上传限制，新增step，sum重置
              self.steps.push([file.index])
              sum = file.size
            } else {
              // 累计未超过上传限制，向末尾step追加index, sum累加
              self.steps[self.steps.length - 1].push(file.index)
              sum += file.size
            }
          }

          self.superior.pendingLength += self.steps.length
        }
      },

      switch: function () {
        var self = this
        if (self.stepSuccessTimes + self.stepErrorTimes == self.steps.length) {
          self.state = self.stepErrorTimes == 0 ? 'fulfiled' : 'rejected'
        }
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

        for (var i = 0, len = self.steps.length; i < len; i++) {
          var step = self.steps[i]

          var formData = new FormData()
          formData.append('_uploader_', 'formdata')

          for (var j = 0; j < step.length; j++) {
            var index = step[j]
            formData.append(options.name, self.inputFiles[index])
            formData.append('scope', [self.index, index].join('_'))
          }

          // formData 加入ajax 配置
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
        // 一次step上传成功
        this.stepSuccessTimes++
        this.superior.submitData.push(data)

        options.success && options.success(data)
        this.switch()
      },

      error: function (error) {
        var options = this.superior.options
        // 一次step上传失败
        this.stepErrorTimes++

        options.error && options.error(error)
        this.switch()
      },

      trigger: function () {
        this.input.trigger('click')
      }
    })

    function MultipleUploader(options) {
      if (!(this instanceof MultipleUploader)) {
        return new MultipleUploader(options)
      }

      options.container = $(options.container)
      // options 可自定义的配置
      this.options = {
        container: null, // 多图上传组件的根节点
        name: null, // formData提交时form.append中使用/input的name属性
        action: null, // form的acition属性
        accept: null, // input的accept属性
        multiple: true, // input的multiple属性
        autoSubmit: false, // 添加文件后自动上传
        /*
         * false时支持先添加图片到列表中，可以在列表中删除（MultipleUploader remove）已选图片，避免无用的上传过程
         * 待确认列表中全部图片都需要上传时，点击上传（MultipleUploader submit）才会开始上传
         * true时选择图片后立刻自动上传
         */
        uploadSizeLimit: 0.78125, // 一次上传图片的总大小上限（10兆字节）测试800kb的限制 public/images/1.jpg no-allow
        headers: null, // $.ajax配置中headers属性
        change: null, // input change的监听函数，包括删除文件时触发的change
        progress: null, // 上传过程开始的监听方法，以后支持上传实际进度show
        completed: null, // 全部上传完毕的回调方法
        success: null,  // 一次ajax post成功的回调方法
        error: null // 一次ajax post失败的回调方法
      }

      _.extend(this.options, options)

      // config 固定的配置
      this.config = {
        // metric.convert 是字节转换到兆的公式，metric.unit 是文件大小转换后的单位
        metric: {
          convert: 1024 * 1024,
          unit: 'MB'
        },
        // supportFormData判断支持FormData与否
        supportFormData: window.FormData ? true : false,
        // ajaxConfig 部分通用Ajax Post配置
        ajaxConfig: {
          type: 'post',
          processData: false,
          contentType: false,
          url: this.options.action,
          headers: this.options.headers
        }
      }

      this.uploaderList = [] // 输入图片的缓存队列
      this.pendingLength = 0 // uploaderList中state='pending'的uploader
      this.submitData = [] //completed后全部的图片数据
    }

    _.extend(MultipleUploader.prototype, {
      add: function () {
        // index表示add action的序号
        var index = this.uploaderList.length
        var uploader = new Uploader(index, this)

        this.uploaderList.push(uploader)

        uploader.trigger()
      },

      remove: function (fileName, index) {
        // fileName指定删除的文件名称，index指定添加fileName的序号
        var uploader = this.uploaderList[index]

        var fileIndex = null
        uploader.filesMap = $.grep(uploader.filesMap, function (file) {
          var result = (fileName !== file.name)
          if (fileName === file.name) {
            uploader.filesSize -= file.size
            fileIndex = file.index
          }
          return result
        })

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
          // 统一上传图片时，只上传pending状态的uploader
          // 判断 uploader.steps.length 避免取消input后创建的uploader也submit
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

    return MultipleUploader
  }
)