var UploadTwitter = function () {
  var request = require('request')
  var fs = require('fs')
  var download = require('./download')

  var API = {}

  API.uploadURL = function (oauth, url, filename) {
    return new Promise(function (resolve, reject) {
      download.download(url, filename)
      .then(function (localFileName) {
        API.upload(oauth, localFileName)
        .then(resolve)
      })
      .catch(console.log)
    })
  }

  API.upload = function (oauth, path) {
    return new Promise(function (resolve, reject) {
      init(oauth, path)
      .then(resolve)
      .catch(console.log)
    })
  }

  var init = function (oauth, path) {
    return new Promise(function (resolve, reject) {
      var stats = fs.statSync(path)
      request.post(
        {
          url: 'https://upload.twitter.com/1.1/media/upload.json',
          oauth: oauth,
          form: {
            command: 'INIT',
            total_bytes: stats['size'],
            media_type: 'video/mp4'
          }
        },
        function (err, r, body) {
          if (err) {
            reject(err)
          } else {
            var media_id = JSON.parse(body).media_id_string
            append(oauth, path, media_id)
            .then(resolve)
            .catch(console.log)
          }
        }
      )
    })
  }

  var append = function (oauth, path, media_id) {
    return new Promise(function (resolve, reject) {
      request.post(
        {
          url: 'https://upload.twitter.com/1.1/media/upload.json',
          oauth: oauth,
          form: {
            command: 'APPEND',
            media_id: media_id,
            segment_index: '0',
            media_data: fs.readFileSync(path, {'encoding': 'base64'})
          }
        },
        function (err, r, body) {
          if (err) {
            reject(err)
          } else {
            finalize(oauth, path, media_id)
            .then(resolve)
            .catch(console.log)
          }
        }
      )
    })
  }

  var finalize = function (oauth, path, media_id) {
    return new Promise(function (resolve, reject) {
      request.post(
        {
          url: 'https://upload.twitter.com/1.1/media/upload.json',
          oauth: oauth,
          form: {
            command: 'FINALIZE',
            media_id: media_id
          }
        },
        function (err, r, body) {
          if (err) {
            reject(err)
          } else {
            resolve(JSON.parse(body).media_id_string)
          }
        }
      )
    })
  }

  return API
}

module.exports = new UploadTwitter()
