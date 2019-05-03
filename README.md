# cloudfront-image-resizer
AWS Lambda@Edge + Cloudfront Image Resizer

[Resizing Images with Amazon CloudFront & Lambda@Edge](https://aws.amazon.com/de/blogs/networking-and-content-delivery/resizing-images-with-amazon-cloudfront-lambdaedge-aws-cdn-blog/) 

**Important:** You need to use `origin-response/node_modules/` otherwise it's not going to work due to `sharp module` limitations. There could be a problem with the `sharp` module. Use `rm -rf node_modules/sharp
npm install --arch=x64 --platform=linux --target=8.10.0 sharp` also de-install `/.npm/_libvips/`.
