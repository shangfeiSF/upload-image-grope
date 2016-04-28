#!/usr/bin/env node
var fs = require('fs')
var path = require('path')

var express = require('express')
var multiparty = require('multiparty')
var bodyParser = require('body-parser')

var gm = require('gm')
var nopt = require('nopt')
var colors = require('colors')
var Promise = require("bluebird")

var Hash = require('./hash')

Promise.promisifyAll(fs)

var hash = new Hash({
  algorithms: 'RSA-SHA1-2',
  encoding: 'hex'
})
var options = nopt({
  'format': ['jpg', 'png'],
  'quality': Number
}, {
  'jpg': ['--format', 'jpg'],
  'png': ['--format', 'png'],
  'q': ['--quality'],
  'q50': ['--quality', '50'],
  'q100': ['--quality', '100']
}, process.argv, 2)

var app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
  extended: true
}))

var host = 'http://localhost'
var port = 8080

var uploadRouter = '/upload/images/'
var uploadDir = '../database'

var base = [host, port].join(':') + uploadRouter
var dir = path.join(__dirname, uploadDir)

var to, from, pattern, quality = 100
if (options.format) {
  to = '.' + options.format
  from = options.format === 'jpg' ? 'png' : 'jpg'
  pattern = new RegExp('\\\.' + from + '$', 'i')
}
if (options.quality && options.quality >= 1 && options.quality <= 100) {
  quality = parseInt(options.quality)
}

app.use(express.static('../asset'))
app.use(uploadRouter, express.static(uploadDir))

app.post('/upload', function (req, res) {
  var form = new multiparty.Form({
    'uploadDir': uploadDir
  })
  /* promisify the form.parse */
  var parseAsync = Promise.promisify(form.parse, {
    context: form,
    multiArgs: true
  })

  parseAsync(req)
    .then(function (result) {
      var scopes = result.shift().scopes
      var images = result.pop().images

      images.forEach(function(image, index){
        image.scope = scopes[index]
      })

      return images
    })
    .map(function (file) {
      var prefix = hash.gen(file.originalFilename)
      var q = 'q' + quality

      var result = {
        old: file.path,
        scope: file.scope,
        original: [prefix, file.originalFilename].join('_'),
        quality: [prefix, q, file.originalFilename].join('_')
      }
      if (options.format) {
        result.format = [prefix, q, file.originalFilename.replace(pattern, to)].join('_')
      }

      return result
    })
    .reduce(function (census, item) {
      var paths = {
        old: path.join(dir, item.old),
        original: path.join(dir, item.original),
        quality: path.join(dir, item.quality),
      }
      if (options.format) {
        paths.format = path.join(dir, item.format)
      }

      var links = {
        scope: item.scope,
        original: base + item.original,
        quality: base + item.quality
      }
      if (options.format) {
        links.format = base + item.format
      }

      census.push(links)

      return fs.renameAsync(paths.old, paths.original)
        .then(function () {
          var tasks = []

          tasks.push(new Promise(function (resolve) {
            gm(paths.original).quality(quality).write(paths.quality, resolve)
          }))

          if (options.format) {
            tasks.push(new Promise(function (resolve) {
              gm(paths.original).quality(quality).write(paths.format, resolve)
            }))
          }

          return tasks
        })
        .all()
        .return(census)
    }, [])
    .then(function (census) {
      res.send({
        links: census
      })
    })
    .catch(function (error) {
      res.send({
        links: [],
        error: error
      })
    })
})

app.use('/pages', express.static('../pages'))
app.get('/index.html', function (req, res) {
  var file = path.join(__dirname, '../pages/index.html')

  fs.readFile(file, function (error, data) {
    var html = data.toString('utf-8')
    var html = html.replace('{{csrf-token}}', hash.gen(''))
    res.writeHead(200)
    res.end(html)
  })
})

app.listen(port, function () {
  console.log('[Server] -- listening localhost:8080....'.green)
  if (options.format) {
    console.log(('[Server] -- format all the images to .' + options.format).green)
  }
})