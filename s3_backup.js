
var S3Backup = function () {
  var API = {}

  API.do = function (tweet) {
    // if testing, upload streamed tweets to s3 as gifs
    if (process.env.S3_TEST === 'true') {
      console.log('\n\n\nTESTING; gonna upload this one to s3')
      var https = require('https')
      var gifify = require('gifify')
      var aws = require('aws-sdk')
      var path = require('path')
      var fs = require('fs')
      var gif_queue = require('./gif_queue')

      // download the mp4 from twitter
      console.log('\n\n\nTESTING; gonna download the mp4 from twitter')
      https.get(tweet.extended_entities.media[0].video_info.variants[0].url, function (res, err) {
        if (err) {
          console.log('\n\n\nhttps get error', err)
        }
        var file = fs.createWriteStream('tmp/' + tweet.id_str + '.mp4')
        res.pipe(file)

        // convert the mp4 to a gif
        console.log('\n\n\nTESTING; gonna convert the mp4 to a gif')
        res.on('end', function () {
          var output = path.join(__dirname, 'tmp/' + tweet.id_str + '.gif')
          var gif = fs.createWriteStream(output)
          gifify('tmp/' + tweet.id_str + '.mp4', {}).pipe(gif).on('finish', function () {
            // read the converted gif
            console.log('\n\n\nTESTING; gonna read the converted gif')
            fs.readFile('tmp/' + tweet.id_str + '.gif', function (err, fileContents) {
              if (err) {
                console.log('\n\n\nerror reading file', file, err)
              } else {
                // and upload it to s3
                console.log('\n\n\nTESTING; gonna put it in a bucket')
                var params = {
                  'Bucket': process.env.AWS_S3_BUCKET,
                  'Key': tweet.id_str + '.gif',
                  'ContentType': 'image/gif',
                  'Body': fileContents,
                  'ACL': 'public-read'
                }
                new aws.S3().upload(params, function (err, data) {
                  if (err) {
                    console.log('\n\n\nError uploading data:', err)
                  } else {
                    console.log('\n\n\nSuccessfully uploaded data to myBucket/myKey')
                    gif_queue.resolve(tweet.id)
                  }
                })
              }
            })
          })
        })
      })
    }
  }
  return API
}

module.exports = new S3Backup()
