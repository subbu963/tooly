"format global";
(function(global) {

  var defined = {};

  // indexOf polyfill for IE8
  var indexOf = Array.prototype.indexOf || function(item) {
    for (var i = 0, l = this.length; i < l; i++)
      if (this[i] === item)
        return i;
    return -1;
  }

  var getOwnPropertyDescriptor = true;
  try {
    Object.getOwnPropertyDescriptor({ a: 0 }, 'a');
  }
  catch(e) {
    getOwnPropertyDescriptor = false;
  }

  var defineProperty;
  (function () {
    try {
      if (!!Object.defineProperty({}, 'a', {}))
        defineProperty = Object.defineProperty;
    }
    catch (e) {
      defineProperty = function(obj, prop, opt) {
        try {
          obj[prop] = opt.value || opt.get.call(obj);
        }
        catch(e) {}
      }
    }
  })();

  function register(name, deps, declare) {
    if (arguments.length === 4)
      return registerDynamic.apply(this, arguments);
    doRegister(name, {
      declarative: true,
      deps: deps,
      declare: declare
    });
  }

  function registerDynamic(name, deps, executingRequire, execute) {
    doRegister(name, {
      declarative: false,
      deps: deps,
      executingRequire: executingRequire,
      execute: execute
    });
  }

  function doRegister(name, entry) {
    entry.name = name;

    // we never overwrite an existing define
    if (!(name in defined))
      defined[name] = entry;

    // we have to normalize dependencies
    // (assume dependencies are normalized for now)
    // entry.normalizedDeps = entry.deps.map(normalize);
    entry.normalizedDeps = entry.deps;
  }


  function buildGroups(entry, groups) {
    groups[entry.groupIndex] = groups[entry.groupIndex] || [];

    if (indexOf.call(groups[entry.groupIndex], entry) != -1)
      return;

    groups[entry.groupIndex].push(entry);

    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      var depEntry = defined[depName];

      // not in the registry means already linked / ES6
      if (!depEntry || depEntry.evaluated)
        continue;

      // now we know the entry is in our unlinked linkage group
      var depGroupIndex = entry.groupIndex + (depEntry.declarative != entry.declarative);

      // the group index of an entry is always the maximum
      if (depEntry.groupIndex === undefined || depEntry.groupIndex < depGroupIndex) {

        // if already in a group, remove from the old group
        if (depEntry.groupIndex !== undefined) {
          groups[depEntry.groupIndex].splice(indexOf.call(groups[depEntry.groupIndex], depEntry), 1);

          // if the old group is empty, then we have a mixed depndency cycle
          if (groups[depEntry.groupIndex].length == 0)
            throw new TypeError("Mixed dependency cycle detected");
        }

        depEntry.groupIndex = depGroupIndex;
      }

      buildGroups(depEntry, groups);
    }
  }

  function link(name) {
    var startEntry = defined[name];

    startEntry.groupIndex = 0;

    var groups = [];

    buildGroups(startEntry, groups);

    var curGroupDeclarative = !!startEntry.declarative == groups.length % 2;
    for (var i = groups.length - 1; i >= 0; i--) {
      var group = groups[i];
      for (var j = 0; j < group.length; j++) {
        var entry = group[j];

        // link each group
        if (curGroupDeclarative)
          linkDeclarativeModule(entry);
        else
          linkDynamicModule(entry);
      }
      curGroupDeclarative = !curGroupDeclarative; 
    }
  }

  // module binding records
  var moduleRecords = {};
  function getOrCreateModuleRecord(name) {
    return moduleRecords[name] || (moduleRecords[name] = {
      name: name,
      dependencies: [],
      exports: {}, // start from an empty module and extend
      importers: []
    })
  }

  function linkDeclarativeModule(entry) {
    // only link if already not already started linking (stops at circular)
    if (entry.module)
      return;

    var module = entry.module = getOrCreateModuleRecord(entry.name);
    var exports = entry.module.exports;

    var declaration = entry.declare.call(global, function(name, value) {
      module.locked = true;

      if (typeof name == 'object') {
        for (var p in name)
          exports[p] = name[p];
      }
      else {
        exports[name] = value;
      }

      for (var i = 0, l = module.importers.length; i < l; i++) {
        var importerModule = module.importers[i];
        if (!importerModule.locked) {
          for (var j = 0; j < importerModule.dependencies.length; ++j) {
            if (importerModule.dependencies[j] === module) {
              importerModule.setters[j](exports);
            }
          }
        }
      }

      module.locked = false;
      return value;
    });

    module.setters = declaration.setters;
    module.execute = declaration.execute;

    // now link all the module dependencies
    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      var depEntry = defined[depName];
      var depModule = moduleRecords[depName];

      // work out how to set depExports based on scenarios...
      var depExports;

      if (depModule) {
        depExports = depModule.exports;
      }
      else if (depEntry && !depEntry.declarative) {
        depExports = depEntry.esModule;
      }
      // in the module registry
      else if (!depEntry) {
        depExports = load(depName);
      }
      // we have an entry -> link
      else {
        linkDeclarativeModule(depEntry);
        depModule = depEntry.module;
        depExports = depModule.exports;
      }

      // only declarative modules have dynamic bindings
      if (depModule && depModule.importers) {
        depModule.importers.push(module);
        module.dependencies.push(depModule);
      }
      else
        module.dependencies.push(null);

      // run the setter for this dependency
      if (module.setters[i])
        module.setters[i](depExports);
    }
  }

  // An analog to loader.get covering execution of all three layers (real declarative, simulated declarative, simulated dynamic)
  function getModule(name) {
    var exports;
    var entry = defined[name];

    if (!entry) {
      exports = load(name);
      if (!exports)
        throw new Error("Unable to load dependency " + name + ".");
    }

    else {
      if (entry.declarative)
        ensureEvaluated(name, []);

      else if (!entry.evaluated)
        linkDynamicModule(entry);

      exports = entry.module.exports;
    }

    if ((!entry || entry.declarative) && exports && exports.__useDefault)
      return exports['default'];

    return exports;
  }

  function linkDynamicModule(entry) {
    if (entry.module)
      return;

    var exports = {};

    var module = entry.module = { exports: exports, id: entry.name };

    // AMD requires execute the tree first
    if (!entry.executingRequire) {
      for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
        var depName = entry.normalizedDeps[i];
        var depEntry = defined[depName];
        if (depEntry)
          linkDynamicModule(depEntry);
      }
    }

    // now execute
    entry.evaluated = true;
    var output = entry.execute.call(global, function(name) {
      for (var i = 0, l = entry.deps.length; i < l; i++) {
        if (entry.deps[i] != name)
          continue;
        return getModule(entry.normalizedDeps[i]);
      }
      throw new TypeError('Module ' + name + ' not declared as a dependency.');
    }, exports, module);

    if (output)
      module.exports = output;

    // create the esModule object, which allows ES6 named imports of dynamics
    exports = module.exports;
 
    if (exports && exports.__esModule) {
      entry.esModule = exports;
    }
    else {
      entry.esModule = {};
      
      // don't trigger getters/setters in environments that support them
      if ((typeof exports == 'object' || typeof exports == 'function') && exports !== global) {
        if (getOwnPropertyDescriptor) {
          var d;
          for (var p in exports)
            if (d = Object.getOwnPropertyDescriptor(exports, p))
              defineProperty(entry.esModule, p, d);
        }
        else {
          var hasOwnProperty = exports && exports.hasOwnProperty;
          for (var p in exports) {
            if (!hasOwnProperty || exports.hasOwnProperty(p))
              entry.esModule[p] = exports[p];
          }
         }
       }
      entry.esModule['default'] = exports;
      defineProperty(entry.esModule, '__useDefault', {
        value: true
      });
    }
  }

  /*
   * Given a module, and the list of modules for this current branch,
   *  ensure that each of the dependencies of this module is evaluated
   *  (unless one is a circular dependency already in the list of seen
   *  modules, in which case we execute it)
   *
   * Then we evaluate the module itself depth-first left to right 
   * execution to match ES6 modules
   */
  function ensureEvaluated(moduleName, seen) {
    var entry = defined[moduleName];

    // if already seen, that means it's an already-evaluated non circular dependency
    if (!entry || entry.evaluated || !entry.declarative)
      return;

    // this only applies to declarative modules which late-execute

    seen.push(moduleName);

    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      if (indexOf.call(seen, depName) == -1) {
        if (!defined[depName])
          load(depName);
        else
          ensureEvaluated(depName, seen);
      }
    }

    if (entry.evaluated)
      return;

    entry.evaluated = true;
    entry.module.execute.call(global);
  }

  // magical execution function
  var modules = {};
  function load(name) {
    if (modules[name])
      return modules[name];

    // node core modules
    if (name.substr(0, 6) == '@node/')
      return require(name.substr(6));

    var entry = defined[name];

    // first we check if this module has already been defined in the registry
    if (!entry)
      throw "Module " + name + " not present.";

    // recursively ensure that the module and all its 
    // dependencies are linked (with dependency group handling)
    link(name);

    // now handle dependency execution in correct order
    ensureEvaluated(name, []);

    // remove from the registry
    defined[name] = undefined;

    // exported modules get __esModule defined for interop
    if (entry.declarative)
      defineProperty(entry.module.exports, '__esModule', { value: true });

    // return the defined module object
    return modules[name] = entry.declarative ? entry.module.exports : entry.esModule;
  };

  return function(mains, depNames, declare) {
    return function(formatDetect) {
      formatDetect(function(deps) {
        var System = {
          _nodeRequire: typeof require != 'undefined' && require.resolve && typeof process != 'undefined' && require,
          register: register,
          registerDynamic: registerDynamic,
          get: load, 
          set: function(name, module) {
            modules[name] = module; 
          },
          newModule: function(module) {
            return module;
          }
        };
        System.set('@empty', {});

        // register external dependencies
        for (var i = 0; i < depNames.length; i++) (function(depName, dep) {
          if (dep && dep.__esModule)
            System.register(depName, [], function(_export) {
              return {
                setters: [],
                execute: function() {
                  for (var p in dep)
                    if (p != '__esModule' && !(typeof p == 'object' && p + '' == 'Module'))
                      _export(p, dep[p]);
                }
              };
            });
          else
            System.registerDynamic(depName, [], false, function() {
              return dep;
            });
        })(depNames[i], arguments[i]);

        // register modules in this bundle
        declare(System);

        // load mains
        var firstLoad = load(mains[0]);
        if (mains.length > 1)
          for (var i = 1; i < mains.length; i++)
            load(mains[i]);

        if (firstLoad.__useDefault)
          return firstLoad['default'];
        else
          return firstLoad;
      });
    };
  };

})(typeof self != 'undefined' ? self : global)
/* (['mainModule'], ['external-dep'], function($__System) {
  System.register(...);
})
(function(factory) {
  if (typeof define && define.amd)
    define(['external-dep'], factory);
  // etc UMD / module pattern
})*/

