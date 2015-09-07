var Email = function () {
  var Mandrill = require('mandrill-api/mandrill')
  var mandrill = new Mandrill.Mandrill(process.env.MANDRILL_KEY)

  var API = {}

  // email gifs using mandrill
  API.send = function (params) {
    console.log('sending email', params)
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
              'content': 'http://example.com'
            }, {
              'name': 'event_title',
              'content': 'fashion week'
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
        resolve(result)
      }, function (err) {
        reject(err)
      })
    })
  }

  return API
}

module.exports = new Email()
