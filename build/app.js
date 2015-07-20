(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function() {
  'use strict';

  var ESCAPE_DELIMITERS = ['|', '^'],
      CELL_DELIMITERS = [',', ';', '\t', '|', '^'],
      LINE_DELIMITERS = ['\r\n', '\r', '\n'];

  function isObject(object) {
    var type = typeof object;
    return type === 'function' || type === 'object' && !!object;
  }
  var isArray = Array.isArray || function(object) {
    return toString.call(object) === '[object Array]';
  }
  function isString(object) {
    return typeof object === 'string';
  }
  function isNumber(object) {
    return !isNaN(Number(object));
  }
  function isBoolean(value) {
    return value == false || value == true;
  }
  function isNull(value) {
    return value == null;
  }
  function isPresent(value) {
    return value != null;
  }

  function fallback(value, fallback) {
    return isPresent(value) ? value : fallback;
  }

  function forEach(collection, iterator) {
    for (var _i = 0, _len = collection.length; _i < _len; _i += 1) {
      if (iterator(collection[_i], _i) === false) break;
    }
  }

  function sanitizeString(string) {
    return string.replace(/"/g,'\\"');
  }

  function buildCell(index) {
    return 'attrs[' + index + ']';
  }

  function castCell(value, index) {
    if (isNumber(value)) {
      return 'Number(' + buildCell(index) + ')';
    } else if (isBoolean(value)) {
      return 'Boolean(' + buildCell(index) + ' == true)';
    } else {
      return 'String(' + buildCell(index) + ')';
    }
  }

  function buildConstructor(cast, values, attrs) {
    var definition = [];
    if (arguments.length == 2) {
      if (cast) {
        if (isArray(cast)) {
          forEach(values, function(value, index) {
            definition.push(cast[index] + '(' + buildCell(index) + ')');
          });
        } else {
          forEach(values, function(value, index) {
            definition.push(castCell(value, index));
          });
        }
      } else {
        forEach(values, function(value, index) {
          definition.push(buildCell(index));
        });
      }
      definition = 'return [' + definition.join(',') + ']';
    } else {
      if (cast) {
        if (isArray(cast)) {
          forEach(values, function(value, index) {
            definition.push('"' + sanitizeString(attrs[index]) + '": ' + cast[index] + '(' + buildCell(index) + ')');
          });
        } else {
          forEach(values, function(value, index) {
            definition.push('"' + sanitizeString(attrs[index]) + '": ' + castCell(value, index));
          });
        }
      } else {
        forEach(values, function(value, index) {
          definition.push('"' + sanitizeString(attrs[index]) + '": ' + buildCell(index));
        });
      }
      definition = 'return {' + definition.join(',') + '}';
    }
    return new Function('attrs', definition);
  }

  function detectDelimiter(string, delimiters) {
    var count = 0,
        detected;

    forEach(delimiters, function(delimiter) {
      var needle = delimiter,
          matches;
      if (ESCAPE_DELIMITERS.indexOf(delimiter) != -1) {
        needle = '\\' + needle;
      }
      matches = string.match(new RegExp(needle, 'g'));
      if (matches && matches.length > count) {
        count = matches.length;
        detected = delimiter;
      }
    });
    return (detected || delimiters[0]);
  }

  var CSV = (function() {
    function CSV(data, options) {
      if (!options) options = {};

      if (isArray(data)) {
        this.mode = 'encode';
      } else if (isString(data)) {
        this.mode = 'parse';
      } else {
        throw new Error("Incompatible format!");
      }

      this.data = data;

      this.options = {
        header: fallback(options.header, false),
        cast: fallback(options.cast, true)
      }

      var lineDelimiter = options.lineDelimiter || options.line,
          cellDelimiter = options.cellDelimiter || options.delimiter;

      if (this.isParser()) {
        this.options.lineDelimiter = lineDelimiter || detectDelimiter(this.data, LINE_DELIMITERS);
        this.options.cellDelimiter = cellDelimiter || detectDelimiter(this.data, CELL_DELIMITERS);
        this.data = normalizeCSV(this.data, this.options.lineDelimiter);
      } else if (this.isEncoder()) {
        this.options.lineDelimiter = lineDelimiter || '\r\n';
        this.options.cellDelimiter = cellDelimiter || ',';
      }
    }

    function invoke(method, constructor, attributes) {
      method(new constructor(attributes));
    }

    function normalizeCSV(text, lineDelimiter) {
      if (text.slice(-lineDelimiter.length) != lineDelimiter) text += lineDelimiter;
      return text;
    }

    CSV.prototype.set = function(setting, value) {
      return this.options[setting] = value;
    }

    CSV.prototype.isParser = function() {
      return this.mode == 'parse';
    }

    CSV.prototype.isEncoder = function() {
      return this.mode == 'encode';
    }

    CSV.prototype.parse = function(callback) {
      if (this.mode != 'parse') return;

      if (this.data.trim().length === 0) return [];

      var data = this.data,
          options = this.options,
          header = options.header,
          current = { cell: '', line: [] },
          flag, record, response;

      if (!callback) {
        response = [];
        callback = function(record) {
          response.push(record);
        }
      }

      function resetFlags() {
        flag = { escaped: false, quote: false, cell: true };
      }
      function resetCell() {
        current.cell = '';
      }
      function resetLine() {
        current.line = [];
      }

      function saveCell(cell) {
        current.line.push(flag.escaped ? cell.slice(1, -1).replace(/""/g, '"') : cell);
        resetCell();
        resetFlags();
      }
      function saveLastCell(cell) {
        saveCell(cell.slice(0, 1 - options.lineDelimiter.length));
      }
      function saveLine() {
        if (header) {
          if (isArray(header)) {
            record = buildConstructor(options.cast, current.line, header);
            saveLine = function() { invoke(callback, record, current.line); };
            saveLine();
          } else {
            header = current.line;
          }
        } else {
          if (!record) {
            record = buildConstructor(options.cast, current.line);
          }
          saveLine = function() { invoke(callback, record, current.line); };
          saveLine();
        }
      }

      if (options.lineDelimiter.length == 1) saveLastCell = saveCell;

      var dataLength = data.length,
          cellDelimiter = options.cellDelimiter.charCodeAt(0),
          lineDelimiter = options.lineDelimiter.charCodeAt(options.lineDelimiter.length - 1),
          _i, _c, _ch;

      resetFlags();

      for (_i = 0, _c = 0; _i < dataLength; _i++) {
        _ch = data.charCodeAt(_i);

        if (flag.cell) {
          flag.cell = false;
          if (_ch == 34) {
            flag.escaped = true;
            continue;
          }
        }

        if (flag.escaped && _ch == 34) {
          flag.quote = !flag.quote;
          continue;
        }

        if ((flag.escaped && flag.quote) || !flag.escaped) {
          if (_ch == cellDelimiter) {
            saveCell(current.cell + data.slice(_c, _i));
            _c = _i + 1;
          } else if (_ch == lineDelimiter) {
            saveLastCell(current.cell + data.slice(_c, _i));
            _c = _i + 1;
            saveLine();
            resetLine();
          }
        }
      }

      if (response) {
        return response;
      } else {
        return this;
      }
    }

    function serializeType(object) {
      if (isArray(object)) {
        return 'array';
      } else if (isObject(object)) {
        return 'object';
      } else if (isString(object)) {
        return 'string';
      } else if (isNull(object)) {
        return 'null';
      } else {
        return 'primitive';
      }
    }

    CSV.prototype.serialize = {
      "object": function(object) {
        var that = this,
            attributes = Object.keys(object),
            serialized = Array(attributes.length);
        forEach(attributes, function(attr, index) {
          serialized[index] = that[serializeType(object[attr])](object[attr]);
        });
        return serialized;
      },
      "array": function(array) {
        var that = this,
            serialized = Array(array.length);
        forEach(array, function(value, index) {
          serialized[index] = that[serializeType(value)](value);
        });
        return serialized;
      },
      "string": function(string) {
        return '"' + String(string).replace(/"/g, '""') + '"';
      },
      "null": function(value) {
        return '';
      },
      "primitive": function(value) {
        return value;
      }
    }

    CSV.prototype.encode = function(callback) {
      if (this.mode != 'encode') return;

      if (this.data.length == 0) return '';

      var data = this.data,
          options = this.options,
          header = options.header,
          sample = data[0],
          serialize = this.serialize,
          offset = 0,
          attributes, response;

      if (!callback) {
        response = Array(data.length);
        callback = function(record, index) {
          response[index + offset] = record;
        }
      }

      function serializeLine(record) {
        return record.join(options.cellDelimiter);
      }

      if (header) {
        if (!isArray(header)) {
          attributes = Object.keys(sample);
          header = attributes;
        }
        callback(serializeLine(serialize.array(header)), 0);
        offset = 1;
      }

      var recordType = serializeType(sample),
          map;

      if (recordType == 'array') {
        if (isArray(options.cast)) {
          map = Array(options.cast.length);
          forEach(options.cast, function(type, index) {
            map[index] = type.toLowerCase();
          });
        } else {
          map = Array(sample.length);
          forEach(sample, function(value, index) {
            map[index] = serializeType(value);
          });
        }
        forEach(data, function(record, recordIndex) {
          var serializedRecord = Array(map.length);
          forEach(record, function(value, valueIndex) {
            serializedRecord[valueIndex] = serialize[map[valueIndex]](value);
          });
          callback(serializeLine(serializedRecord), recordIndex);
        });
      } else if (recordType == 'object') {
        attributes = Object.keys(sample);
        if (isArray(options.cast)) {
          map = Array(options.cast.length);
          forEach(options.cast, function(type, index) {
            map[index] = type.toLowerCase();
          });
        } else {
          map = Array(attributes.length);
          forEach(attributes, function(attr, index) {
            map[index] = serializeType(sample[attr]);
          });
        }
        forEach(data, function(record, recordIndex) {
          var serializedRecord = Array(attributes.length);
          forEach(attributes, function(attr, attrIndex) {
            serializedRecord[attrIndex] = serialize[map[attrIndex]](record[attr]);
          });
          callback(serializeLine(serializedRecord), recordIndex);
        });
      }

      if (response) {
        return response.join(options.lineDelimiter);
      } else {
        return this;
      }
    }

    CSV.prototype.forEach = function(callback) {
      return this[this.mode](callback);
    }

    return CSV;
  })();

  CSV.parse = function(data, options) {
    return new CSV(data, options).parse();
  }

  CSV.encode = function(data, options) {
    return new CSV(data, options).encode();
  }

  CSV.forEach = function(data, options, callback) {
    if (arguments.length == 2) {
      callback = options;
    }
    return new CSV(data, options).forEach(callback);
  }

  if (typeof define === "function" && define.amd) {
    define('CSV', [], function() {
      return CSV;
    });
  } else if (typeof module === "object" && module.exports) {
    module.exports = CSV;
  } else if (window) {
    window.CSV = CSV;
  }
})();

},{}],2:[function(require,module,exports){
'use strict';

var NihongoApp = require("./components/NihongoApp");

React.render(
	React.createElement(NihongoApp, null),
	document.getElementById("app")
);

},{"./components/NihongoApp":5}],3:[function(require,module,exports){
'use strict';

var Vocable = require("./Vocable");

var Dictionary = React.createClass({displayName: "Dictionary",

	propTypes: {
		vocables: React.PropTypes.arrayOf(React.PropTypes.shape({
			kana: React.PropTypes.string,
			transcription: React.PropTypes.string,
			translation: React.PropTypes.string
		})).isRequired
	},

	getInitialState: function() {
		return {
			currentVocable: null,
			vocablesLeft: []
		}
	},

	componentWillMount: function() {
		this.next();
	},

	next: function() {
		var vocablesLeft;

		if(this.state.vocablesLeft.length == 0) {
			vocablesLeft = this.props.vocables.slice(); // start again with initial vocables
		} else {
			vocablesLeft = this.state.vocablesLeft.slice();
		}

		if(vocablesLeft.length > 0) {

			var i = Math.floor(Math.random() * vocablesLeft.length);

			var nextVocable = vocablesLeft.splice(i, 1);

			this.setState({
				vocablesLeft: vocablesLeft,
				currentVocable: nextVocable[0],
			});

		} else {
			this.setState({
				currentVocable: null,
			});
		}
	},

	render: function() {


		var vocable = this.state.currentVocable ?
						React.createElement(Vocable, {kana: this.state.currentVocable.kana, 
								transcription: this.state.currentVocable.transcription, 
								translation: this.state.currentVocable.translation})
						: null;

		return (
			React.createElement("div", null, 
				React.createElement("button", {onClick: this.next, type: "button", className: "btn btn-primary"}, "Next"), 
				React.createElement("div", null, 
					vocable
				)
			)
		)
	}
});

module.exports = Dictionary;

},{"./Vocable":6}],4:[function(require,module,exports){
'use strict';

var Dictionary = require("./Dictionary");
var CSV = require('comma-separated-values');

var DictionaryChooser = React.createClass({displayName: "DictionaryChooser",

	getInitialState: function() {
		return {
			vocables: [],
		}
	},

	loadVocables: function() {
		$.get("dictionaries/german_hiragana.csv", function(result){
			var options = {header:true};
			var csv = new CSV(result,options).parse();

			if(Array.isArray(csv) && csv.length > 0) {
				this.setState({
					vocables: csv
				});
			}
		}.bind(this));
	},

	render: function() {
		if(this.state.vocables.length > 0) {
			return (
				React.createElement("div", null, 
					React.createElement(Dictionary, {vocables: this.state.vocables})
				)
			)
		} else {
			return (
				React.createElement("div", null, 
					React.createElement("button", {onClick: this.loadVocables, type: "button", className: "btn btn-default"}, "Load Vocables")
				)
			)
		}
	}
});

module.exports = DictionaryChooser;

},{"./Dictionary":3,"comma-separated-values":1}],5:[function(require,module,exports){
'use strict';

var DictionaryChooser = require("./DictionaryChooser");

var NihongoApp = React.createClass({displayName: "NihongoApp",

	render: function() {
			return (
				React.createElement("div", null, 
					React.createElement("h1", null, "nihongo"), 
					React.createElement(DictionaryChooser, null)
				)
			)
	}
});

module.exports = NihongoApp;

},{"./DictionaryChooser":4}],6:[function(require,module,exports){
'use strict';

var Vocable = React.createClass({displayName: "Vocable",
	getInitialState: function() {
		return {
			current : "transcription"
		}
	},
	getText: function() {
		return this.props[this.state.current];
	},
	switchVocable: function() {
		switch(this.state.current) {
			case "transcription":
				this.setState({current: "kana"});
				break;
			case "kana":
				this.setState({current: "translation"});
				break;
			case "translation":
				this.setState({current: "transcription"});
				break;
		}
	},

	render: function() {
		var style = {
			fontSize: '2em',
			fontWeight: 'bold'
		};

		return(
			React.createElement("div", {className: "panel panel-default col-md-6"}, 
				React.createElement("div", {className: "panel-body"}, 
					React.createElement("span", null, this.state.current, ":"), 
					React.createElement("br", null), 
					React.createElement("span", {id: "text", style: style}, this.getText()), 
					React.createElement("button", {onClick: this.switchVocable, type: "button", className: "btn btn-primary pull-right"}, "Switch")
				)
			)
		)
	}
});

module.exports = Vocable;

},{}]},{},[2])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvY29tbWEtc2VwYXJhdGVkLXZhbHVlcy9jc3YuanMiLCIvaG9tZS9tYW51ZWwvcHJvamVrdGUvbmlob25nby9zcmMvanMvYXBwLmpzIiwiL2hvbWUvbWFudWVsL3Byb2pla3RlL25paG9uZ28vc3JjL2pzL2NvbXBvbmVudHMvRGljdGlvbmFyeS5qcyIsIi9ob21lL21hbnVlbC9wcm9qZWt0ZS9uaWhvbmdvL3NyYy9qcy9jb21wb25lbnRzL0RpY3Rpb25hcnlDaG9vc2VyLmpzIiwiL2hvbWUvbWFudWVsL3Byb2pla3RlL25paG9uZ28vc3JjL2pzL2NvbXBvbmVudHMvTmlob25nb0FwcC5qcyIsIi9ob21lL21hbnVlbC9wcm9qZWt0ZS9uaWhvbmdvL3NyYy9qcy9jb21wb25lbnRzL1ZvY2FibGUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNWFBLFlBQVksQ0FBQzs7QUFFYixJQUFJLFVBQVUsR0FBRyxPQUFPLENBQUMseUJBQXlCLENBQUMsQ0FBQzs7QUFFcEQsS0FBSyxDQUFDLE1BQU07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Q0FBQyIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIoZnVuY3Rpb24oKSB7XG4gICd1c2Ugc3RyaWN0JztcblxuICB2YXIgRVNDQVBFX0RFTElNSVRFUlMgPSBbJ3wnLCAnXiddLFxuICAgICAgQ0VMTF9ERUxJTUlURVJTID0gWycsJywgJzsnLCAnXFx0JywgJ3wnLCAnXiddLFxuICAgICAgTElORV9ERUxJTUlURVJTID0gWydcXHJcXG4nLCAnXFxyJywgJ1xcbiddO1xuXG4gIGZ1bmN0aW9uIGlzT2JqZWN0KG9iamVjdCkge1xuICAgIHZhciB0eXBlID0gdHlwZW9mIG9iamVjdDtcbiAgICByZXR1cm4gdHlwZSA9PT0gJ2Z1bmN0aW9uJyB8fCB0eXBlID09PSAnb2JqZWN0JyAmJiAhIW9iamVjdDtcbiAgfVxuICB2YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwob2JqZWN0KSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbiAgfVxuICBmdW5jdGlvbiBpc1N0cmluZyhvYmplY3QpIHtcbiAgICByZXR1cm4gdHlwZW9mIG9iamVjdCA9PT0gJ3N0cmluZyc7XG4gIH1cbiAgZnVuY3Rpb24gaXNOdW1iZXIob2JqZWN0KSB7XG4gICAgcmV0dXJuICFpc05hTihOdW1iZXIob2JqZWN0KSk7XG4gIH1cbiAgZnVuY3Rpb24gaXNCb29sZWFuKHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlID09IGZhbHNlIHx8IHZhbHVlID09IHRydWU7XG4gIH1cbiAgZnVuY3Rpb24gaXNOdWxsKHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlID09IG51bGw7XG4gIH1cbiAgZnVuY3Rpb24gaXNQcmVzZW50KHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlICE9IG51bGw7XG4gIH1cblxuICBmdW5jdGlvbiBmYWxsYmFjayh2YWx1ZSwgZmFsbGJhY2spIHtcbiAgICByZXR1cm4gaXNQcmVzZW50KHZhbHVlKSA/IHZhbHVlIDogZmFsbGJhY2s7XG4gIH1cblxuICBmdW5jdGlvbiBmb3JFYWNoKGNvbGxlY3Rpb24sIGl0ZXJhdG9yKSB7XG4gICAgZm9yICh2YXIgX2kgPSAwLCBfbGVuID0gY29sbGVjdGlvbi5sZW5ndGg7IF9pIDwgX2xlbjsgX2kgKz0gMSkge1xuICAgICAgaWYgKGl0ZXJhdG9yKGNvbGxlY3Rpb25bX2ldLCBfaSkgPT09IGZhbHNlKSBicmVhaztcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBzYW5pdGl6ZVN0cmluZyhzdHJpbmcpIHtcbiAgICByZXR1cm4gc3RyaW5nLnJlcGxhY2UoL1wiL2csJ1xcXFxcIicpO1xuICB9XG5cbiAgZnVuY3Rpb24gYnVpbGRDZWxsKGluZGV4KSB7XG4gICAgcmV0dXJuICdhdHRyc1snICsgaW5kZXggKyAnXSc7XG4gIH1cblxuICBmdW5jdGlvbiBjYXN0Q2VsbCh2YWx1ZSwgaW5kZXgpIHtcbiAgICBpZiAoaXNOdW1iZXIodmFsdWUpKSB7XG4gICAgICByZXR1cm4gJ051bWJlcignICsgYnVpbGRDZWxsKGluZGV4KSArICcpJztcbiAgICB9IGVsc2UgaWYgKGlzQm9vbGVhbih2YWx1ZSkpIHtcbiAgICAgIHJldHVybiAnQm9vbGVhbignICsgYnVpbGRDZWxsKGluZGV4KSArICcgPT0gdHJ1ZSknO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gJ1N0cmluZygnICsgYnVpbGRDZWxsKGluZGV4KSArICcpJztcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBidWlsZENvbnN0cnVjdG9yKGNhc3QsIHZhbHVlcywgYXR0cnMpIHtcbiAgICB2YXIgZGVmaW5pdGlvbiA9IFtdO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09IDIpIHtcbiAgICAgIGlmIChjYXN0KSB7XG4gICAgICAgIGlmIChpc0FycmF5KGNhc3QpKSB7XG4gICAgICAgICAgZm9yRWFjaCh2YWx1ZXMsIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCkge1xuICAgICAgICAgICAgZGVmaW5pdGlvbi5wdXNoKGNhc3RbaW5kZXhdICsgJygnICsgYnVpbGRDZWxsKGluZGV4KSArICcpJyk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZm9yRWFjaCh2YWx1ZXMsIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCkge1xuICAgICAgICAgICAgZGVmaW5pdGlvbi5wdXNoKGNhc3RDZWxsKHZhbHVlLCBpbmRleCkpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3JFYWNoKHZhbHVlcywgZnVuY3Rpb24odmFsdWUsIGluZGV4KSB7XG4gICAgICAgICAgZGVmaW5pdGlvbi5wdXNoKGJ1aWxkQ2VsbChpbmRleCkpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGRlZmluaXRpb24gPSAncmV0dXJuIFsnICsgZGVmaW5pdGlvbi5qb2luKCcsJykgKyAnXSc7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChjYXN0KSB7XG4gICAgICAgIGlmIChpc0FycmF5KGNhc3QpKSB7XG4gICAgICAgICAgZm9yRWFjaCh2YWx1ZXMsIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCkge1xuICAgICAgICAgICAgZGVmaW5pdGlvbi5wdXNoKCdcIicgKyBzYW5pdGl6ZVN0cmluZyhhdHRyc1tpbmRleF0pICsgJ1wiOiAnICsgY2FzdFtpbmRleF0gKyAnKCcgKyBidWlsZENlbGwoaW5kZXgpICsgJyknKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBmb3JFYWNoKHZhbHVlcywgZnVuY3Rpb24odmFsdWUsIGluZGV4KSB7XG4gICAgICAgICAgICBkZWZpbml0aW9uLnB1c2goJ1wiJyArIHNhbml0aXplU3RyaW5nKGF0dHJzW2luZGV4XSkgKyAnXCI6ICcgKyBjYXN0Q2VsbCh2YWx1ZSwgaW5kZXgpKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm9yRWFjaCh2YWx1ZXMsIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCkge1xuICAgICAgICAgIGRlZmluaXRpb24ucHVzaCgnXCInICsgc2FuaXRpemVTdHJpbmcoYXR0cnNbaW5kZXhdKSArICdcIjogJyArIGJ1aWxkQ2VsbChpbmRleCkpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGRlZmluaXRpb24gPSAncmV0dXJuIHsnICsgZGVmaW5pdGlvbi5qb2luKCcsJykgKyAnfSc7XG4gICAgfVxuICAgIHJldHVybiBuZXcgRnVuY3Rpb24oJ2F0dHJzJywgZGVmaW5pdGlvbik7XG4gIH1cblxuICBmdW5jdGlvbiBkZXRlY3REZWxpbWl0ZXIoc3RyaW5nLCBkZWxpbWl0ZXJzKSB7XG4gICAgdmFyIGNvdW50ID0gMCxcbiAgICAgICAgZGV0ZWN0ZWQ7XG5cbiAgICBmb3JFYWNoKGRlbGltaXRlcnMsIGZ1bmN0aW9uKGRlbGltaXRlcikge1xuICAgICAgdmFyIG5lZWRsZSA9IGRlbGltaXRlcixcbiAgICAgICAgICBtYXRjaGVzO1xuICAgICAgaWYgKEVTQ0FQRV9ERUxJTUlURVJTLmluZGV4T2YoZGVsaW1pdGVyKSAhPSAtMSkge1xuICAgICAgICBuZWVkbGUgPSAnXFxcXCcgKyBuZWVkbGU7XG4gICAgICB9XG4gICAgICBtYXRjaGVzID0gc3RyaW5nLm1hdGNoKG5ldyBSZWdFeHAobmVlZGxlLCAnZycpKTtcbiAgICAgIGlmIChtYXRjaGVzICYmIG1hdGNoZXMubGVuZ3RoID4gY291bnQpIHtcbiAgICAgICAgY291bnQgPSBtYXRjaGVzLmxlbmd0aDtcbiAgICAgICAgZGV0ZWN0ZWQgPSBkZWxpbWl0ZXI7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIChkZXRlY3RlZCB8fCBkZWxpbWl0ZXJzWzBdKTtcbiAgfVxuXG4gIHZhciBDU1YgPSAoZnVuY3Rpb24oKSB7XG4gICAgZnVuY3Rpb24gQ1NWKGRhdGEsIG9wdGlvbnMpIHtcbiAgICAgIGlmICghb3B0aW9ucykgb3B0aW9ucyA9IHt9O1xuXG4gICAgICBpZiAoaXNBcnJheShkYXRhKSkge1xuICAgICAgICB0aGlzLm1vZGUgPSAnZW5jb2RlJztcbiAgICAgIH0gZWxzZSBpZiAoaXNTdHJpbmcoZGF0YSkpIHtcbiAgICAgICAgdGhpcy5tb2RlID0gJ3BhcnNlJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkluY29tcGF0aWJsZSBmb3JtYXQhXCIpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmRhdGEgPSBkYXRhO1xuXG4gICAgICB0aGlzLm9wdGlvbnMgPSB7XG4gICAgICAgIGhlYWRlcjogZmFsbGJhY2sob3B0aW9ucy5oZWFkZXIsIGZhbHNlKSxcbiAgICAgICAgY2FzdDogZmFsbGJhY2sob3B0aW9ucy5jYXN0LCB0cnVlKVxuICAgICAgfVxuXG4gICAgICB2YXIgbGluZURlbGltaXRlciA9IG9wdGlvbnMubGluZURlbGltaXRlciB8fCBvcHRpb25zLmxpbmUsXG4gICAgICAgICAgY2VsbERlbGltaXRlciA9IG9wdGlvbnMuY2VsbERlbGltaXRlciB8fCBvcHRpb25zLmRlbGltaXRlcjtcblxuICAgICAgaWYgKHRoaXMuaXNQYXJzZXIoKSkge1xuICAgICAgICB0aGlzLm9wdGlvbnMubGluZURlbGltaXRlciA9IGxpbmVEZWxpbWl0ZXIgfHwgZGV0ZWN0RGVsaW1pdGVyKHRoaXMuZGF0YSwgTElORV9ERUxJTUlURVJTKTtcbiAgICAgICAgdGhpcy5vcHRpb25zLmNlbGxEZWxpbWl0ZXIgPSBjZWxsRGVsaW1pdGVyIHx8IGRldGVjdERlbGltaXRlcih0aGlzLmRhdGEsIENFTExfREVMSU1JVEVSUyk7XG4gICAgICAgIHRoaXMuZGF0YSA9IG5vcm1hbGl6ZUNTVih0aGlzLmRhdGEsIHRoaXMub3B0aW9ucy5saW5lRGVsaW1pdGVyKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5pc0VuY29kZXIoKSkge1xuICAgICAgICB0aGlzLm9wdGlvbnMubGluZURlbGltaXRlciA9IGxpbmVEZWxpbWl0ZXIgfHwgJ1xcclxcbic7XG4gICAgICAgIHRoaXMub3B0aW9ucy5jZWxsRGVsaW1pdGVyID0gY2VsbERlbGltaXRlciB8fCAnLCc7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaW52b2tlKG1ldGhvZCwgY29uc3RydWN0b3IsIGF0dHJpYnV0ZXMpIHtcbiAgICAgIG1ldGhvZChuZXcgY29uc3RydWN0b3IoYXR0cmlidXRlcykpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG5vcm1hbGl6ZUNTVih0ZXh0LCBsaW5lRGVsaW1pdGVyKSB7XG4gICAgICBpZiAodGV4dC5zbGljZSgtbGluZURlbGltaXRlci5sZW5ndGgpICE9IGxpbmVEZWxpbWl0ZXIpIHRleHQgKz0gbGluZURlbGltaXRlcjtcbiAgICAgIHJldHVybiB0ZXh0O1xuICAgIH1cblxuICAgIENTVi5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24oc2V0dGluZywgdmFsdWUpIHtcbiAgICAgIHJldHVybiB0aGlzLm9wdGlvbnNbc2V0dGluZ10gPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBDU1YucHJvdG90eXBlLmlzUGFyc2VyID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5tb2RlID09ICdwYXJzZSc7XG4gICAgfVxuXG4gICAgQ1NWLnByb3RvdHlwZS5pc0VuY29kZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLm1vZGUgPT0gJ2VuY29kZSc7XG4gICAgfVxuXG4gICAgQ1NWLnByb3RvdHlwZS5wYXJzZSA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICBpZiAodGhpcy5tb2RlICE9ICdwYXJzZScpIHJldHVybjtcblxuICAgICAgaWYgKHRoaXMuZGF0YS50cmltKCkubGVuZ3RoID09PSAwKSByZXR1cm4gW107XG5cbiAgICAgIHZhciBkYXRhID0gdGhpcy5kYXRhLFxuICAgICAgICAgIG9wdGlvbnMgPSB0aGlzLm9wdGlvbnMsXG4gICAgICAgICAgaGVhZGVyID0gb3B0aW9ucy5oZWFkZXIsXG4gICAgICAgICAgY3VycmVudCA9IHsgY2VsbDogJycsIGxpbmU6IFtdIH0sXG4gICAgICAgICAgZmxhZywgcmVjb3JkLCByZXNwb25zZTtcblxuICAgICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgICByZXNwb25zZSA9IFtdO1xuICAgICAgICBjYWxsYmFjayA9IGZ1bmN0aW9uKHJlY29yZCkge1xuICAgICAgICAgIHJlc3BvbnNlLnB1c2gocmVjb3JkKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiByZXNldEZsYWdzKCkge1xuICAgICAgICBmbGFnID0geyBlc2NhcGVkOiBmYWxzZSwgcXVvdGU6IGZhbHNlLCBjZWxsOiB0cnVlIH07XG4gICAgICB9XG4gICAgICBmdW5jdGlvbiByZXNldENlbGwoKSB7XG4gICAgICAgIGN1cnJlbnQuY2VsbCA9ICcnO1xuICAgICAgfVxuICAgICAgZnVuY3Rpb24gcmVzZXRMaW5lKCkge1xuICAgICAgICBjdXJyZW50LmxpbmUgPSBbXTtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gc2F2ZUNlbGwoY2VsbCkge1xuICAgICAgICBjdXJyZW50LmxpbmUucHVzaChmbGFnLmVzY2FwZWQgPyBjZWxsLnNsaWNlKDEsIC0xKS5yZXBsYWNlKC9cIlwiL2csICdcIicpIDogY2VsbCk7XG4gICAgICAgIHJlc2V0Q2VsbCgpO1xuICAgICAgICByZXNldEZsYWdzKCk7XG4gICAgICB9XG4gICAgICBmdW5jdGlvbiBzYXZlTGFzdENlbGwoY2VsbCkge1xuICAgICAgICBzYXZlQ2VsbChjZWxsLnNsaWNlKDAsIDEgLSBvcHRpb25zLmxpbmVEZWxpbWl0ZXIubGVuZ3RoKSk7XG4gICAgICB9XG4gICAgICBmdW5jdGlvbiBzYXZlTGluZSgpIHtcbiAgICAgICAgaWYgKGhlYWRlcikge1xuICAgICAgICAgIGlmIChpc0FycmF5KGhlYWRlcikpIHtcbiAgICAgICAgICAgIHJlY29yZCA9IGJ1aWxkQ29uc3RydWN0b3Iob3B0aW9ucy5jYXN0LCBjdXJyZW50LmxpbmUsIGhlYWRlcik7XG4gICAgICAgICAgICBzYXZlTGluZSA9IGZ1bmN0aW9uKCkgeyBpbnZva2UoY2FsbGJhY2ssIHJlY29yZCwgY3VycmVudC5saW5lKTsgfTtcbiAgICAgICAgICAgIHNhdmVMaW5lKCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGhlYWRlciA9IGN1cnJlbnQubGluZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKCFyZWNvcmQpIHtcbiAgICAgICAgICAgIHJlY29yZCA9IGJ1aWxkQ29uc3RydWN0b3Iob3B0aW9ucy5jYXN0LCBjdXJyZW50LmxpbmUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzYXZlTGluZSA9IGZ1bmN0aW9uKCkgeyBpbnZva2UoY2FsbGJhY2ssIHJlY29yZCwgY3VycmVudC5saW5lKTsgfTtcbiAgICAgICAgICBzYXZlTGluZSgpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChvcHRpb25zLmxpbmVEZWxpbWl0ZXIubGVuZ3RoID09IDEpIHNhdmVMYXN0Q2VsbCA9IHNhdmVDZWxsO1xuXG4gICAgICB2YXIgZGF0YUxlbmd0aCA9IGRhdGEubGVuZ3RoLFxuICAgICAgICAgIGNlbGxEZWxpbWl0ZXIgPSBvcHRpb25zLmNlbGxEZWxpbWl0ZXIuY2hhckNvZGVBdCgwKSxcbiAgICAgICAgICBsaW5lRGVsaW1pdGVyID0gb3B0aW9ucy5saW5lRGVsaW1pdGVyLmNoYXJDb2RlQXQob3B0aW9ucy5saW5lRGVsaW1pdGVyLmxlbmd0aCAtIDEpLFxuICAgICAgICAgIF9pLCBfYywgX2NoO1xuXG4gICAgICByZXNldEZsYWdzKCk7XG5cbiAgICAgIGZvciAoX2kgPSAwLCBfYyA9IDA7IF9pIDwgZGF0YUxlbmd0aDsgX2krKykge1xuICAgICAgICBfY2ggPSBkYXRhLmNoYXJDb2RlQXQoX2kpO1xuXG4gICAgICAgIGlmIChmbGFnLmNlbGwpIHtcbiAgICAgICAgICBmbGFnLmNlbGwgPSBmYWxzZTtcbiAgICAgICAgICBpZiAoX2NoID09IDM0KSB7XG4gICAgICAgICAgICBmbGFnLmVzY2FwZWQgPSB0cnVlO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGZsYWcuZXNjYXBlZCAmJiBfY2ggPT0gMzQpIHtcbiAgICAgICAgICBmbGFnLnF1b3RlID0gIWZsYWcucXVvdGU7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoKGZsYWcuZXNjYXBlZCAmJiBmbGFnLnF1b3RlKSB8fCAhZmxhZy5lc2NhcGVkKSB7XG4gICAgICAgICAgaWYgKF9jaCA9PSBjZWxsRGVsaW1pdGVyKSB7XG4gICAgICAgICAgICBzYXZlQ2VsbChjdXJyZW50LmNlbGwgKyBkYXRhLnNsaWNlKF9jLCBfaSkpO1xuICAgICAgICAgICAgX2MgPSBfaSArIDE7XG4gICAgICAgICAgfSBlbHNlIGlmIChfY2ggPT0gbGluZURlbGltaXRlcikge1xuICAgICAgICAgICAgc2F2ZUxhc3RDZWxsKGN1cnJlbnQuY2VsbCArIGRhdGEuc2xpY2UoX2MsIF9pKSk7XG4gICAgICAgICAgICBfYyA9IF9pICsgMTtcbiAgICAgICAgICAgIHNhdmVMaW5lKCk7XG4gICAgICAgICAgICByZXNldExpbmUoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHJlc3BvbnNlKSB7XG4gICAgICAgIHJldHVybiByZXNwb25zZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNlcmlhbGl6ZVR5cGUob2JqZWN0KSB7XG4gICAgICBpZiAoaXNBcnJheShvYmplY3QpKSB7XG4gICAgICAgIHJldHVybiAnYXJyYXknO1xuICAgICAgfSBlbHNlIGlmIChpc09iamVjdChvYmplY3QpKSB7XG4gICAgICAgIHJldHVybiAnb2JqZWN0JztcbiAgICAgIH0gZWxzZSBpZiAoaXNTdHJpbmcob2JqZWN0KSkge1xuICAgICAgICByZXR1cm4gJ3N0cmluZyc7XG4gICAgICB9IGVsc2UgaWYgKGlzTnVsbChvYmplY3QpKSB7XG4gICAgICAgIHJldHVybiAnbnVsbCc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gJ3ByaW1pdGl2ZSc7XG4gICAgICB9XG4gICAgfVxuXG4gICAgQ1NWLnByb3RvdHlwZS5zZXJpYWxpemUgPSB7XG4gICAgICBcIm9iamVjdFwiOiBmdW5jdGlvbihvYmplY3QpIHtcbiAgICAgICAgdmFyIHRoYXQgPSB0aGlzLFxuICAgICAgICAgICAgYXR0cmlidXRlcyA9IE9iamVjdC5rZXlzKG9iamVjdCksXG4gICAgICAgICAgICBzZXJpYWxpemVkID0gQXJyYXkoYXR0cmlidXRlcy5sZW5ndGgpO1xuICAgICAgICBmb3JFYWNoKGF0dHJpYnV0ZXMsIGZ1bmN0aW9uKGF0dHIsIGluZGV4KSB7XG4gICAgICAgICAgc2VyaWFsaXplZFtpbmRleF0gPSB0aGF0W3NlcmlhbGl6ZVR5cGUob2JqZWN0W2F0dHJdKV0ob2JqZWN0W2F0dHJdKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBzZXJpYWxpemVkO1xuICAgICAgfSxcbiAgICAgIFwiYXJyYXlcIjogZnVuY3Rpb24oYXJyYXkpIHtcbiAgICAgICAgdmFyIHRoYXQgPSB0aGlzLFxuICAgICAgICAgICAgc2VyaWFsaXplZCA9IEFycmF5KGFycmF5Lmxlbmd0aCk7XG4gICAgICAgIGZvckVhY2goYXJyYXksIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCkge1xuICAgICAgICAgIHNlcmlhbGl6ZWRbaW5kZXhdID0gdGhhdFtzZXJpYWxpemVUeXBlKHZhbHVlKV0odmFsdWUpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHNlcmlhbGl6ZWQ7XG4gICAgICB9LFxuICAgICAgXCJzdHJpbmdcIjogZnVuY3Rpb24oc3RyaW5nKSB7XG4gICAgICAgIHJldHVybiAnXCInICsgU3RyaW5nKHN0cmluZykucmVwbGFjZSgvXCIvZywgJ1wiXCInKSArICdcIic7XG4gICAgICB9LFxuICAgICAgXCJudWxsXCI6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiAnJztcbiAgICAgIH0sXG4gICAgICBcInByaW1pdGl2ZVwiOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgQ1NWLnByb3RvdHlwZS5lbmNvZGUgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgaWYgKHRoaXMubW9kZSAhPSAnZW5jb2RlJykgcmV0dXJuO1xuXG4gICAgICBpZiAodGhpcy5kYXRhLmxlbmd0aCA9PSAwKSByZXR1cm4gJyc7XG5cbiAgICAgIHZhciBkYXRhID0gdGhpcy5kYXRhLFxuICAgICAgICAgIG9wdGlvbnMgPSB0aGlzLm9wdGlvbnMsXG4gICAgICAgICAgaGVhZGVyID0gb3B0aW9ucy5oZWFkZXIsXG4gICAgICAgICAgc2FtcGxlID0gZGF0YVswXSxcbiAgICAgICAgICBzZXJpYWxpemUgPSB0aGlzLnNlcmlhbGl6ZSxcbiAgICAgICAgICBvZmZzZXQgPSAwLFxuICAgICAgICAgIGF0dHJpYnV0ZXMsIHJlc3BvbnNlO1xuXG4gICAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICAgIHJlc3BvbnNlID0gQXJyYXkoZGF0YS5sZW5ndGgpO1xuICAgICAgICBjYWxsYmFjayA9IGZ1bmN0aW9uKHJlY29yZCwgaW5kZXgpIHtcbiAgICAgICAgICByZXNwb25zZVtpbmRleCArIG9mZnNldF0gPSByZWNvcmQ7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gc2VyaWFsaXplTGluZShyZWNvcmQpIHtcbiAgICAgICAgcmV0dXJuIHJlY29yZC5qb2luKG9wdGlvbnMuY2VsbERlbGltaXRlcik7XG4gICAgICB9XG5cbiAgICAgIGlmIChoZWFkZXIpIHtcbiAgICAgICAgaWYgKCFpc0FycmF5KGhlYWRlcikpIHtcbiAgICAgICAgICBhdHRyaWJ1dGVzID0gT2JqZWN0LmtleXMoc2FtcGxlKTtcbiAgICAgICAgICBoZWFkZXIgPSBhdHRyaWJ1dGVzO1xuICAgICAgICB9XG4gICAgICAgIGNhbGxiYWNrKHNlcmlhbGl6ZUxpbmUoc2VyaWFsaXplLmFycmF5KGhlYWRlcikpLCAwKTtcbiAgICAgICAgb2Zmc2V0ID0gMTtcbiAgICAgIH1cblxuICAgICAgdmFyIHJlY29yZFR5cGUgPSBzZXJpYWxpemVUeXBlKHNhbXBsZSksXG4gICAgICAgICAgbWFwO1xuXG4gICAgICBpZiAocmVjb3JkVHlwZSA9PSAnYXJyYXknKSB7XG4gICAgICAgIGlmIChpc0FycmF5KG9wdGlvbnMuY2FzdCkpIHtcbiAgICAgICAgICBtYXAgPSBBcnJheShvcHRpb25zLmNhc3QubGVuZ3RoKTtcbiAgICAgICAgICBmb3JFYWNoKG9wdGlvbnMuY2FzdCwgZnVuY3Rpb24odHlwZSwgaW5kZXgpIHtcbiAgICAgICAgICAgIG1hcFtpbmRleF0gPSB0eXBlLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbWFwID0gQXJyYXkoc2FtcGxlLmxlbmd0aCk7XG4gICAgICAgICAgZm9yRWFjaChzYW1wbGUsIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCkge1xuICAgICAgICAgICAgbWFwW2luZGV4XSA9IHNlcmlhbGl6ZVR5cGUodmFsdWUpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGZvckVhY2goZGF0YSwgZnVuY3Rpb24ocmVjb3JkLCByZWNvcmRJbmRleCkge1xuICAgICAgICAgIHZhciBzZXJpYWxpemVkUmVjb3JkID0gQXJyYXkobWFwLmxlbmd0aCk7XG4gICAgICAgICAgZm9yRWFjaChyZWNvcmQsIGZ1bmN0aW9uKHZhbHVlLCB2YWx1ZUluZGV4KSB7XG4gICAgICAgICAgICBzZXJpYWxpemVkUmVjb3JkW3ZhbHVlSW5kZXhdID0gc2VyaWFsaXplW21hcFt2YWx1ZUluZGV4XV0odmFsdWUpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGNhbGxiYWNrKHNlcmlhbGl6ZUxpbmUoc2VyaWFsaXplZFJlY29yZCksIHJlY29yZEluZGV4KTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKHJlY29yZFR5cGUgPT0gJ29iamVjdCcpIHtcbiAgICAgICAgYXR0cmlidXRlcyA9IE9iamVjdC5rZXlzKHNhbXBsZSk7XG4gICAgICAgIGlmIChpc0FycmF5KG9wdGlvbnMuY2FzdCkpIHtcbiAgICAgICAgICBtYXAgPSBBcnJheShvcHRpb25zLmNhc3QubGVuZ3RoKTtcbiAgICAgICAgICBmb3JFYWNoKG9wdGlvbnMuY2FzdCwgZnVuY3Rpb24odHlwZSwgaW5kZXgpIHtcbiAgICAgICAgICAgIG1hcFtpbmRleF0gPSB0eXBlLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbWFwID0gQXJyYXkoYXR0cmlidXRlcy5sZW5ndGgpO1xuICAgICAgICAgIGZvckVhY2goYXR0cmlidXRlcywgZnVuY3Rpb24oYXR0ciwgaW5kZXgpIHtcbiAgICAgICAgICAgIG1hcFtpbmRleF0gPSBzZXJpYWxpemVUeXBlKHNhbXBsZVthdHRyXSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yRWFjaChkYXRhLCBmdW5jdGlvbihyZWNvcmQsIHJlY29yZEluZGV4KSB7XG4gICAgICAgICAgdmFyIHNlcmlhbGl6ZWRSZWNvcmQgPSBBcnJheShhdHRyaWJ1dGVzLmxlbmd0aCk7XG4gICAgICAgICAgZm9yRWFjaChhdHRyaWJ1dGVzLCBmdW5jdGlvbihhdHRyLCBhdHRySW5kZXgpIHtcbiAgICAgICAgICAgIHNlcmlhbGl6ZWRSZWNvcmRbYXR0ckluZGV4XSA9IHNlcmlhbGl6ZVttYXBbYXR0ckluZGV4XV0ocmVjb3JkW2F0dHJdKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBjYWxsYmFjayhzZXJpYWxpemVMaW5lKHNlcmlhbGl6ZWRSZWNvcmQpLCByZWNvcmRJbmRleCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBpZiAocmVzcG9uc2UpIHtcbiAgICAgICAgcmV0dXJuIHJlc3BvbnNlLmpvaW4ob3B0aW9ucy5saW5lRGVsaW1pdGVyKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfVxuICAgIH1cblxuICAgIENTVi5wcm90b3R5cGUuZm9yRWFjaCA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICByZXR1cm4gdGhpc1t0aGlzLm1vZGVdKGNhbGxiYWNrKTtcbiAgICB9XG5cbiAgICByZXR1cm4gQ1NWO1xuICB9KSgpO1xuXG4gIENTVi5wYXJzZSA9IGZ1bmN0aW9uKGRhdGEsIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gbmV3IENTVihkYXRhLCBvcHRpb25zKS5wYXJzZSgpO1xuICB9XG5cbiAgQ1NWLmVuY29kZSA9IGZ1bmN0aW9uKGRhdGEsIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gbmV3IENTVihkYXRhLCBvcHRpb25zKS5lbmNvZGUoKTtcbiAgfVxuXG4gIENTVi5mb3JFYWNoID0gZnVuY3Rpb24oZGF0YSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PSAyKSB7XG4gICAgICBjYWxsYmFjayA9IG9wdGlvbnM7XG4gICAgfVxuICAgIHJldHVybiBuZXcgQ1NWKGRhdGEsIG9wdGlvbnMpLmZvckVhY2goY2FsbGJhY2spO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiBkZWZpbmUuYW1kKSB7XG4gICAgZGVmaW5lKCdDU1YnLCBbXSwgZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gQ1NWO1xuICAgIH0pO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBtb2R1bGUgPT09IFwib2JqZWN0XCIgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IENTVjtcbiAgfSBlbHNlIGlmICh3aW5kb3cpIHtcbiAgICB3aW5kb3cuQ1NWID0gQ1NWO1xuICB9XG59KSgpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgTmlob25nb0FwcCA9IHJlcXVpcmUoXCIuL2NvbXBvbmVudHMvTmlob25nb0FwcFwiKTtcblxuUmVhY3QucmVuZGVyKFxuXHQ8Tmlob25nb0FwcCAvPixcblx0ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJhcHBcIilcbik7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBWb2NhYmxlID0gcmVxdWlyZShcIi4vVm9jYWJsZVwiKTtcblxudmFyIERpY3Rpb25hcnkgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG5cblx0cHJvcFR5cGVzOiB7XG5cdFx0dm9jYWJsZXM6IFJlYWN0LlByb3BUeXBlcy5hcnJheU9mKFJlYWN0LlByb3BUeXBlcy5zaGFwZSh7XG5cdFx0XHRrYW5hOiBSZWFjdC5Qcm9wVHlwZXMuc3RyaW5nLFxuXHRcdFx0dHJhbnNjcmlwdGlvbjogUmVhY3QuUHJvcFR5cGVzLnN0cmluZyxcblx0XHRcdHRyYW5zbGF0aW9uOiBSZWFjdC5Qcm9wVHlwZXMuc3RyaW5nXG5cdFx0fSkpLmlzUmVxdWlyZWRcblx0fSxcblxuXHRnZXRJbml0aWFsU3RhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiB7XG5cdFx0XHRjdXJyZW50Vm9jYWJsZTogbnVsbCxcblx0XHRcdHZvY2FibGVzTGVmdDogW11cblx0XHR9XG5cdH0sXG5cblx0Y29tcG9uZW50V2lsbE1vdW50OiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLm5leHQoKTtcblx0fSxcblxuXHRuZXh0OiBmdW5jdGlvbigpIHtcblx0XHR2YXIgdm9jYWJsZXNMZWZ0O1xuXG5cdFx0aWYodGhpcy5zdGF0ZS52b2NhYmxlc0xlZnQubGVuZ3RoID09IDApIHtcblx0XHRcdHZvY2FibGVzTGVmdCA9IHRoaXMucHJvcHMudm9jYWJsZXMuc2xpY2UoKTsgLy8gc3RhcnQgYWdhaW4gd2l0aCBpbml0aWFsIHZvY2FibGVzXG5cdFx0fSBlbHNlIHtcblx0XHRcdHZvY2FibGVzTGVmdCA9IHRoaXMuc3RhdGUudm9jYWJsZXNMZWZ0LnNsaWNlKCk7XG5cdFx0fVxuXG5cdFx0aWYodm9jYWJsZXNMZWZ0Lmxlbmd0aCA+IDApIHtcblxuXHRcdFx0dmFyIGkgPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiB2b2NhYmxlc0xlZnQubGVuZ3RoKTtcblxuXHRcdFx0dmFyIG5leHRWb2NhYmxlID0gdm9jYWJsZXNMZWZ0LnNwbGljZShpLCAxKTtcblxuXHRcdFx0dGhpcy5zZXRTdGF0ZSh7XG5cdFx0XHRcdHZvY2FibGVzTGVmdDogdm9jYWJsZXNMZWZ0LFxuXHRcdFx0XHRjdXJyZW50Vm9jYWJsZTogbmV4dFZvY2FibGVbMF0sXG5cdFx0XHR9KTtcblxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnNldFN0YXRlKHtcblx0XHRcdFx0Y3VycmVudFZvY2FibGU6IG51bGwsXG5cdFx0XHR9KTtcblx0XHR9XG5cdH0sXG5cblx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblxuXG5cdFx0dmFyIHZvY2FibGUgPSB0aGlzLnN0YXRlLmN1cnJlbnRWb2NhYmxlID9cblx0XHRcdFx0XHRcdDxWb2NhYmxlIGthbmE9e3RoaXMuc3RhdGUuY3VycmVudFZvY2FibGUua2FuYX1cblx0XHRcdFx0XHRcdFx0XHR0cmFuc2NyaXB0aW9uPXt0aGlzLnN0YXRlLmN1cnJlbnRWb2NhYmxlLnRyYW5zY3JpcHRpb259XG5cdFx0XHRcdFx0XHRcdFx0dHJhbnNsYXRpb249e3RoaXMuc3RhdGUuY3VycmVudFZvY2FibGUudHJhbnNsYXRpb259IC8+XG5cdFx0XHRcdFx0XHQ6IG51bGw7XG5cblx0XHRyZXR1cm4gKFxuXHRcdFx0PGRpdj5cblx0XHRcdFx0PGJ1dHRvbiBvbkNsaWNrPXt0aGlzLm5leHR9IHR5cGU9XCJidXR0b25cIiBjbGFzc05hbWU9XCJidG4gYnRuLXByaW1hcnlcIj5OZXh0PC9idXR0b24+XG5cdFx0XHRcdDxkaXY+XG5cdFx0XHRcdFx0e3ZvY2FibGV9XG5cdFx0XHRcdDwvZGl2PlxuXHRcdFx0PC9kaXY+XG5cdFx0KVxuXHR9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBEaWN0aW9uYXJ5O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgRGljdGlvbmFyeSA9IHJlcXVpcmUoXCIuL0RpY3Rpb25hcnlcIik7XG52YXIgQ1NWID0gcmVxdWlyZSgnY29tbWEtc2VwYXJhdGVkLXZhbHVlcycpO1xuXG52YXIgRGljdGlvbmFyeUNob29zZXIgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG5cblx0Z2V0SW5pdGlhbFN0YXRlOiBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0dm9jYWJsZXM6IFtdLFxuXHRcdH1cblx0fSxcblxuXHRsb2FkVm9jYWJsZXM6IGZ1bmN0aW9uKCkge1xuXHRcdCQuZ2V0KFwiZGljdGlvbmFyaWVzL2dlcm1hbl9oaXJhZ2FuYS5jc3ZcIiwgZnVuY3Rpb24ocmVzdWx0KXtcblx0XHRcdHZhciBvcHRpb25zID0ge2hlYWRlcjp0cnVlfTtcblx0XHRcdHZhciBjc3YgPSBuZXcgQ1NWKHJlc3VsdCxvcHRpb25zKS5wYXJzZSgpO1xuXG5cdFx0XHRpZihBcnJheS5pc0FycmF5KGNzdikgJiYgY3N2Lmxlbmd0aCA+IDApIHtcblx0XHRcdFx0dGhpcy5zZXRTdGF0ZSh7XG5cdFx0XHRcdFx0dm9jYWJsZXM6IGNzdlxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9LmJpbmQodGhpcykpO1xuXHR9LFxuXG5cdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0aWYodGhpcy5zdGF0ZS52b2NhYmxlcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRyZXR1cm4gKFxuXHRcdFx0XHQ8ZGl2PlxuXHRcdFx0XHRcdDxEaWN0aW9uYXJ5IHZvY2FibGVzPXt0aGlzLnN0YXRlLnZvY2FibGVzfSAvPlxuXHRcdFx0XHQ8L2Rpdj5cblx0XHRcdClcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIChcblx0XHRcdFx0PGRpdj5cblx0XHRcdFx0XHQ8YnV0dG9uIG9uQ2xpY2s9e3RoaXMubG9hZFZvY2FibGVzfSB0eXBlPVwiYnV0dG9uXCIgY2xhc3NOYW1lPVwiYnRuIGJ0bi1kZWZhdWx0XCI+TG9hZCBWb2NhYmxlczwvYnV0dG9uPlxuXHRcdFx0XHQ8L2Rpdj5cblx0XHRcdClcblx0XHR9XG5cdH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IERpY3Rpb25hcnlDaG9vc2VyO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgRGljdGlvbmFyeUNob29zZXIgPSByZXF1aXJlKFwiLi9EaWN0aW9uYXJ5Q2hvb3NlclwiKTtcblxudmFyIE5paG9uZ29BcHAgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG5cblx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiAoXG5cdFx0XHRcdDxkaXY+XG5cdFx0XHRcdFx0PGgxPm5paG9uZ288L2gxPlxuXHRcdFx0XHRcdDxEaWN0aW9uYXJ5Q2hvb3NlciAvPlxuXHRcdFx0XHQ8L2Rpdj5cblx0XHRcdClcblx0fVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gTmlob25nb0FwcDtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIFZvY2FibGUgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG5cdGdldEluaXRpYWxTdGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGN1cnJlbnQgOiBcInRyYW5zY3JpcHRpb25cIlxuXHRcdH1cblx0fSxcblx0Z2V0VGV4dDogZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuIHRoaXMucHJvcHNbdGhpcy5zdGF0ZS5jdXJyZW50XTtcblx0fSxcblx0c3dpdGNoVm9jYWJsZTogZnVuY3Rpb24oKSB7XG5cdFx0c3dpdGNoKHRoaXMuc3RhdGUuY3VycmVudCkge1xuXHRcdFx0Y2FzZSBcInRyYW5zY3JpcHRpb25cIjpcblx0XHRcdFx0dGhpcy5zZXRTdGF0ZSh7Y3VycmVudDogXCJrYW5hXCJ9KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFwia2FuYVwiOlxuXHRcdFx0XHR0aGlzLnNldFN0YXRlKHtjdXJyZW50OiBcInRyYW5zbGF0aW9uXCJ9KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFwidHJhbnNsYXRpb25cIjpcblx0XHRcdFx0dGhpcy5zZXRTdGF0ZSh7Y3VycmVudDogXCJ0cmFuc2NyaXB0aW9uXCJ9KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXHR9LFxuXG5cdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHN0eWxlID0ge1xuXHRcdFx0Zm9udFNpemU6ICcyZW0nLFxuXHRcdFx0Zm9udFdlaWdodDogJ2JvbGQnXG5cdFx0fTtcblxuXHRcdHJldHVybihcblx0XHRcdDxkaXYgY2xhc3NOYW1lPVwicGFuZWwgcGFuZWwtZGVmYXVsdCBjb2wtbWQtNlwiPlxuXHRcdFx0XHQ8ZGl2IGNsYXNzTmFtZT1cInBhbmVsLWJvZHlcIj5cblx0XHRcdFx0XHQ8c3Bhbj57dGhpcy5zdGF0ZS5jdXJyZW50fTo8L3NwYW4+XG5cdFx0XHRcdFx0PGJyLz5cblx0XHRcdFx0XHQ8c3BhbiBpZD1cInRleHRcIiBzdHlsZT17c3R5bGV9Pnt0aGlzLmdldFRleHQoKX08L3NwYW4+XG5cdFx0XHRcdFx0PGJ1dHRvbiBvbkNsaWNrPXt0aGlzLnN3aXRjaFZvY2FibGV9IHR5cGU9XCJidXR0b25cIiBjbGFzc05hbWU9XCJidG4gYnRuLXByaW1hcnkgcHVsbC1yaWdodFwiPlN3aXRjaDwvYnV0dG9uPlxuXHRcdFx0XHQ8L2Rpdj5cblx0XHRcdDwvZGl2PlxuXHRcdClcblx0fVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gVm9jYWJsZTtcbiJdfQ==