(['1'], [], function($__System) {

(function(__global) {
  var loader = $__System;
  var indexOf = Array.prototype.indexOf || function(item) {
    for (var i = 0, l = this.length; i < l; i++)
      if (this[i] === item)
        return i;
    return -1;
  }

  var commentRegEx = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg;
  var cjsRequirePre = "(?:^|[^$_a-zA-Z\\xA0-\\uFFFF.])";
  var cjsRequirePost = "\\s*\\(\\s*(\"([^\"]+)\"|'([^']+)')\\s*\\)";
  var fnBracketRegEx = /\(([^\)]*)\)/;
  var wsRegEx = /^\s+|\s+$/g;
  
  var requireRegExs = {};

  function getCJSDeps(source, requireIndex) {

    // remove comments
    source = source.replace(commentRegEx, '');

    // determine the require alias
    var params = source.match(fnBracketRegEx);
    var requireAlias = (params[1].split(',')[requireIndex] || 'require').replace(wsRegEx, '');

    // find or generate the regex for this requireAlias
    var requireRegEx = requireRegExs[requireAlias] || (requireRegExs[requireAlias] = new RegExp(cjsRequirePre + requireAlias + cjsRequirePost, 'g'));

    requireRegEx.lastIndex = 0;

    var deps = [];

    var match;
    while (match = requireRegEx.exec(source))
      deps.push(match[2] || match[3]);

    return deps;
  }

  /*
    AMD-compatible require
    To copy RequireJS, set window.require = window.requirejs = loader.amdRequire
  */
  function require(names, callback, errback, referer) {
    // in amd, first arg can be a config object... we just ignore
    if (typeof names == 'object' && !(names instanceof Array))
      return require.apply(null, Array.prototype.splice.call(arguments, 1, arguments.length - 1));

    // amd require
    if (typeof names == 'string' && typeof callback == 'function')
      names = [names];
    if (names instanceof Array) {
      var dynamicRequires = [];
      for (var i = 0; i < names.length; i++)
        dynamicRequires.push(loader['import'](names[i], referer));
      Promise.all(dynamicRequires).then(function(modules) {
        if (callback)
          callback.apply(null, modules);
      }, errback);
    }

    // commonjs require
    else if (typeof names == 'string') {
      var module = loader.get(names);
      return module.__useDefault ? module['default'] : module;
    }

    else
      throw new TypeError('Invalid require');
  }

  function define(name, deps, factory) {
    if (typeof name != 'string') {
      factory = deps;
      deps = name;
      name = null;
    }
    if (!(deps instanceof Array)) {
      factory = deps;
      deps = ['require', 'exports', 'module'].splice(0, factory.length);
    }

    if (typeof factory != 'function')
      factory = (function(factory) {
        return function() { return factory; }
      })(factory);

    // in IE8, a trailing comma becomes a trailing undefined entry
    if (deps[deps.length - 1] === undefined)
      deps.pop();

    // remove system dependencies
    var requireIndex, exportsIndex, moduleIndex;
    
    if ((requireIndex = indexOf.call(deps, 'require')) != -1) {
      
      deps.splice(requireIndex, 1);

      // only trace cjs requires for non-named
      // named defines assume the trace has already been done
      if (!name)
        deps = deps.concat(getCJSDeps(factory.toString(), requireIndex));
    }

    if ((exportsIndex = indexOf.call(deps, 'exports')) != -1)
      deps.splice(exportsIndex, 1);
    
    if ((moduleIndex = indexOf.call(deps, 'module')) != -1)
      deps.splice(moduleIndex, 1);

    var define = {
      name: name,
      deps: deps,
      execute: function(req, exports, module) {

        var depValues = [];
        for (var i = 0; i < deps.length; i++)
          depValues.push(req(deps[i]));

        module.uri = module.id;

        module.config = function() {};

        // add back in system dependencies
        if (moduleIndex != -1)
          depValues.splice(moduleIndex, 0, module);
        
        if (exportsIndex != -1)
          depValues.splice(exportsIndex, 0, exports);
        
        if (requireIndex != -1) 
          depValues.splice(requireIndex, 0, function(names, callback, errback) {
            if (typeof names == 'string' && typeof callback != 'function')
              return req(names);
            return require.call(loader, names, callback, errback, module.id);
          });

        var output = factory.apply(exportsIndex == -1 ? __global : exports, depValues);

        if (typeof output == 'undefined' && module)
          output = module.exports;

        if (typeof output != 'undefined')
          return output;
      }
    };

    // anonymous define
    if (!name) {
      // already defined anonymously -> throw
      if (lastModule.anonDefine)
        throw new TypeError('Multiple defines for anonymous module');
      lastModule.anonDefine = define;
    }
    // named define
    else {
      // if we don't have any other defines,
      // then let this be an anonymous define
      // this is just to support single modules of the form:
      // define('jquery')
      // still loading anonymously
      // because it is done widely enough to be useful
      if (!lastModule.anonDefine && !lastModule.isBundle) {
        lastModule.anonDefine = define;
      }
      // otherwise its a bundle only
      else {
        // if there is an anonDefine already (we thought it could have had a single named define)
        // then we define it now
        // this is to avoid defining named defines when they are actually anonymous
        if (lastModule.anonDefine && lastModule.anonDefine.name)
          loader.registerDynamic(lastModule.anonDefine.name, lastModule.anonDefine.deps, false, lastModule.anonDefine.execute);

        lastModule.anonDefine = null;
      }

      // note this is now a bundle
      lastModule.isBundle = true;

      // define the module through the register registry
      loader.registerDynamic(name, define.deps, false, define.execute);
    }
  }
  define.amd = {};

  // adds define as a global (potentially just temporarily)
  function createDefine(loader) {
    lastModule.anonDefine = null;
    lastModule.isBundle = false;

    // ensure no NodeJS environment detection
    var oldModule = __global.module;
    var oldExports = __global.exports;
    var oldDefine = __global.define;

    __global.module = undefined;
    __global.exports = undefined;
    __global.define = define;

    return function() {
      __global.define = oldDefine;
      __global.module = oldModule;
      __global.exports = oldExports;
    };
  }

  var lastModule = {
    isBundle: false,
    anonDefine: null
  };

  loader.set('@@amd-helpers', loader.newModule({
    createDefine: createDefine,
    require: require,
    define: define,
    lastModule: lastModule
  }));
  loader.amdDefine = define;
  loader.amdRequire = require;
})(typeof self != 'undefined' ? self : global);

"bundle";
$__System.register('2', ['3', '4', '5', '6'], function (_export) {
  var ExtendableError, _get, _inherits, _classCallCheck, AlreadyInitializedError;

  return {
    setters: [function (_4) {
      ExtendableError = _4['default'];
    }, function (_) {
      _get = _['default'];
    }, function (_2) {
      _inherits = _2['default'];
    }, function (_3) {
      _classCallCheck = _3['default'];
    }],
    execute: function () {
      /**
       * AlreadyInitialized Error module.
       * @author Aditya Subramanyam
       * @module
       */

      /**
       * AlreadyInitialized Error
       */
      'use strict';

      AlreadyInitializedError = (function (_ExtendableError) {
        _inherits(AlreadyInitializedError, _ExtendableError);

        /**
         * Create a AlreadyInitializedError.
         * @param {(string|string[])} message - The error message/messages.
         * @param {(string|string[])} fileName - The file/files in which the eror originated.
         * @param {(string|string[])} lineNumber - The line/lines at which error occurred.
         */

        function AlreadyInitializedError(message, fileName, lineNumber) {
          _classCallCheck(this, AlreadyInitializedError);

          _get(Object.getPrototypeOf(AlreadyInitializedError.prototype), 'constructor', this).apply(this, arguments);
        }

        /** Export AlreadyInitializedError. */
        return AlreadyInitializedError;
      })(ExtendableError);

      _export('default', AlreadyInitializedError);
    }
  };
});

$__System.register('7', ['3', '4', '5', '6'], function (_export) {
  var ExtendableError, _get, _inherits, _classCallCheck, NotInitializedError;

  return {
    setters: [function (_4) {
      ExtendableError = _4['default'];
    }, function (_) {
      _get = _['default'];
    }, function (_2) {
      _inherits = _2['default'];
    }, function (_3) {
      _classCallCheck = _3['default'];
    }],
    execute: function () {
      /**
       * NotInitialized Error module.
       * @author Aditya Subramanyam
       * @module
       */

      /**
       * NotInitialized Error
       */
      'use strict';

      NotInitializedError = (function (_ExtendableError) {
        _inherits(NotInitializedError, _ExtendableError);

        /**
         * Create a NotInitializedError.
         * @param {(string|string[])} message - The error message/messages.
         * @param {(string|string[])} fileName - The file/files in which the eror originated.
         * @param {(string|string[])} lineNumber - The line/lines at which error occurred.
         */

        function NotInitializedError(message, fileName, lineNumber) {
          _classCallCheck(this, NotInitializedError);

          _get(Object.getPrototypeOf(NotInitializedError.prototype), 'constructor', this).apply(this, arguments);
        }

        /** Export NotInitializedError. */
        return NotInitializedError;
      })(ExtendableError);

      _export('default', NotInitializedError);
    }
  };
});

$__System.register('8', ['3', '4', '5', '6'], function (_export) {
  var ExtendableError, _get, _inherits, _classCallCheck, ViewPortTooSmallError;

  return {
    setters: [function (_4) {
      ExtendableError = _4['default'];
    }, function (_) {
      _get = _['default'];
    }, function (_2) {
      _inherits = _2['default'];
    }, function (_3) {
      _classCallCheck = _3['default'];
    }],
    execute: function () {
      /**
       * ViewPortTooSmall Error module.
       * @author Aditya Subramanyam
       * @module
       */

      /**
       * ViewPortTooSmall Error
       */
      'use strict';

      ViewPortTooSmallError = (function (_ExtendableError) {
        _inherits(ViewPortTooSmallError, _ExtendableError);

        /**
         * Create a ViewPortTooSmallError.
         * @param {(string|string[])} message - The error message/messages.
         * @param {(string|string[])} fileName - The file/files in which the eror originated.
         * @param {(string|string[])} lineNumber - The line/lines at which error occurred.
         */

        function ViewPortTooSmallError(message, fileName, lineNumber) {
          _classCallCheck(this, ViewPortTooSmallError);

          _get(Object.getPrototypeOf(ViewPortTooSmallError.prototype), 'constructor', this).apply(this, arguments);
        }

        /** Export ViewPortTooSmallError. */
        return ViewPortTooSmallError;
      })(ExtendableError);

      _export('default', ViewPortTooSmallError);
    }
  };
});

$__System.register('9', ['3', '4', '5', '6'], function (_export) {
  var ExtendableError, _get, _inherits, _classCallCheck, InvalidAnimationError;

  return {
    setters: [function (_4) {
      ExtendableError = _4['default'];
    }, function (_) {
      _get = _['default'];
    }, function (_2) {
      _inherits = _2['default'];
    }, function (_3) {
      _classCallCheck = _3['default'];
    }],
    execute: function () {
      /**
       * InvalidAnimation Error module.
       * @author Aditya Subramanyam
       * @module
       */

      /**
       * InvalidAnimation Error
       */
      'use strict';

      InvalidAnimationError = (function (_ExtendableError) {
        _inherits(InvalidAnimationError, _ExtendableError);

        /**
         * Create a InvalidAnimationError.
         * @param {(string|string[])} message - The error message/messages.
         * @param {(string|string[])} fileName - The file/files in which the eror originated.
         * @param {(string|string[])} lineNumber - The line/lines at which error occurred.
         */

        function InvalidAnimationError(message, fileName, lineNumber) {
          _classCallCheck(this, InvalidAnimationError);

          _get(Object.getPrototypeOf(InvalidAnimationError.prototype), 'constructor', this).apply(this, arguments);
        }

        /** Export InvalidAnimationError. */
        return InvalidAnimationError;
      })(ExtendableError);

      _export('default', InvalidAnimationError);
    }
  };
});

$__System.register("3", ["4", "5", "6"], function (_export) {
  var _get, _inherits, _classCallCheck, ExtendableError;

  return {
    setters: [function (_) {
      _get = _["default"];
    }, function (_2) {
      _inherits = _2["default"];
    }, function (_3) {
      _classCallCheck = _3["default"];
    }],
    execute: function () {
      /**
       * Extendable Error module.
       * @author Aditya Subramanyam
       * @module
       */

      /**
       * Extendable Error
       * Base class for errors to make them extendable. 
       * @interface
       */
      "use strict";

      ExtendableError = (function (_Error) {
        _inherits(ExtendableError, _Error);

        /**
         * Create a ExtendableError.
         * @param {(string|string[])} message - The error message/messages.
         * @param {(string|string[])} fileName - The file/files in which the eror originated.
         * @param {(string|string[])} lineNumber - The line/lines at which error occurred.
         */

        function ExtendableError(message, fileName, lineNumber) {
          _classCallCheck(this, ExtendableError);

          _get(Object.getPrototypeOf(ExtendableError.prototype), "constructor", this).apply(this, arguments);
          this.name = this.constructor.name;
          this.message = message;
          this.stack = new Error().stack;
        }

        /** Export ExtendableError. */
        return ExtendableError;
      })(Error);

      _export("default", ExtendableError);
    }
  };
});

$__System.registerDynamic("6", [], true, function($__require, exports, module) {
  "use strict";
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  exports["default"] = function(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  };
  exports.__esModule = true;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("a", ["b"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var isObject = $__require('b');
  module.exports = function(it) {
    if (!isObject(it))
      throw TypeError(it + ' is not an object!');
    return it;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("b", [], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function(it) {
    return typeof it === 'object' ? it !== null : typeof it === 'function';
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("c", ["d", "b", "a", "e"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var getDesc = $__require('d').getDesc,
      isObject = $__require('b'),
      anObject = $__require('a');
  var check = function(O, proto) {
    anObject(O);
    if (!isObject(proto) && proto !== null)
      throw TypeError(proto + ": can't set as prototype!");
  };
  module.exports = {
    set: Object.setPrototypeOf || ('__proto__' in {} ? function(test, buggy, set) {
      try {
        set = $__require('e')(Function.call, getDesc(Object.prototype, '__proto__').set, 2);
        set(test, []);
        buggy = !(test instanceof Array);
      } catch (e) {
        buggy = true;
      }
      return function setPrototypeOf(O, proto) {
        check(O, proto);
        if (buggy)
          O.__proto__ = proto;
        else
          set(O, proto);
        return O;
      };
    }({}, false) : undefined),
    check: check
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("f", ["10", "c"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $export = $__require('10');
  $export($export.S, 'Object', {setPrototypeOf: $__require('c').set});
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("11", ["f", "12"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  $__require('f');
  module.exports = $__require('12').Object.setPrototypeOf;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("13", ["11"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": $__require('11'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("14", ["d"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $ = $__require('d');
  module.exports = function create(P, D) {
    return $.create(P, D);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("15", ["14"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": $__require('14'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("5", ["15", "13"], true, function($__require, exports, module) {
  "use strict";
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var _Object$create = $__require('15')["default"];
  var _Object$setPrototypeOf = $__require('13')["default"];
  exports["default"] = function(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
    }
    subClass.prototype = _Object$create(superClass && superClass.prototype, {constructor: {
        value: subClass,
        enumerable: false,
        writable: true,
        configurable: true
      }});
    if (superClass)
      _Object$setPrototypeOf ? _Object$setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
  };
  exports.__esModule = true;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("16", [], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function(exec) {
    try {
      return !!exec();
    } catch (e) {
      return true;
    }
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("17", [], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function(it) {
    if (typeof it != 'function')
      throw TypeError(it + ' is not a function!');
    return it;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("e", ["17"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var aFunction = $__require('17');
  module.exports = function(fn, that, length) {
    aFunction(fn);
    if (that === undefined)
      return fn;
    switch (length) {
      case 1:
        return function(a) {
          return fn.call(that, a);
        };
      case 2:
        return function(a, b) {
          return fn.call(that, a, b);
        };
      case 3:
        return function(a, b, c) {
          return fn.call(that, a, b, c);
        };
    }
    return function() {
      return fn.apply(that, arguments);
    };
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("12", [], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var core = module.exports = {version: '1.2.6'};
  if (typeof __e == 'number')
    __e = core;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("18", [], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var global = module.exports = typeof window != 'undefined' && window.Math == Math ? window : typeof self != 'undefined' && self.Math == Math ? self : Function('return this')();
  if (typeof __g == 'number')
    __g = global;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("10", ["18", "12", "e"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var global = $__require('18'),
      core = $__require('12'),
      ctx = $__require('e'),
      PROTOTYPE = 'prototype';
  var $export = function(type, name, source) {
    var IS_FORCED = type & $export.F,
        IS_GLOBAL = type & $export.G,
        IS_STATIC = type & $export.S,
        IS_PROTO = type & $export.P,
        IS_BIND = type & $export.B,
        IS_WRAP = type & $export.W,
        exports = IS_GLOBAL ? core : core[name] || (core[name] = {}),
        target = IS_GLOBAL ? global : IS_STATIC ? global[name] : (global[name] || {})[PROTOTYPE],
        key,
        own,
        out;
    if (IS_GLOBAL)
      source = name;
    for (key in source) {
      own = !IS_FORCED && target && key in target;
      if (own && key in exports)
        continue;
      out = own ? target[key] : source[key];
      exports[key] = IS_GLOBAL && typeof target[key] != 'function' ? source[key] : IS_BIND && own ? ctx(out, global) : IS_WRAP && target[key] == out ? (function(C) {
        var F = function(param) {
          return this instanceof C ? new C(param) : C(param);
        };
        F[PROTOTYPE] = C[PROTOTYPE];
        return F;
      })(out) : IS_PROTO && typeof out == 'function' ? ctx(Function.call, out) : out;
      if (IS_PROTO)
        (exports[PROTOTYPE] || (exports[PROTOTYPE] = {}))[key] = out;
    }
  };
  $export.F = 1;
  $export.G = 2;
  $export.S = 4;
  $export.P = 8;
  $export.B = 16;
  $export.W = 32;
  module.exports = $export;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("19", ["10", "12", "16"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $export = $__require('10'),
      core = $__require('12'),
      fails = $__require('16');
  module.exports = function(KEY, exec) {
    var fn = (core.Object || {})[KEY] || Object[KEY],
        exp = {};
    exp[KEY] = exec(fn);
    $export($export.S + $export.F * fails(function() {
      fn(1);
    }), 'Object', exp);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("1a", [], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function(it) {
    if (it == undefined)
      throw TypeError("Can't call method on  " + it);
    return it;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("1b", [], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var toString = {}.toString;
  module.exports = function(it) {
    return toString.call(it).slice(8, -1);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("1c", ["1b"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var cof = $__require('1b');
  module.exports = Object('z').propertyIsEnumerable(0) ? Object : function(it) {
    return cof(it) == 'String' ? it.split('') : Object(it);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("1d", ["1c", "1a"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var IObject = $__require('1c'),
      defined = $__require('1a');
  module.exports = function(it) {
    return IObject(defined(it));
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("1e", ["1d", "19"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var toIObject = $__require('1d');
  $__require('19')('getOwnPropertyDescriptor', function($getOwnPropertyDescriptor) {
    return function getOwnPropertyDescriptor(it, key) {
      return $getOwnPropertyDescriptor(toIObject(it), key);
    };
  });
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("d", [], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $Object = Object;
  module.exports = {
    create: $Object.create,
    getProto: $Object.getPrototypeOf,
    isEnum: {}.propertyIsEnumerable,
    getDesc: $Object.getOwnPropertyDescriptor,
    setDesc: $Object.defineProperty,
    setDescs: $Object.defineProperties,
    getKeys: $Object.keys,
    getNames: $Object.getOwnPropertyNames,
    getSymbols: $Object.getOwnPropertySymbols,
    each: [].forEach
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("1f", ["d", "1e"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $ = $__require('d');
  $__require('1e');
  module.exports = function getOwnPropertyDescriptor(it, key) {
    return $.getDesc(it, key);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("20", ["1f"], true, function($__require, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": $__require('1f'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("4", ["20"], true, function($__require, exports, module) {
  "use strict";
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var _Object$getOwnPropertyDescriptor = $__require('20')["default"];
  exports["default"] = function get(_x, _x2, _x3) {
    var _again = true;
    _function: while (_again) {
      var object = _x,
          property = _x2,
          receiver = _x3;
      _again = false;
      if (object === null)
        object = Function.prototype;
      var desc = _Object$getOwnPropertyDescriptor(object, property);
      if (desc === undefined) {
        var parent = Object.getPrototypeOf(object);
        if (parent === null) {
          return undefined;
        } else {
          _x = parent;
          _x2 = property;
          _x3 = receiver;
          _again = true;
          desc = parent = undefined;
          continue _function;
        }
      } else if ("value" in desc) {
        return desc.value;
      } else {
        var getter = desc.get;
        if (getter === undefined) {
          return undefined;
        }
        return getter.call(receiver);
      }
    }
  };
  exports.__esModule = true;
  global.define = __define;
  return module.exports;
});

$__System.register('21', ['3', '4', '5', '6'], function (_export) {
  var ExtendableError, _get, _inherits, _classCallCheck, InvalidPositionError;

  return {
    setters: [function (_4) {
      ExtendableError = _4['default'];
    }, function (_) {
      _get = _['default'];
    }, function (_2) {
      _inherits = _2['default'];
    }, function (_3) {
      _classCallCheck = _3['default'];
    }],
    execute: function () {
      /**
       * InvalidPosition Error module.
       * @author Aditya Subramanyam
       * @module
       */

      /**
       * InvalidPosition Error
       */
      'use strict';

      InvalidPositionError = (function (_ExtendableError) {
        _inherits(InvalidPositionError, _ExtendableError);

        /**
         * Create a InvalidPositionError.
         * @param {(string|string[])} message - The error message/messages.
         * @param {(string|string[])} fileName - The file/files in which the eror originated.
         * @param {(string|string[])} lineNumber - The line/lines at which error occurred.
         */

        function InvalidPositionError(message, fileName, lineNumber) {
          _classCallCheck(this, InvalidPositionError);

          _get(Object.getPrototypeOf(InvalidPositionError.prototype), 'constructor', this).apply(this, arguments);
        }

        /** Export InvalidPositionError. */
        return InvalidPositionError;
      })(ExtendableError);

      _export('default', InvalidPositionError);
    }
  };
});

$__System.register("22", [], function() { return { setters: [], execute: function() {} } });

(function() {
var _removeDefine = $__System.get("@@amd-helpers").createDefine();
define("23", [], function() {
  return "<div class=\"tooly-container\">\n    <div class=\"body-wrapper\">\n    </div>\n</div>\n";
});

_removeDefine();
})();
$__System.register('24', [], function (_export) {
  /**
   * Utils module.
   * @author Aditya Subramanyam
   * @module
   */

  /**
   * A unique identifier.
   * @type {number}
   */
  'use strict';

  var curUID;

  /**
   * Generates a unique identifier.
   * @return {number} A unique identifier
   */
  function nextUID() {
    return curUID++;
  }

  /**
   * Given a hashmap of styles and a selector returns a string of css styles.
   * @param {string} selector selector
   * @param {object} styles styles to add to the selector
   * @return {string} string of css styles
   */
  function createStyles(selector, styles) {
    var styleSheet = '';
    for (var style in styles) {
      if (styles.hasOwnProperty(style)) {
        styleSheet += style + ':' + styles[style] + ';';
      }
    }
    return selector + '{' + styleSheet + '}';
  }
  /** 
   * Export the whole utils.
   */
  return {
    setters: [],
    execute: function () {
      curUID = 1;

      _export('default', {
        nextUID: nextUID,
        createStyles: createStyles
      });

      /** 
       * Export individual utils.
       */

      _export('nextUID', nextUID);

      _export('createStyles', createStyles);
    }
  };
});

$__System.register("25", [], function (_export) {
  /**
   * Jquery adapter module.
   * @author Aditya Subramanyam
   * @module
   */

  /** 
   * Export jquery attached to the window.
   */
  "use strict";

  return {
    setters: [],
    execute: function () {
      _export("default", window.jQuery);
    }
  };
});

$__System.register('1', ['2', '7', '8', '9', '21', '22', '23', '24', '25'], function (_export) {
    /**
     * Tooly module.
     * @author Aditya Subramanyam
     * @module
     */

    /** 
     * Default tooly options
     * @constant
     * @default
     * @type {object}
     */
    'use strict';

    var AlreadyInitializedError, NotInitializedError, ViewPortTooSmallError, InvalidAnimationError, InvalidPositionError, toolyTpl, nextUID, createStyles, $, DEFAULT_OPTIONS, TARGET_CLASS_PREFIX, CONTAINER_ID_PREFIX, STYLE_PREFIX, ANCHOR_HEIGHT, TOOLY_OPTIONS, POSITIONS_ACCEPTED, ANIMATIONS_ACCEPTED, ANIMATE_CLASS_PREFIX, DEFAULT_ANCHOR_STYLES, $window, $body, currWinHeight, currWinWidth;

    /**
     * Returns the next possible position to try
     * @param {string} position position
     * @return {number} index of next position in POSITIONS_ACCEPTED
     */
    function _getNextPostion(position) {
        var currPosition = POSITIONS_ACCEPTED.indexOf(position);
        if (currPosition === POSITIONS_ACCEPTED.length - 1) {
            return 0;
        }
        return currPosition + 1;
    }
    /**
     * Checks whether the tooltip will fit in the window
     * @param {number} containerLeft distance of container from left
     * @param {number} containerTop distance of container from top
     * @param {number} containerHeight container height
     * @param {number} containerWidth container width
     * @param {string} position position
     * @return {boolean} whether tooltip will fit or not
     */
    function _tooltipWillFit(containerLeft, containerTop, containerHeight, containerWidth, position) {
        switch (position) {
            case 'top':
                return containerTop >= 0 && containerLeft + containerWidth <= currWinWidth;
            case 'right':
                return containerLeft + containerWidth <= currWinWidth && containerTop + containerHeight <= currWinHeight;
            case 'bottom':
                return containerTop + containerHeight <= currWinHeight && containerLeft + containerWidth <= currWinWidth;
            case 'left':
                return containerLeft >= 0 && containerTop + containerHeight <= currWinHeight;
        }
    }
    /**
     * Calculates the styles and position of the container that needs to be applied
     * @param {jQuery} el target element
     * @param {jQuery} container element for which the styles and position needs to be calculated
     * @param {string} position position
     * @param {string} preferredPosition Preferred position of tooly
     * @return {object} object containing styles and position
     */
    function _getStylesAndPos(_x, _x2, _x3, _x4) {
        var _again = true;

        _function: while (_again) {
            var el = _x,
                container = _x2,
                position = _x3,
                preferredPosition = _x4;
            _again = false;

            preferredPosition = preferredPosition || position;
            var options = el.data(TOOLY_OPTIONS);
            var elWidth = el.width(),
                elHeight = el.height(),
                elPosition = el.offset();
            var containerWidth = container.width(),
                containerHeight = container.height(),
                containerId = '#' + _getToolyContainerId(options.id),
                containerTop = elPosition.top - $window.scrollTop(),
                containerLeft = elPosition.left - $window.scrollLeft(),
                containerStyles = undefined,
                anchorStyles = undefined;
            switch (position) {
                case 'top':
                    containerHeight += ANCHOR_HEIGHT;
                    containerTop -= containerHeight;
                    break;
                case 'right':
                    containerLeft += elWidth + ANCHOR_HEIGHT;
                    break;
                case 'bottom':
                    containerTop += elHeight + ANCHOR_HEIGHT;
                    break;
                case 'left':
                    containerWidth += ANCHOR_HEIGHT;
                    containerLeft -= containerWidth;
                    break;
            }
            if (!_tooltipWillFit(containerLeft, containerTop, containerHeight, containerWidth, position)) {
                var nextPosition = _getNextPostion(position);
                if (nextPosition === POSITIONS_ACCEPTED.indexOf(preferredPosition)) {
                    throw new ViewPortTooSmallError('viewport too small!');
                }
                _x = el;
                _x2 = container;
                _x3 = POSITIONS_ACCEPTED[nextPosition];
                _x4 = preferredPosition;
                _again = true;
                options = elWidth = elHeight = elPosition = containerWidth = containerHeight = containerId = containerTop = containerLeft = containerStyles = anchorStyles = nextPosition = undefined;
                continue _function;
            }
            containerStyles = createStyles(containerId, {
                'top': containerTop + 'px',
                'left': containerLeft + 'px'
            });
            anchorStyles = createStyles(containerId + ':before', DEFAULT_ANCHOR_STYLES[position]);
            return {
                styles: containerStyles + anchorStyles,
                position: position
            };
        }
    }
    /**
     * Returns the id of a tooly container
     * @param {number} id id of tooly
     * @return {string} container id
     */
    function _getToolyContainerId(id) {
        return CONTAINER_ID_PREFIX + id;
    }
    /**
     * Returns the class of a tooly target
     * @param {number} id id of tooly
     * @return {string} target class
     */
    function _getToolyTargetClass(id) {
        return TARGET_CLASS_PREFIX + id;
    }
    /**
     * Returns the id of a tooly style element
     * @param {number} id id of tooly
     * @return {string} style id
     */
    function _getToolyStyleId(id) {
        return STYLE_PREFIX + id;
    }
    /**
     * Cleanups styles and containers appended to the document
     * @param {jQuery} el tooly target
     */
    function _cleanup(el) {
        var options = el.data(TOOLY_OPTIONS);
        var targetClass = 'tooly ' + _getToolyTargetClass(options.id);
        $body.find('.tooly.' + _getToolyTargetClass(options.id)).removeClass('tooly ' + _getToolyTargetClass(options.id));
        $body.find('#' + _getToolyContainerId(options.id) + ',\n            #' + _getToolyStyleId(options.id)).remove();
    }
    /**
     * Animates the container
     * @param {jQuery} toolyContainer tooly container
     * @param {string} animationClass class that needs to be applied to the tooly target
     */
    function _animateContainer(toolyContainer, animationClass) {
        toolyContainer.addClass(ANIMATE_CLASS_PREFIX + animationClass).animate({
            opacity: 1,
            margin: 0
        }, 100);
    }
    /**
     * Returns the id of a tooly style element
     * @param {jQuery} el tooly target
     * @param {jQuery} toolyContainer tooly container
     * @param {string} position position
     * @param {string} animation animation that needs to be applied to the tooly target
     */
    function _animate(el, toolyContainer, position, animation) {
        switch (animation) {
            case 'slide':
                _animateContainer(toolyContainer, animation + '-' + position);
                break;
            default:
                _animateContainer(toolyContainer, animation);
        }
    }
    /**
     * Callback for mouseover on a tooly target
     * @listens mouseover
     */
    function _onMouseOver() {
        var _this = $(this);
        var options = _this.data(TOOLY_OPTIONS);
        var toolyContainer = $(toolyTpl).attr('id', _getToolyContainerId(options.id));
        _this.addClass('tooly ' + _getToolyTargetClass(options.id));
        toolyContainer.find('.body-wrapper').html(options.html);
        $body.append(toolyContainer);
        try {
            var stylesAndPos = _getStylesAndPos(_this, toolyContainer, options.position);
            $body.append('<style id="' + _getToolyStyleId(options.id) + '">' + stylesAndPos.styles + '</style>');
            _animate(_this, toolyContainer, stylesAndPos.position, options.animation);
        } catch (e) {
            _cleanup(_this);
            if (e instanceof ViewPortTooSmallError) {
                console.error(e.message);
            } else {
                //rethrow the error to be caught by error loggers like ravenjs/errorception
                throw e;
            }
        }
    }
    /**
     * Callback for mouseout on a tooly target
     * @listens mouseout
     */
    function _onMouseOut() {
        var _this = $(this);
        _cleanup(_this);
    }
    /**
     * Destroy's a tooly target
     * @param {jQuery} el tooly target
     */
    function _destroy(el) {
        _cleanup(el);
        el.removeData(TOOLY_OPTIONS).off('mouseover', _onMouseOver).off('mouseout', _onMouseOut);
    }
    /**
     * Verifies the options provided are valid or not
     * @param {object} tooly options
     */
    function _verifyOptions(options) {
        if (POSITIONS_ACCEPTED.indexOf(options.position) === -1) {
            throw new InvalidPositionError(options.position + ' not recognized!');
        }
        if (ANIMATIONS_ACCEPTED.indexOf(options.animation) === -1) {
            throw new InvalidAnimationError(options.animation + ' not recognized!');
        }
    }
    /**
     * Tooly internal initializer
     * @param {object} tooly options
     */
    function _tooly(options) {
        var _this = $(this);
        var type = $.type(options);
        var existingOptions = _this.data(TOOLY_OPTIONS);
        if (type === 'object' || type === 'undefined') {
            if (existingOptions) {
                throw new AlreadyInitializedError('tooly already initialized!');
            }
            options = $.extend({}, DEFAULT_OPTIONS, options);
            options.id = nextUID();
            _verifyOptions(options);
            _this.data(TOOLY_OPTIONS, options);
            _this.mouseover(_onMouseOver).mouseout(_onMouseOut);
        } else if (type === 'string') {
            if (!existingOptions) {
                throw new NotInitializedError('tooly not initialized!');
            }
            switch (options) {
                case 'destroy':
                    _destroy(_this);
                    break;
                default:
            }
        }
    }
    /**
     * Tooly external initializer
     * @param {object} tooly options
     */
    return {
        setters: [function (_9) {
            AlreadyInitializedError = _9['default'];
        }, function (_8) {
            NotInitializedError = _8['default'];
        }, function (_7) {
            ViewPortTooSmallError = _7['default'];
        }, function (_6) {
            InvalidAnimationError = _6['default'];
        }, function (_5) {
            InvalidPositionError = _5['default'];
        }, function (_4) {}, function (_3) {
            toolyTpl = _3['default'];
        }, function (_2) {
            nextUID = _2.nextUID;
            createStyles = _2.createStyles;
        }, function (_) {
            $ = _['default'];
        }],
        execute: function () {
            DEFAULT_OPTIONS = {
                position: 'top',
                animation: 'opacity'
            };

            /** 
             * Prefix of class that will be applied to the target element
             * @constant
             * @type {string}
             */
            TARGET_CLASS_PREFIX = 'tooly-id-';

            /** 
             * Prefix of id that will be applied to the container element
             * @constant
             * @type {string}
             */
            CONTAINER_ID_PREFIX = 'tooly-container-id-';

            /** 
             * Prefix of id that will be applied to the style element
             * @constant
             * @type {string}
             */
            STYLE_PREFIX = 'tooly-style-id-';

            /** 
             * Anchor elements visible diagonal length
             * @constant
             * @type {number}
             */
            ANCHOR_HEIGHT = 9;

            /** 
             * Key of data object stored in the element
             * @constant
             * @type {string}
             */
            TOOLY_OPTIONS = 'tooly-options';

            /** 
             * Positions accepted when initializing tooly
             * @constant
             * @type {string[]}
             */
            POSITIONS_ACCEPTED = ['top', 'right', 'bottom', 'left'];

            /** 
             * Animations accepted when initializing tooly
             * @constant
             * @type {string[]}
             */
            ANIMATIONS_ACCEPTED = ['opacity', 'slide'];

            /** 
             * Prefix of class that will be applied to animate the container
             * @constant
             * @type {string}
             */
            ANIMATE_CLASS_PREFIX = 'animate-';

            /** 
             * Default anchor styles
             * @constant
             * @default
             * @type {object}
             */
            DEFAULT_ANCHOR_STYLES = {
                top: {
                    'bottom': '-5px',
                    'left': '32px',
                    'box-shadow': '1px 1px 0 0 #BABABC'
                },
                right: {
                    'top': '5px',
                    'left': '-5px',
                    'box-shadow': '-1px 1px 0 0 #BABABC'
                },
                bottom: {
                    'top': '-5px',
                    'left': '32px',
                    'box-shadow': '-1px -1px 0 0 #BABABC'
                },
                left: {
                    'top': '5px',
                    'right': '-5px',
                    'box-shadow': '1px -1px 0 0 #BABABC'
                }
            };

            /** 
             * Jquery wrapped window
             * @type {jQuery}
             */
            $window = $(window);

            /** 
             * Jquery wrapped body
             * @type {jQuery}
             */
            $body = $('body');

            /** 
             * Current window height
             * @default
             * @type {number}
             */
            currWinHeight = $window.height();

            /** 
             * Current window width
             * @default
             * @type {number}
             */
            currWinWidth = $window.width();

            $window.resize(function () {
                console.log('window resized');
                currWinHeight = $window.height();
                currWinWidth = $window.width();
            });$.fn.tooly = function (options) {
                for (var i = 0; i < this.length; i++) {
                    _tooly.call(this[i], options);
                }

                return this;
            };
            /** 
             * Export jquery.
             */

            _export('default', $);
        }
    };
});

$__System.register('tooly.scss!github:mobilexag/plugin-sass@0.1.0', [], false, function() {});
(function(c){var d=document,a='appendChild',i='styleSheet',s=d.createElement('style');s.type='text/css';d.getElementsByTagName('head')[0][a](s);s[i]?s[i].cssText=c:s[a](d.createTextNode(c));})
(".tooly-container{position:fixed;min-width:100px;border:1px solid #ECEFF1;border-radius:4px;border:1px solid #D4D4D5;max-width:250px;box-shadow:0 2px 4px 0 rgba(34,36,38,0.12),0 2px 10px 0 rgba(34,36,38,0.08);background-color:#FFFFFF;opacity:1}.tooly-container .body-wrapper{position:relative}.tooly-container:before{position:absolute;margin-left:0;content:'';width:12px;height:12px;transform:rotate(45deg);background:#FFFFFF}.tooly-container.animate-opacity{opacity:0}.tooly-container.animate-slide-top{margin-top:10px}.tooly-container.animate-slide-right{margin-left:-10px}.tooly-container.animate-slide-bottom{margin-top:-10px}.tooly-container.animate-slide-left{margin-left:10px}\n");
})
(function(factory) {
  factory();
});