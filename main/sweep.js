#!/usr/bin/env node
var Promise = require("bluebird")

var fs = require('fs')
Promise.promisifyAll(fs)
var path = require('path')

var util = require('util')
var colors = require('colors')

fs.readdirAsync(path.join(__dirname, 'asset/images'))
  .then(function (files) {
    var images = files.filter(function (file) {
      return /\.jpg|\.png$/i.test(file)
    })

    if (images.length == 0) {
      console.log(('None images(*.jpg or *.png) need sweep').yellow)
      return
    }

    console.log('Sweep Begin'.green)
    console.log(('[Directory] --- ' + path.join(__dirname, 'asset/images')).yellow)
    var censusInit = []

    Promise.reduce(images, function (census, image, index) {
        var file = path.join(__dirname, 'asset/images', image)

        return fs.statAsync(file)
          .then(function (stats) {
            census.push({
              index: index,
              name: image,
              size: stats.size,
              ext: path.extname(image)
            })

            return fs.unlinkAsync(file)
          })
          .then(function () {
            console.log(('[File] --- ' + image).red)
            return census
          })
      }, censusInit)
      .then(function (census) {
        console.log('Sweep End'.green)
        console.log((
          util.inspect(census, {
            showHidden: false,
            depth: null
          })
        ).yellow)
      })
  })