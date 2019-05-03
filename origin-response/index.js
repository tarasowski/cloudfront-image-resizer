'use strict';

const http = require('http');
const https = require('https');
const querystring = require('querystring');
const compose = (...fns) => x => fns.reduceRight((v, f) => f(v), x)

const AWS = require('aws-sdk');
const S3 = new AWS.S3({
  signatureVersion: 'v4',
});
const Sharp = require('sharp');


const getAccountId = context =>
  context.invokedFunctionArn !== null && context.invokedFunctionArn !== undefined
    ? ({accountId: context.invokedFunctionArn
       .split(':')[4],
        context})
    : ({accountId:'306098392847', context})

const getAccountRegion = ({accountId, context}) =>
  context.invokedFunctionArn !== null && context.invokedFunctionArn !== undefined
    ? ({accountId, accountRegion: context.invokedFunctionArn
       .split(':')[6]
       .split('.')[0]})
    : ({accountId, accountRegion: 'us-east-1'})

const constructBucketName = ({accountId, accountRegion}) =>
  `image-resize-cloudfront-${accountId}-${accountRegion}` 

exports.handler = (event, context, callback) => {

  const BUCKET = compose(constructBucketName, getAccountRegion, getAccountId)(context)

  let response = event.Records[0].cf.response;

  console.log("Response status code :%s", response.status);

  //check if image is not present
  if (response.status == 404) {

    let request = event.Records[0].cf.request;
    let params = querystring.parse(request.querystring);

    // if there is no dimension attribute, just pass the response
    if (!params.d) {
      return callback(null, response);
    }

    // read the dimension parameter value = width x height and split it by 'x'
    let dimensionMatch = params.d.split("x");

    // read the required path. Ex: uri /images/100x100/webp/image.jpg
    let path = request.uri;

    // read the S3 key from the path variable.
    // Ex: path variable /images/100x100/webp/image.jpg
    let key = path.substring(1);

    // parse the prefix, width, height and image name
    // Ex: key=images/200x200/webp/image.jpg
    let prefix, originalKey, match, width, height, requiredFormat, imageName;
    let startIndex;

    try {
      match = key.match(/(.*)\/(\d+)x(\d+)\/(.*)\/(.*)/);
      prefix = match[1];
      width = parseInt(match[2], 10);
      height = parseInt(match[3], 10);
      
      // correction for jpg required for 'Sharp'
      requiredFormat = match[4] == "jpg" ? "jpeg" : match[4];
      imageName = match[5];
      originalKey = prefix + "/" + imageName;
      console.log(requiredFormat)
      console.log(imageName)
      console.log(originalKey)
    }
    catch (err) {
      // no prefix exist for image..
      console.log("no prefix present..");
      match = key.match(/(\d+)x(\d+)\/(.*)\/(.*)/);
      width = parseInt(match[1], 10);
      height = parseInt(match[2], 10);

      // correction for jpg required for 'Sharp'
      requiredFormat = match[3] == "jpg" ? "jpeg" : match[3]; 
      imageName = match[4];
      originalKey = imageName;
    }

    // get the source image file
    S3.getObject({ Bucket: BUCKET, Key: originalKey }).promise()
      // perform the resize operation
      .then(x => (console.log('after getObject s3:', x), x))
      .then(data => Sharp(data.Body)
        .resize(width, height)
        .toFormat(requiredFormat)
        .toBuffer()
      )
      .then(buffer => {
        // save the resized object to S3 bucket with appropriate object key.
        S3.putObject({
            Body: buffer,
            Bucket: BUCKET,
            ContentType: 'image/' + requiredFormat,
            CacheControl: 'max-age=31536000',
            Key: key,
            StorageClass: 'STANDARD'
        }).promise().then(x => (console.log('after putObject', x), x))
        // even if there is exception in saving the object we send back the generated
        // image back to viewer below
        .catch(() => { console.log("Exception while writing resized image to bucket")});

        // generate a binary response with resized image
        response.status = 200;
        response.body = buffer.toString('base64');
        response.bodyEncoding = 'base64';
        response.headers['content-type'] = [{ key: 'Content-Type', value: 'image/' + requiredFormat }];
        return callback(null, response);
      })
    .catch( err => {
      console.log("Exception while reading source image :%j",err);
    });
  } // end of if block checking response statusCode
  else {
    // allow the response to pass through
    return callback(null, response);
  }
};
