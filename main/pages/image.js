/*
 * local debug file
 * 多图上传文件
 */
define(['jquery', 'underscore', 'brix/base', 'brix/loader', 'editor/upload/upload', './image.tpl', 'css!./image.css'],
  function ($, _, Brix, Loader, MultipleUploader, template) {
    var n = 0

    function Image() {
    }

    _.extend(Image.prototype, Brix.prototype, {
      options: {},

      init: function () {
        var me = this
        me.data = _.extend(me.options, {
          id: 'j-editor-image' + n++
        })
        if (!$.isArray(me.data.value.src)) {
          me.data.value.src = []
        }
      },

      render: function () {
        var html = template(this.data)
        this.$el = $(this.element)
        this.$el.html('')
        this.$el.append(html)
        this.initEvents()
      },

      initEvents: function () {
        var me = this
        var data = me.data
        me.mUploader = null

        me.mUploader = new MultipleUploader({
          container: '#' + data.id + ' .img-multiple',
          name: 'images',
          action: '/images',
          accept: 'image/*',
          multiple: data.meta.multiple,
          autoSubmit: true,
          headers: {
            "X-CSRF-Token": $('meta[name="csrf-token"]').attr('content')
          },
          progress: this.uploadProgress.bind(this),
          completed: this.uploadCompleted.bind(this),
          change: this.uploadChange.bind(this),
          success: this.uploadSuccess.bind(this),
          error: this.uploadError.bind(this)
        })

        $('#' + data.id + ' .add-btn').on('click', function () {
          me.mUploader.add()
        })

        // 调试变量
        window.mUploader = me.mUploader
      },

      uploadProgress: function () {
        console.info('开始分批次上传图片')
      },

      uploadCompleted: function (data) {
        console.info('完成全部上传任务, 返回全部上传成功的图片：', data)
      },

      uploadChange: function (feedback) {
        var me = this
        var data = me.data

        var inputFiles = feedback.inputFiles

        var filesMap = feedback.filesMap
        for (var i = 0; i < filesMap.length; i++) {
          var ctnr = $('<div class="img-ctnr">')

          var img = $('<img class="image">')
          img.css({
            width: '100%',
            height: 'auto',
            position: 'relative',
            top: '50%',
            transform: 'translateY(-50%)'
          })

          var active = $('<div class="active border-primary">')
          var removeBtn = $('<i class="craft-icon btn-primary btn-remove">&#xe60a</i>')
          active.append(removeBtn)

          ctnr.append(img)


          var allow = filesMap[i].allow
          if (!allow) {
            ctnr.data('state', 'rejected')

            var file = inputFiles[filesMap[i].index]
            var imageType = /^image\//

            if (!imageType.test(file.type)) {
              continue
            }
            img.file = file

            // 本地预览FileReader实现
            var reader = new FileReader()
            reader.onload = (function (aImg) {
              return function (e) {
                aImg.attr('src', e.target.result)
              }
            })(img)
            reader.readAsDataURL(file)
            ctnr.append($('<div class="rejected">'))
          } else {
            ctnr.data('state', 'pending')
            img.attr('src', '//gtms03.alicdn.com/tps/i3/TB1q2IxIpXXXXbAXXXXKFFQ9VXX-100-14.gif')
          }

          ctnr.append(active)
          $('#' + data.id + ' .thumbnail').append(ctnr)
        }
        console.warn('添加或者删除文件的更新, 返回更新后的状态分量：', feedback)
      },

      uploadSuccess: function (result) {
        var me = this
        var data = me.data

        var ctnrs = $('#' + data.id + ' .thumbnail').find('.img-ctnr')
        var pendings = $.grep(ctnrs, function (node) {
          return $(node).data('state') === 'pending'
        })

        if (pendings.length) {
          $.each(result, function (i, item) {
            var node = $(pendings.shift())
            node.data('state', 'fulfilled')
            node.find('img').attr('src', item.value.image)
          })
        }

        console.info('一次上传成功, 返回本次上传成功的图片：', result)
      },

      uploadError: function (error) {
        console.error('一次上传失败, 返回本次失败的原因：', error)
      }
    })

    return Image
  }
);