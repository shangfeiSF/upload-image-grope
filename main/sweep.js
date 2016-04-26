#!/usr/bin/env node
var fs = require('fs')
var path = require('path')
var Promise = require("bluebird")

var colors = require('colors')
Promise.promisifyAll(fs)

fs.readdirAsync(path.join(__dirname, 'asset/images'))
  .then(function (files) {
    var images = files.filter(function (file) {
      return /\.jpg|\.png$/i.test(file)
    })

    if (images.length == 0) {
      console.log('None images(*.jpg or *.png) need sweep'.yellow)
      return []
    } else {
      console.log('Sweep Begin'.green)
      return images
    }
  })
  .reduce(function (census, image, index) {
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
  }, [])
  .then(function (census) {
    console.log('Sweep End'.green)
  })