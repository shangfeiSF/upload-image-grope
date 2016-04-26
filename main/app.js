var Promise = require("bluebird")

var fs = require('fs')
Promise.promisifyAll(fs)

var util = require('util')
var path = require('path')
var crypto = require('crypto')

var colors = require('colors')

var express = require('express')
var multiparty = require('multiparty')
var bodyParser = require('body-parser')

var gm = require('gm')

function Hash(config) {
  this.algorithms = config.algorithms
  this.encoding = config.encoding
}

Hash.prototype.gen = function (filename) {
  var self = this
  var stamp = parseInt(
    +new Date()
    + Math.floor(Math.random() * 5E10)
  )
  var generator = crypto.createHash(self.algorithms)

  var encrypted = ''
  generator.update(filename + stamp)
  encrypted += generator.digest(self.encoding)

  return encrypted.length ? encrypted : stamp
}

var hash = new Hash({
  algorithms: 'RSA-SHA1-2',
  encoding: 'hex'
})

var app = express()

app.use(express.static('asset'))
app.use('/images', express.static('asset/images'))

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
  extended: true
}))

app.get('/pages/index.html', function (req, res) {
  var file = path.join(__dirname, 'pages/index.html')

  fs.readFile(file, function (error, data) {
    res.writeHead(200)
    res.end(data)
  })
})

app.post('/users/formdata', function (req, res) {
  var uploadDir = 'asset/images'
  var base = 'http://localhost:8080/images/'
  var form = new multiparty.Form({
    'uploadDir': uploadDir
  })

  form.parse(req, function (err, fields, files) {
    if (err) {
      res.send({
        links: [],
        code: '404'
      })
    }

    Promise.reduce(files.files, function (links, file) {
        var prefix = hash.gen(file.originalFilename)
        var full = [prefix, file.originalFilename].join('_')
        var convert = [prefix, file.originalFilename.replace(/\.png$/, '.jpg')].join('_')

        links.push({
          url: base + convert,
          original: file.originalFilename,
          path: file.path,
          rename: null,
          convert: null
        })

        var oldPath = path.join(__dirname, file.path)
        var newPath = path.join(__dirname, uploadDir, full)
        var convertPath = path.join(__dirname, uploadDir, convert)

        return fs.renameAsync(oldPath, newPath)
          .then(function () {
            console.log('[Uploaded] --- '.green + full + ' has been uploaded'.green)
            links[links.length - 1].rename = full

            return new Promise(function (resolve) {
              gm(newPath).write(convertPath, resolve)
            })
          })
          .then(function () {
            links[links.length - 1].convert = convert
            console.log('[Converted] --- '.white + convert + ' has been converted'.white)

            return links
          })
      }, [])
      .then(function (links) {
        console.log(
          util.inspect(links, {
            showHidden: false,
            depth: null
          })
        )
        res.send({
          links: links
        })
      })
  })
})

app.listen(8080, function () {
  console.log('[Server] -- listening localhost:8080....'.cyan)
})