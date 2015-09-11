var Email = function () {
  var download = require('./download')
  var fs = require('fs')
  var Mandrill = require('mandrill-api/mandrill')
  var mandrill = new Mandrill.Mandrill(process.env.MANDRILL_KEY)

  var API = {}

  // email gifs using mandrill
  API.send = function (params) {
    return new Promise(function (resolve, reject) {
      mandrill.messages.sendTemplate({
        'template_name': 'share-gif',
        'template_content': [{}],
        'message': {
          'global_merge_vars': [
            {
              'name': 'from_name',
              'content': 'Gif Booth'
            },
            {
              'name': 'gif_url',
              'content': params.gif_url
            }, {
              'name': 'event_url',
              'content': params.event_url
            }, {
              'name': 'event_title',
              'content': params.event_title
            }
          ],
          'subject': 'Gifbooth Gif!',
          'from_email': 'gifs@gifbooth.co',
          'from_name': 'Gif Booth',
          'to': [{
            'email': params.to_email,
            'name': params.to_name
          }]
        }
      }, function (result) {
        console.log('successfully sent email: ', result)
        resolve(result)
      }, function (err) {
        console.log('error sending email: ', err)
        reject(err)
      })
    })
  }

  API.sendInstagram = function (params) {
    return new Promise(function (resolve, reject) {
      // console.log('gonna send an email')
      download.download(params.attachment.url, params.attachment.filename)
      .then(function (localFileName) {
        // console.log('downloaded file')
        fs.readFile(localFileName, function (err, data) {
          var base64data = new Buffer(data).toString('base64')
          console.log('read file', base64data)
          if (err) {
            reject(err)
          }
          mandrill.messages.sendTemplate({
            'template_name': 'instagram-gif',
            'template_content': [{}],
            'message': {
              'global_merge_vars': [
                {
                  'name': 'from_name',
                  'content': 'Gif Booth'
                }, {
                  'name': 'event_url',
                  'content': params.event_url
                }, {
                  'name': 'event_title',
                  'content': params.event_title
                }
              ],
              'subject': 'Gifbooth Gif!',
              'from_email': 'gifs@gifbooth.co',
              'from_name': 'Gif Booth',
              'to': [{
                'email': params.to_email,
                'name': 'GIFboother'
              }],
              'attachments': [{
                'type': 'video/mp4',
                'name': params.attachment.filename,
                'content': base64data
              }]
            }
          }, function (result) {
            console.log('successfully sent email: ', result)
            resolve(result)
          }, function (err) {
            console.log('error sending email: ', err)
            reject(err)
          })
        })
      })
      .catch(reject)
    })
  }

  return API
}

module.exports = new Email()
