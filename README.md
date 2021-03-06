# tooly
Minimalistic tooltip plugin written in ES6. Tested on Chrome 46+.

## Installation
```bash
  $ bower install tooly-tip
  $ npm install tooly-tip --save
```
```html
<script src="/path/to/jquery.js"></script>
<script src="/path/to/tooly-global.js"></script>
```
or 
```javascript
requirejs.config({
    'shim': {
      'tooly'  : ['jquery']
    }
});
define(['tooly'], function($){
  //some code
});
```
Tooly comes in CommonJS, Global and AMD variants.
## Usage
Currently tooly can be triggered only on hover
### Initialization
```javascript
$(target).tooly({
    html:html,//HTML that needs to be inserted inside tooly
    animation:animation,//Tooly animation. Can be any one of 'opacity' or 'slide'
    position:position //Preferred position of tooly. Can be any one of 'top','right','bottom' and 'left'. Fallsback to other
                      //positions if not possible else throws a error
});
```
### Destroy
```javascript
$(target).tooly('destroy');
```
## Docs
```bash
  $ npm install
  $ npm run generate-docs
```
Docs will be put in /docs folder
## Examples
To run the examples
```bash
  $ npm start
```
And goto http://localhost:8080/examples/index.html
To run the examples in dev mode goto http://localhost:8080/examples/index-dev.html
