# tooly
Minimalistic tooltip plugin written in ES6

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
define(['jquery','tooly'], function($){
  //some code
});
```
Tooly comes in CommonJS, Global and AMD variants.
## Usage
Currently tooly can be triggered only on hover or manually using tooly api
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
