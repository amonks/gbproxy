var Download = function () {
  // var del = require('del')
  var request = require('request')
  var fs = require('fs')

  var API = {}

  API.download = function (url, filename) {
    return new Promise(function (resolve, reject) {
      // console.log('gonna download a file', url, filename)
      // first download
      var localFileName = __dirname + '/tmp/' + filename
      // del.sync(localFileName)
      var r = request(url)
      r.on('error', function (err) {
        reject('error downloading media', err)
      })
      r.pipe(fs.createWriteStream(localFileName))
      .on('finish', function () {
        // console.log('downloaded dat file', localFileName)
        resolve(localFileName)
      })
    })
  }

  return API
}
module.exports = new Download()
