#!/usr/bin/env node
var fs = require('fs')
var path = require('path')
var Promise = require("bluebird")

var colors = require('colors')
Promise.promisifyAll(fs)

var pattern = /\.jpg|\.png$/i
var dir = path.join(__dirname, '../database')

fs.readdirAsync(dir)
  .filter(function (file) {
    return pattern.test(file)
  })
  .asCallback(function (error, files) {
    if (files.length == 0) {
      console.log('None images(*.jpg or *.png) need sweep'.yellow)
    } else {
      console.log('Sweep Begin'.green)
    }
  })
  .reduce(function (census, file) {
    var file = path.join(dir, file)

    return fs.statAsync(file)
      .then(function (stat) {
        census.push({
          name: path.basename(file),
          size: stat.size
        })
        return fs.unlinkAsync(file).return(census)
      })
  }, [])
  .then(function (census) {
    census.forEach(function (item) {
      console.log((item.size + '---' + item.name).red)
    })
    console.log('Sweep End'.green)
  })