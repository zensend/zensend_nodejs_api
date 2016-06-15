[![Build Status](https://travis-ci.org/zensend/zensend_nodejs_api.svg?branch=master)](https://travis-ci.org/zensend/zensend_nodejs_api)

# Installation

    npm install zensend
    
# Manual Testing

    var zensend = require('./lib/zensend.js');
    var client = new zensend.Client("api_key");


# Development

## Release

1. Edit package.json
2. Tag and push tag
3. `npm publish`
