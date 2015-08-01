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
		})).isRequired,

		initialRevealState: React.PropTypes.oneOf(['transcription','kana','translation'])
	},

	getDefaultProps: function() {
		return {
			initialRevealState: 'transcription'
		};
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
								translation: this.state.currentVocable.translation, 
								initialRevealState: this.props.initialRevealState})
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

},{"./Vocable":7}],4:[function(require,module,exports){
'use strict';

var Dictionary = require("./Dictionary");
var CSV = require('comma-separated-values');

var DictionaryChooser = React.createClass({displayName: "DictionaryChooser",

	propTypes: {
		initialRevealState: React.PropTypes.oneOf(['transcription','kana','translation'])
	},

	getDefaultProps: function() {
		return {
			initialRevealState: 'transcription'
		};
	},

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
					React.createElement(Dictionary, {vocables: this.state.vocables, 
					initialRevealState: this.props.initialRevealState})
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
var RevealOrderConfig = require("./RevealOrderConfig");
var NihongoApp = React.createClass({displayName: "NihongoApp",

	getInitialState: function() {
		return {
			initialRevealState: 'transcription'
		}
	},

	changeInitialRevealState: function(newState) {
		this.setState({
			initialRevealState: newState
		})
	},

	render: function() {
			return (
				React.createElement("div", null, 
					React.createElement("h1", null, "nihongo"), 

					React.createElement("div", {className: "row"}, 
						React.createElement("div", {className: "col-md-8"}, 
							React.createElement(DictionaryChooser, {initialRevealState: this.state.initialRevealState})
						), 
						React.createElement("div", {className: "col-md-4"}, 
							React.createElement(RevealOrderConfig, {onSelect: this.changeInitialRevealState})
						)
					)

				)
			)
	}
});

module.exports = NihongoApp;

},{"./DictionaryChooser":4,"./RevealOrderConfig":6}],6:[function(require,module,exports){
'use strict';

var RevealOrderConfig = React.createClass({displayName: "RevealOrderConfig",

	propTypes: {
		onSelect: React.PropTypes.func
	},

	onChange: function(event) {
		if(this.props.onSelect) {
			this.props.onSelect(event.target.value);
		}
	},

	render: function() {
		return (
			React.createElement("div", {className: "panel panel-default"}, 
			  React.createElement("div", {className: "panel-body"}, 

				React.createElement("p", null, "What should be revealed initially?"), 

				React.createElement("select", {className: "form-control", onChange: this.onChange}, 
					React.createElement("option", {value: "transcription"}, "Transcription (e.g. \"nihongo\")"), 
					React.createElement("option", {value: "kana"}, "Kana (e.g. \"にほんご\")"), 
					React.createElement("option", {value: "translation"}, "Translation (e.g. \"Japanese\")")
				)
			  )
			)
		)
	}
});

module.exports = RevealOrderConfig;

},{}],7:[function(require,module,exports){
'use strict';

var Vocable = React.createClass({displayName: "Vocable",
	getInitialState: function() {
		return {
			current : this.props.initialRevealState
		}
	},

	propTypes: {
		transcription: React.PropTypes.string.isRequired,
		kana: React.PropTypes.string.isRequired,
		translation: React.PropTypes.string.isRequired,

		initialRevealState: React.PropTypes.oneOf(['transcription','kana','translation'])
	},

	getDefaultProps: function() {
		return {
			initialRevealState: 'transcription'
		};
	},

	componentWillReceiveProps: function(nextProps) {
		this.setState({
			current: nextProps.initialRevealState
		})
	},


	getText: function() {
		return this.props[this.state.current];
	},
	revealVocable: function() {
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
					React.createElement("button", {onClick: this.revealVocable, type: "button", className: "btn btn-primary pull-right"}, "Reveal")
				)
			)
		)
	}
});

module.exports = Vocable;

},{}]},{},[2])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvY29tbWEtc2VwYXJhdGVkLXZhbHVlcy9jc3YuanMiLCIvaG9tZS9tYW51ZWwvcHJvamVrdGUvbmlob25nby93b3Jrc3BhY2Uvc3JjL2pzL2FwcC5qcyIsIi9ob21lL21hbnVlbC9wcm9qZWt0ZS9uaWhvbmdvL3dvcmtzcGFjZS9zcmMvanMvY29tcG9uZW50cy9EaWN0aW9uYXJ5LmpzIiwiL2hvbWUvbWFudWVsL3Byb2pla3RlL25paG9uZ28vd29ya3NwYWNlL3NyYy9qcy9jb21wb25lbnRzL0RpY3Rpb25hcnlDaG9vc2VyLmpzIiwiL2hvbWUvbWFudWVsL3Byb2pla3RlL25paG9uZ28vd29ya3NwYWNlL3NyYy9qcy9jb21wb25lbnRzL05paG9uZ29BcHAuanMiLCIvaG9tZS9tYW51ZWwvcHJvamVrdGUvbmlob25nby93b3Jrc3BhY2Uvc3JjL2pzL2NvbXBvbmVudHMvUmV2ZWFsT3JkZXJDb25maWcuanMiLCIvaG9tZS9tYW51ZWwvcHJvamVrdGUvbmlob25nby93b3Jrc3BhY2Uvc3JjL2pzL2NvbXBvbmVudHMvVm9jYWJsZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtB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QUFhO0lBQ2pCLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxPQUFPLEVBQUUsZUFBZSxDQUFDLENBQUMsQ0FBQztJQUMxQyxNQUFNO0dBQ1A7QUFDSCxFQUFFOztDQUVELE1BQU0sRUFBRSxXQUFXO0VBQ2xCLElBQUksS0FBSyxHQUFHO0dBQ1gsUUFBUSxFQUFFLEtBQUs7R0FDZixVQUFVLEVBQUUsTUFBTTtBQUNyQixHQUFHLENBQUM7O0VBRUY7R0FDQyxvQkFBQSxLQUFJLEVBQUEsQ0FBQSxDQUFDLFNBQUEsRUFBUyxDQUFDLDhCQUErQixDQUFBLEVBQUE7SUFDN0Msb0JBQUEsS0FBSSxFQUFBLENBQUEsQ0FBQyxTQUFBLEVBQVMsQ0FBQyxZQUFhLENBQUEsRUFBQTtLQUMzQixvQkFBQSxNQUFLLEVBQUEsSUFBQyxFQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFDLEdBQVEsQ0FBQSxFQUFBO0tBQ2xDLG9CQUFBLElBQUcsRUFBQSxJQUFFLENBQUEsRUFBQTtLQUNMLG9CQUFBLE1BQUssRUFBQSxDQUFBLENBQUMsRUFBQSxFQUFFLENBQUMsTUFBQSxFQUFNLENBQUMsS0FBQSxFQUFLLENBQUUsS0FBTyxDQUFBLEVBQUMsSUFBSSxDQUFDLE9BQU8sRUFBVSxDQUFBLEVBQUE7S0FDckQsb0JBQUEsUUFBTyxFQUFBLENBQUEsQ0FBQyxPQUFBLEVBQU8sQ0FBRSxJQUFJLENBQUMsYUFBYSxFQUFDLENBQUMsSUFBQSxFQUFJLENBQUMsUUFBQSxFQUFRLENBQUMsU0FBQSxFQUFTLENBQUMsNEJBQTZCLENBQUEsRUFBQSxRQUFlLENBQUE7SUFDcEcsQ0FBQTtHQUNELENBQUE7R0FDTjtFQUNEO0FBQ0YsQ0FBQyxDQUFDLENBQUM7O0FBRUgsTUFBTSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUMiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiKGZ1bmN0aW9uKCkge1xuICAndXNlIHN0cmljdCc7XG5cbiAgdmFyIEVTQ0FQRV9ERUxJTUlURVJTID0gWyd8JywgJ14nXSxcbiAgICAgIENFTExfREVMSU1JVEVSUyA9IFsnLCcsICc7JywgJ1xcdCcsICd8JywgJ14nXSxcbiAgICAgIExJTkVfREVMSU1JVEVSUyA9IFsnXFxyXFxuJywgJ1xccicsICdcXG4nXTtcblxuICBmdW5jdGlvbiBpc09iamVjdChvYmplY3QpIHtcbiAgICB2YXIgdHlwZSA9IHR5cGVvZiBvYmplY3Q7XG4gICAgcmV0dXJuIHR5cGUgPT09ICdmdW5jdGlvbicgfHwgdHlwZSA9PT0gJ29iamVjdCcgJiYgISFvYmplY3Q7XG4gIH1cbiAgdmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uKG9iamVjdCkge1xuICAgIHJldHVybiB0b1N0cmluZy5jYWxsKG9iamVjdCkgPT09ICdbb2JqZWN0IEFycmF5XSc7XG4gIH1cbiAgZnVuY3Rpb24gaXNTdHJpbmcob2JqZWN0KSB7XG4gICAgcmV0dXJuIHR5cGVvZiBvYmplY3QgPT09ICdzdHJpbmcnO1xuICB9XG4gIGZ1bmN0aW9uIGlzTnVtYmVyKG9iamVjdCkge1xuICAgIHJldHVybiAhaXNOYU4oTnVtYmVyKG9iamVjdCkpO1xuICB9XG4gIGZ1bmN0aW9uIGlzQm9vbGVhbih2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZSA9PSBmYWxzZSB8fCB2YWx1ZSA9PSB0cnVlO1xuICB9XG4gIGZ1bmN0aW9uIGlzTnVsbCh2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZSA9PSBudWxsO1xuICB9XG4gIGZ1bmN0aW9uIGlzUHJlc2VudCh2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZSAhPSBudWxsO1xuICB9XG5cbiAgZnVuY3Rpb24gZmFsbGJhY2sodmFsdWUsIGZhbGxiYWNrKSB7XG4gICAgcmV0dXJuIGlzUHJlc2VudCh2YWx1ZSkgPyB2YWx1ZSA6IGZhbGxiYWNrO1xuICB9XG5cbiAgZnVuY3Rpb24gZm9yRWFjaChjb2xsZWN0aW9uLCBpdGVyYXRvcikge1xuICAgIGZvciAodmFyIF9pID0gMCwgX2xlbiA9IGNvbGxlY3Rpb24ubGVuZ3RoOyBfaSA8IF9sZW47IF9pICs9IDEpIHtcbiAgICAgIGlmIChpdGVyYXRvcihjb2xsZWN0aW9uW19pXSwgX2kpID09PSBmYWxzZSkgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gc2FuaXRpemVTdHJpbmcoc3RyaW5nKSB7XG4gICAgcmV0dXJuIHN0cmluZy5yZXBsYWNlKC9cIi9nLCdcXFxcXCInKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGJ1aWxkQ2VsbChpbmRleCkge1xuICAgIHJldHVybiAnYXR0cnNbJyArIGluZGV4ICsgJ10nO1xuICB9XG5cbiAgZnVuY3Rpb24gY2FzdENlbGwodmFsdWUsIGluZGV4KSB7XG4gICAgaWYgKGlzTnVtYmVyKHZhbHVlKSkge1xuICAgICAgcmV0dXJuICdOdW1iZXIoJyArIGJ1aWxkQ2VsbChpbmRleCkgKyAnKSc7XG4gICAgfSBlbHNlIGlmIChpc0Jvb2xlYW4odmFsdWUpKSB7XG4gICAgICByZXR1cm4gJ0Jvb2xlYW4oJyArIGJ1aWxkQ2VsbChpbmRleCkgKyAnID09IHRydWUpJztcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuICdTdHJpbmcoJyArIGJ1aWxkQ2VsbChpbmRleCkgKyAnKSc7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gYnVpbGRDb25zdHJ1Y3RvcihjYXN0LCB2YWx1ZXMsIGF0dHJzKSB7XG4gICAgdmFyIGRlZmluaXRpb24gPSBbXTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PSAyKSB7XG4gICAgICBpZiAoY2FzdCkge1xuICAgICAgICBpZiAoaXNBcnJheShjYXN0KSkge1xuICAgICAgICAgIGZvckVhY2godmFsdWVzLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgpIHtcbiAgICAgICAgICAgIGRlZmluaXRpb24ucHVzaChjYXN0W2luZGV4XSArICcoJyArIGJ1aWxkQ2VsbChpbmRleCkgKyAnKScpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGZvckVhY2godmFsdWVzLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgpIHtcbiAgICAgICAgICAgIGRlZmluaXRpb24ucHVzaChjYXN0Q2VsbCh2YWx1ZSwgaW5kZXgpKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm9yRWFjaCh2YWx1ZXMsIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCkge1xuICAgICAgICAgIGRlZmluaXRpb24ucHVzaChidWlsZENlbGwoaW5kZXgpKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBkZWZpbml0aW9uID0gJ3JldHVybiBbJyArIGRlZmluaXRpb24uam9pbignLCcpICsgJ10nO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoY2FzdCkge1xuICAgICAgICBpZiAoaXNBcnJheShjYXN0KSkge1xuICAgICAgICAgIGZvckVhY2godmFsdWVzLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgpIHtcbiAgICAgICAgICAgIGRlZmluaXRpb24ucHVzaCgnXCInICsgc2FuaXRpemVTdHJpbmcoYXR0cnNbaW5kZXhdKSArICdcIjogJyArIGNhc3RbaW5kZXhdICsgJygnICsgYnVpbGRDZWxsKGluZGV4KSArICcpJyk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZm9yRWFjaCh2YWx1ZXMsIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCkge1xuICAgICAgICAgICAgZGVmaW5pdGlvbi5wdXNoKCdcIicgKyBzYW5pdGl6ZVN0cmluZyhhdHRyc1tpbmRleF0pICsgJ1wiOiAnICsgY2FzdENlbGwodmFsdWUsIGluZGV4KSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvckVhY2godmFsdWVzLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgpIHtcbiAgICAgICAgICBkZWZpbml0aW9uLnB1c2goJ1wiJyArIHNhbml0aXplU3RyaW5nKGF0dHJzW2luZGV4XSkgKyAnXCI6ICcgKyBidWlsZENlbGwoaW5kZXgpKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBkZWZpbml0aW9uID0gJ3JldHVybiB7JyArIGRlZmluaXRpb24uam9pbignLCcpICsgJ30nO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IEZ1bmN0aW9uKCdhdHRycycsIGRlZmluaXRpb24pO1xuICB9XG5cbiAgZnVuY3Rpb24gZGV0ZWN0RGVsaW1pdGVyKHN0cmluZywgZGVsaW1pdGVycykge1xuICAgIHZhciBjb3VudCA9IDAsXG4gICAgICAgIGRldGVjdGVkO1xuXG4gICAgZm9yRWFjaChkZWxpbWl0ZXJzLCBmdW5jdGlvbihkZWxpbWl0ZXIpIHtcbiAgICAgIHZhciBuZWVkbGUgPSBkZWxpbWl0ZXIsXG4gICAgICAgICAgbWF0Y2hlcztcbiAgICAgIGlmIChFU0NBUEVfREVMSU1JVEVSUy5pbmRleE9mKGRlbGltaXRlcikgIT0gLTEpIHtcbiAgICAgICAgbmVlZGxlID0gJ1xcXFwnICsgbmVlZGxlO1xuICAgICAgfVxuICAgICAgbWF0Y2hlcyA9IHN0cmluZy5tYXRjaChuZXcgUmVnRXhwKG5lZWRsZSwgJ2cnKSk7XG4gICAgICBpZiAobWF0Y2hlcyAmJiBtYXRjaGVzLmxlbmd0aCA+IGNvdW50KSB7XG4gICAgICAgIGNvdW50ID0gbWF0Y2hlcy5sZW5ndGg7XG4gICAgICAgIGRldGVjdGVkID0gZGVsaW1pdGVyO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiAoZGV0ZWN0ZWQgfHwgZGVsaW1pdGVyc1swXSk7XG4gIH1cblxuICB2YXIgQ1NWID0gKGZ1bmN0aW9uKCkge1xuICAgIGZ1bmN0aW9uIENTVihkYXRhLCBvcHRpb25zKSB7XG4gICAgICBpZiAoIW9wdGlvbnMpIG9wdGlvbnMgPSB7fTtcblxuICAgICAgaWYgKGlzQXJyYXkoZGF0YSkpIHtcbiAgICAgICAgdGhpcy5tb2RlID0gJ2VuY29kZSc7XG4gICAgICB9IGVsc2UgaWYgKGlzU3RyaW5nKGRhdGEpKSB7XG4gICAgICAgIHRoaXMubW9kZSA9ICdwYXJzZSc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbmNvbXBhdGlibGUgZm9ybWF0IVwiKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5kYXRhID0gZGF0YTtcblxuICAgICAgdGhpcy5vcHRpb25zID0ge1xuICAgICAgICBoZWFkZXI6IGZhbGxiYWNrKG9wdGlvbnMuaGVhZGVyLCBmYWxzZSksXG4gICAgICAgIGNhc3Q6IGZhbGxiYWNrKG9wdGlvbnMuY2FzdCwgdHJ1ZSlcbiAgICAgIH1cblxuICAgICAgdmFyIGxpbmVEZWxpbWl0ZXIgPSBvcHRpb25zLmxpbmVEZWxpbWl0ZXIgfHwgb3B0aW9ucy5saW5lLFxuICAgICAgICAgIGNlbGxEZWxpbWl0ZXIgPSBvcHRpb25zLmNlbGxEZWxpbWl0ZXIgfHwgb3B0aW9ucy5kZWxpbWl0ZXI7XG5cbiAgICAgIGlmICh0aGlzLmlzUGFyc2VyKCkpIHtcbiAgICAgICAgdGhpcy5vcHRpb25zLmxpbmVEZWxpbWl0ZXIgPSBsaW5lRGVsaW1pdGVyIHx8IGRldGVjdERlbGltaXRlcih0aGlzLmRhdGEsIExJTkVfREVMSU1JVEVSUyk7XG4gICAgICAgIHRoaXMub3B0aW9ucy5jZWxsRGVsaW1pdGVyID0gY2VsbERlbGltaXRlciB8fCBkZXRlY3REZWxpbWl0ZXIodGhpcy5kYXRhLCBDRUxMX0RFTElNSVRFUlMpO1xuICAgICAgICB0aGlzLmRhdGEgPSBub3JtYWxpemVDU1YodGhpcy5kYXRhLCB0aGlzLm9wdGlvbnMubGluZURlbGltaXRlcik7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuaXNFbmNvZGVyKCkpIHtcbiAgICAgICAgdGhpcy5vcHRpb25zLmxpbmVEZWxpbWl0ZXIgPSBsaW5lRGVsaW1pdGVyIHx8ICdcXHJcXG4nO1xuICAgICAgICB0aGlzLm9wdGlvbnMuY2VsbERlbGltaXRlciA9IGNlbGxEZWxpbWl0ZXIgfHwgJywnO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGludm9rZShtZXRob2QsIGNvbnN0cnVjdG9yLCBhdHRyaWJ1dGVzKSB7XG4gICAgICBtZXRob2QobmV3IGNvbnN0cnVjdG9yKGF0dHJpYnV0ZXMpKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBub3JtYWxpemVDU1YodGV4dCwgbGluZURlbGltaXRlcikge1xuICAgICAgaWYgKHRleHQuc2xpY2UoLWxpbmVEZWxpbWl0ZXIubGVuZ3RoKSAhPSBsaW5lRGVsaW1pdGVyKSB0ZXh0ICs9IGxpbmVEZWxpbWl0ZXI7XG4gICAgICByZXR1cm4gdGV4dDtcbiAgICB9XG5cbiAgICBDU1YucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uKHNldHRpbmcsIHZhbHVlKSB7XG4gICAgICByZXR1cm4gdGhpcy5vcHRpb25zW3NldHRpbmddID0gdmFsdWU7XG4gICAgfVxuXG4gICAgQ1NWLnByb3RvdHlwZS5pc1BhcnNlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMubW9kZSA9PSAncGFyc2UnO1xuICAgIH1cblxuICAgIENTVi5wcm90b3R5cGUuaXNFbmNvZGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5tb2RlID09ICdlbmNvZGUnO1xuICAgIH1cblxuICAgIENTVi5wcm90b3R5cGUucGFyc2UgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgaWYgKHRoaXMubW9kZSAhPSAncGFyc2UnKSByZXR1cm47XG5cbiAgICAgIGlmICh0aGlzLmRhdGEudHJpbSgpLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFtdO1xuXG4gICAgICB2YXIgZGF0YSA9IHRoaXMuZGF0YSxcbiAgICAgICAgICBvcHRpb25zID0gdGhpcy5vcHRpb25zLFxuICAgICAgICAgIGhlYWRlciA9IG9wdGlvbnMuaGVhZGVyLFxuICAgICAgICAgIGN1cnJlbnQgPSB7IGNlbGw6ICcnLCBsaW5lOiBbXSB9LFxuICAgICAgICAgIGZsYWcsIHJlY29yZCwgcmVzcG9uc2U7XG5cbiAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgcmVzcG9uc2UgPSBbXTtcbiAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbihyZWNvcmQpIHtcbiAgICAgICAgICByZXNwb25zZS5wdXNoKHJlY29yZCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gcmVzZXRGbGFncygpIHtcbiAgICAgICAgZmxhZyA9IHsgZXNjYXBlZDogZmFsc2UsIHF1b3RlOiBmYWxzZSwgY2VsbDogdHJ1ZSB9O1xuICAgICAgfVxuICAgICAgZnVuY3Rpb24gcmVzZXRDZWxsKCkge1xuICAgICAgICBjdXJyZW50LmNlbGwgPSAnJztcbiAgICAgIH1cbiAgICAgIGZ1bmN0aW9uIHJlc2V0TGluZSgpIHtcbiAgICAgICAgY3VycmVudC5saW5lID0gW107XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIHNhdmVDZWxsKGNlbGwpIHtcbiAgICAgICAgY3VycmVudC5saW5lLnB1c2goZmxhZy5lc2NhcGVkID8gY2VsbC5zbGljZSgxLCAtMSkucmVwbGFjZSgvXCJcIi9nLCAnXCInKSA6IGNlbGwpO1xuICAgICAgICByZXNldENlbGwoKTtcbiAgICAgICAgcmVzZXRGbGFncygpO1xuICAgICAgfVxuICAgICAgZnVuY3Rpb24gc2F2ZUxhc3RDZWxsKGNlbGwpIHtcbiAgICAgICAgc2F2ZUNlbGwoY2VsbC5zbGljZSgwLCAxIC0gb3B0aW9ucy5saW5lRGVsaW1pdGVyLmxlbmd0aCkpO1xuICAgICAgfVxuICAgICAgZnVuY3Rpb24gc2F2ZUxpbmUoKSB7XG4gICAgICAgIGlmIChoZWFkZXIpIHtcbiAgICAgICAgICBpZiAoaXNBcnJheShoZWFkZXIpKSB7XG4gICAgICAgICAgICByZWNvcmQgPSBidWlsZENvbnN0cnVjdG9yKG9wdGlvbnMuY2FzdCwgY3VycmVudC5saW5lLCBoZWFkZXIpO1xuICAgICAgICAgICAgc2F2ZUxpbmUgPSBmdW5jdGlvbigpIHsgaW52b2tlKGNhbGxiYWNrLCByZWNvcmQsIGN1cnJlbnQubGluZSk7IH07XG4gICAgICAgICAgICBzYXZlTGluZSgpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBoZWFkZXIgPSBjdXJyZW50LmxpbmU7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmICghcmVjb3JkKSB7XG4gICAgICAgICAgICByZWNvcmQgPSBidWlsZENvbnN0cnVjdG9yKG9wdGlvbnMuY2FzdCwgY3VycmVudC5saW5lKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgc2F2ZUxpbmUgPSBmdW5jdGlvbigpIHsgaW52b2tlKGNhbGxiYWNrLCByZWNvcmQsIGN1cnJlbnQubGluZSk7IH07XG4gICAgICAgICAgc2F2ZUxpbmUoKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAob3B0aW9ucy5saW5lRGVsaW1pdGVyLmxlbmd0aCA9PSAxKSBzYXZlTGFzdENlbGwgPSBzYXZlQ2VsbDtcblxuICAgICAgdmFyIGRhdGFMZW5ndGggPSBkYXRhLmxlbmd0aCxcbiAgICAgICAgICBjZWxsRGVsaW1pdGVyID0gb3B0aW9ucy5jZWxsRGVsaW1pdGVyLmNoYXJDb2RlQXQoMCksXG4gICAgICAgICAgbGluZURlbGltaXRlciA9IG9wdGlvbnMubGluZURlbGltaXRlci5jaGFyQ29kZUF0KG9wdGlvbnMubGluZURlbGltaXRlci5sZW5ndGggLSAxKSxcbiAgICAgICAgICBfaSwgX2MsIF9jaDtcblxuICAgICAgcmVzZXRGbGFncygpO1xuXG4gICAgICBmb3IgKF9pID0gMCwgX2MgPSAwOyBfaSA8IGRhdGFMZW5ndGg7IF9pKyspIHtcbiAgICAgICAgX2NoID0gZGF0YS5jaGFyQ29kZUF0KF9pKTtcblxuICAgICAgICBpZiAoZmxhZy5jZWxsKSB7XG4gICAgICAgICAgZmxhZy5jZWxsID0gZmFsc2U7XG4gICAgICAgICAgaWYgKF9jaCA9PSAzNCkge1xuICAgICAgICAgICAgZmxhZy5lc2NhcGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChmbGFnLmVzY2FwZWQgJiYgX2NoID09IDM0KSB7XG4gICAgICAgICAgZmxhZy5xdW90ZSA9ICFmbGFnLnF1b3RlO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKChmbGFnLmVzY2FwZWQgJiYgZmxhZy5xdW90ZSkgfHwgIWZsYWcuZXNjYXBlZCkge1xuICAgICAgICAgIGlmIChfY2ggPT0gY2VsbERlbGltaXRlcikge1xuICAgICAgICAgICAgc2F2ZUNlbGwoY3VycmVudC5jZWxsICsgZGF0YS5zbGljZShfYywgX2kpKTtcbiAgICAgICAgICAgIF9jID0gX2kgKyAxO1xuICAgICAgICAgIH0gZWxzZSBpZiAoX2NoID09IGxpbmVEZWxpbWl0ZXIpIHtcbiAgICAgICAgICAgIHNhdmVMYXN0Q2VsbChjdXJyZW50LmNlbGwgKyBkYXRhLnNsaWNlKF9jLCBfaSkpO1xuICAgICAgICAgICAgX2MgPSBfaSArIDE7XG4gICAgICAgICAgICBzYXZlTGluZSgpO1xuICAgICAgICAgICAgcmVzZXRMaW5lKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChyZXNwb25zZSkge1xuICAgICAgICByZXR1cm4gcmVzcG9uc2U7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzZXJpYWxpemVUeXBlKG9iamVjdCkge1xuICAgICAgaWYgKGlzQXJyYXkob2JqZWN0KSkge1xuICAgICAgICByZXR1cm4gJ2FycmF5JztcbiAgICAgIH0gZWxzZSBpZiAoaXNPYmplY3Qob2JqZWN0KSkge1xuICAgICAgICByZXR1cm4gJ29iamVjdCc7XG4gICAgICB9IGVsc2UgaWYgKGlzU3RyaW5nKG9iamVjdCkpIHtcbiAgICAgICAgcmV0dXJuICdzdHJpbmcnO1xuICAgICAgfSBlbHNlIGlmIChpc051bGwob2JqZWN0KSkge1xuICAgICAgICByZXR1cm4gJ251bGwnO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuICdwcmltaXRpdmUnO1xuICAgICAgfVxuICAgIH1cblxuICAgIENTVi5wcm90b3R5cGUuc2VyaWFsaXplID0ge1xuICAgICAgXCJvYmplY3RcIjogZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAgICAgIHZhciB0aGF0ID0gdGhpcyxcbiAgICAgICAgICAgIGF0dHJpYnV0ZXMgPSBPYmplY3Qua2V5cyhvYmplY3QpLFxuICAgICAgICAgICAgc2VyaWFsaXplZCA9IEFycmF5KGF0dHJpYnV0ZXMubGVuZ3RoKTtcbiAgICAgICAgZm9yRWFjaChhdHRyaWJ1dGVzLCBmdW5jdGlvbihhdHRyLCBpbmRleCkge1xuICAgICAgICAgIHNlcmlhbGl6ZWRbaW5kZXhdID0gdGhhdFtzZXJpYWxpemVUeXBlKG9iamVjdFthdHRyXSldKG9iamVjdFthdHRyXSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gc2VyaWFsaXplZDtcbiAgICAgIH0sXG4gICAgICBcImFycmF5XCI6IGZ1bmN0aW9uKGFycmF5KSB7XG4gICAgICAgIHZhciB0aGF0ID0gdGhpcyxcbiAgICAgICAgICAgIHNlcmlhbGl6ZWQgPSBBcnJheShhcnJheS5sZW5ndGgpO1xuICAgICAgICBmb3JFYWNoKGFycmF5LCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgpIHtcbiAgICAgICAgICBzZXJpYWxpemVkW2luZGV4XSA9IHRoYXRbc2VyaWFsaXplVHlwZSh2YWx1ZSldKHZhbHVlKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBzZXJpYWxpemVkO1xuICAgICAgfSxcbiAgICAgIFwic3RyaW5nXCI6IGZ1bmN0aW9uKHN0cmluZykge1xuICAgICAgICByZXR1cm4gJ1wiJyArIFN0cmluZyhzdHJpbmcpLnJlcGxhY2UoL1wiL2csICdcIlwiJykgKyAnXCInO1xuICAgICAgfSxcbiAgICAgIFwibnVsbFwiOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gJyc7XG4gICAgICB9LFxuICAgICAgXCJwcmltaXRpdmVcIjogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIENTVi5wcm90b3R5cGUuZW5jb2RlID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgIGlmICh0aGlzLm1vZGUgIT0gJ2VuY29kZScpIHJldHVybjtcblxuICAgICAgaWYgKHRoaXMuZGF0YS5sZW5ndGggPT0gMCkgcmV0dXJuICcnO1xuXG4gICAgICB2YXIgZGF0YSA9IHRoaXMuZGF0YSxcbiAgICAgICAgICBvcHRpb25zID0gdGhpcy5vcHRpb25zLFxuICAgICAgICAgIGhlYWRlciA9IG9wdGlvbnMuaGVhZGVyLFxuICAgICAgICAgIHNhbXBsZSA9IGRhdGFbMF0sXG4gICAgICAgICAgc2VyaWFsaXplID0gdGhpcy5zZXJpYWxpemUsXG4gICAgICAgICAgb2Zmc2V0ID0gMCxcbiAgICAgICAgICBhdHRyaWJ1dGVzLCByZXNwb25zZTtcblxuICAgICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgICByZXNwb25zZSA9IEFycmF5KGRhdGEubGVuZ3RoKTtcbiAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbihyZWNvcmQsIGluZGV4KSB7XG4gICAgICAgICAgcmVzcG9uc2VbaW5kZXggKyBvZmZzZXRdID0gcmVjb3JkO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIHNlcmlhbGl6ZUxpbmUocmVjb3JkKSB7XG4gICAgICAgIHJldHVybiByZWNvcmQuam9pbihvcHRpb25zLmNlbGxEZWxpbWl0ZXIpO1xuICAgICAgfVxuXG4gICAgICBpZiAoaGVhZGVyKSB7XG4gICAgICAgIGlmICghaXNBcnJheShoZWFkZXIpKSB7XG4gICAgICAgICAgYXR0cmlidXRlcyA9IE9iamVjdC5rZXlzKHNhbXBsZSk7XG4gICAgICAgICAgaGVhZGVyID0gYXR0cmlidXRlcztcbiAgICAgICAgfVxuICAgICAgICBjYWxsYmFjayhzZXJpYWxpemVMaW5lKHNlcmlhbGl6ZS5hcnJheShoZWFkZXIpKSwgMCk7XG4gICAgICAgIG9mZnNldCA9IDE7XG4gICAgICB9XG5cbiAgICAgIHZhciByZWNvcmRUeXBlID0gc2VyaWFsaXplVHlwZShzYW1wbGUpLFxuICAgICAgICAgIG1hcDtcblxuICAgICAgaWYgKHJlY29yZFR5cGUgPT0gJ2FycmF5Jykge1xuICAgICAgICBpZiAoaXNBcnJheShvcHRpb25zLmNhc3QpKSB7XG4gICAgICAgICAgbWFwID0gQXJyYXkob3B0aW9ucy5jYXN0Lmxlbmd0aCk7XG4gICAgICAgICAgZm9yRWFjaChvcHRpb25zLmNhc3QsIGZ1bmN0aW9uKHR5cGUsIGluZGV4KSB7XG4gICAgICAgICAgICBtYXBbaW5kZXhdID0gdHlwZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG1hcCA9IEFycmF5KHNhbXBsZS5sZW5ndGgpO1xuICAgICAgICAgIGZvckVhY2goc2FtcGxlLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgpIHtcbiAgICAgICAgICAgIG1hcFtpbmRleF0gPSBzZXJpYWxpemVUeXBlKHZhbHVlKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBmb3JFYWNoKGRhdGEsIGZ1bmN0aW9uKHJlY29yZCwgcmVjb3JkSW5kZXgpIHtcbiAgICAgICAgICB2YXIgc2VyaWFsaXplZFJlY29yZCA9IEFycmF5KG1hcC5sZW5ndGgpO1xuICAgICAgICAgIGZvckVhY2gocmVjb3JkLCBmdW5jdGlvbih2YWx1ZSwgdmFsdWVJbmRleCkge1xuICAgICAgICAgICAgc2VyaWFsaXplZFJlY29yZFt2YWx1ZUluZGV4XSA9IHNlcmlhbGl6ZVttYXBbdmFsdWVJbmRleF1dKHZhbHVlKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBjYWxsYmFjayhzZXJpYWxpemVMaW5lKHNlcmlhbGl6ZWRSZWNvcmQpLCByZWNvcmRJbmRleCk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChyZWNvcmRUeXBlID09ICdvYmplY3QnKSB7XG4gICAgICAgIGF0dHJpYnV0ZXMgPSBPYmplY3Qua2V5cyhzYW1wbGUpO1xuICAgICAgICBpZiAoaXNBcnJheShvcHRpb25zLmNhc3QpKSB7XG4gICAgICAgICAgbWFwID0gQXJyYXkob3B0aW9ucy5jYXN0Lmxlbmd0aCk7XG4gICAgICAgICAgZm9yRWFjaChvcHRpb25zLmNhc3QsIGZ1bmN0aW9uKHR5cGUsIGluZGV4KSB7XG4gICAgICAgICAgICBtYXBbaW5kZXhdID0gdHlwZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG1hcCA9IEFycmF5KGF0dHJpYnV0ZXMubGVuZ3RoKTtcbiAgICAgICAgICBmb3JFYWNoKGF0dHJpYnV0ZXMsIGZ1bmN0aW9uKGF0dHIsIGluZGV4KSB7XG4gICAgICAgICAgICBtYXBbaW5kZXhdID0gc2VyaWFsaXplVHlwZShzYW1wbGVbYXR0cl0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGZvckVhY2goZGF0YSwgZnVuY3Rpb24ocmVjb3JkLCByZWNvcmRJbmRleCkge1xuICAgICAgICAgIHZhciBzZXJpYWxpemVkUmVjb3JkID0gQXJyYXkoYXR0cmlidXRlcy5sZW5ndGgpO1xuICAgICAgICAgIGZvckVhY2goYXR0cmlidXRlcywgZnVuY3Rpb24oYXR0ciwgYXR0ckluZGV4KSB7XG4gICAgICAgICAgICBzZXJpYWxpemVkUmVjb3JkW2F0dHJJbmRleF0gPSBzZXJpYWxpemVbbWFwW2F0dHJJbmRleF1dKHJlY29yZFthdHRyXSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgY2FsbGJhY2soc2VyaWFsaXplTGluZShzZXJpYWxpemVkUmVjb3JkKSwgcmVjb3JkSW5kZXgpO1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgaWYgKHJlc3BvbnNlKSB7XG4gICAgICAgIHJldHVybiByZXNwb25zZS5qb2luKG9wdGlvbnMubGluZURlbGltaXRlcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBDU1YucHJvdG90eXBlLmZvckVhY2ggPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgcmV0dXJuIHRoaXNbdGhpcy5tb2RlXShjYWxsYmFjayk7XG4gICAgfVxuXG4gICAgcmV0dXJuIENTVjtcbiAgfSkoKTtcblxuICBDU1YucGFyc2UgPSBmdW5jdGlvbihkYXRhLCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIG5ldyBDU1YoZGF0YSwgb3B0aW9ucykucGFyc2UoKTtcbiAgfVxuXG4gIENTVi5lbmNvZGUgPSBmdW5jdGlvbihkYXRhLCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIG5ldyBDU1YoZGF0YSwgb3B0aW9ucykuZW5jb2RlKCk7XG4gIH1cblxuICBDU1YuZm9yRWFjaCA9IGZ1bmN0aW9uKGRhdGEsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT0gMikge1xuICAgICAgY2FsbGJhY2sgPSBvcHRpb25zO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IENTVihkYXRhLCBvcHRpb25zKS5mb3JFYWNoKGNhbGxiYWNrKTtcbiAgfVxuXG4gIGlmICh0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgZGVmaW5lLmFtZCkge1xuICAgIGRlZmluZSgnQ1NWJywgW10sIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIENTVjtcbiAgICB9KTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgbW9kdWxlID09PSBcIm9iamVjdFwiICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBDU1Y7XG4gIH0gZWxzZSBpZiAod2luZG93KSB7XG4gICAgd2luZG93LkNTViA9IENTVjtcbiAgfVxufSkoKTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIE5paG9uZ29BcHAgPSByZXF1aXJlKFwiLi9jb21wb25lbnRzL05paG9uZ29BcHBcIik7XG5cblJlYWN0LnJlbmRlcihcblx0PE5paG9uZ29BcHAgLz4sXG5cdGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYXBwXCIpXG4pO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgVm9jYWJsZSA9IHJlcXVpcmUoXCIuL1ZvY2FibGVcIik7XG5cbnZhciBEaWN0aW9uYXJ5ID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuXG5cdHByb3BUeXBlczoge1xuXHRcdHZvY2FibGVzOiBSZWFjdC5Qcm9wVHlwZXMuYXJyYXlPZihSZWFjdC5Qcm9wVHlwZXMuc2hhcGUoe1xuXHRcdFx0a2FuYTogUmVhY3QuUHJvcFR5cGVzLnN0cmluZyxcblx0XHRcdHRyYW5zY3JpcHRpb246IFJlYWN0LlByb3BUeXBlcy5zdHJpbmcsXG5cdFx0XHR0cmFuc2xhdGlvbjogUmVhY3QuUHJvcFR5cGVzLnN0cmluZ1xuXHRcdH0pKS5pc1JlcXVpcmVkLFxuXG5cdFx0aW5pdGlhbFJldmVhbFN0YXRlOiBSZWFjdC5Qcm9wVHlwZXMub25lT2YoWyd0cmFuc2NyaXB0aW9uJywna2FuYScsJ3RyYW5zbGF0aW9uJ10pXG5cdH0sXG5cblx0Z2V0RGVmYXVsdFByb3BzOiBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0aW5pdGlhbFJldmVhbFN0YXRlOiAndHJhbnNjcmlwdGlvbidcblx0XHR9O1xuXHR9LFxuXG5cdGdldEluaXRpYWxTdGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGN1cnJlbnRWb2NhYmxlOiBudWxsLFxuXHRcdFx0dm9jYWJsZXNMZWZ0OiBbXVxuXHRcdH1cblx0fSxcblxuXHRjb21wb25lbnRXaWxsTW91bnQ6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMubmV4dCgpO1xuXHR9LFxuXG5cdG5leHQ6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciB2b2NhYmxlc0xlZnQ7XG5cblx0XHRpZih0aGlzLnN0YXRlLnZvY2FibGVzTGVmdC5sZW5ndGggPT0gMCkge1xuXHRcdFx0dm9jYWJsZXNMZWZ0ID0gdGhpcy5wcm9wcy52b2NhYmxlcy5zbGljZSgpOyAvLyBzdGFydCBhZ2FpbiB3aXRoIGluaXRpYWwgdm9jYWJsZXNcblx0XHR9IGVsc2Uge1xuXHRcdFx0dm9jYWJsZXNMZWZ0ID0gdGhpcy5zdGF0ZS52b2NhYmxlc0xlZnQuc2xpY2UoKTtcblx0XHR9XG5cblx0XHRpZih2b2NhYmxlc0xlZnQubGVuZ3RoID4gMCkge1xuXG5cdFx0XHR2YXIgaSA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIHZvY2FibGVzTGVmdC5sZW5ndGgpO1xuXG5cdFx0XHR2YXIgbmV4dFZvY2FibGUgPSB2b2NhYmxlc0xlZnQuc3BsaWNlKGksIDEpO1xuXG5cdFx0XHR0aGlzLnNldFN0YXRlKHtcblx0XHRcdFx0dm9jYWJsZXNMZWZ0OiB2b2NhYmxlc0xlZnQsXG5cdFx0XHRcdGN1cnJlbnRWb2NhYmxlOiBuZXh0Vm9jYWJsZVswXSxcblx0XHRcdH0pO1xuXG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuc2V0U3RhdGUoe1xuXHRcdFx0XHRjdXJyZW50Vm9jYWJsZTogbnVsbCxcblx0XHRcdH0pO1xuXHRcdH1cblx0fSxcblxuXHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciB2b2NhYmxlID0gdGhpcy5zdGF0ZS5jdXJyZW50Vm9jYWJsZSA/XG5cdFx0XHRcdFx0XHQ8Vm9jYWJsZSBrYW5hPXt0aGlzLnN0YXRlLmN1cnJlbnRWb2NhYmxlLmthbmF9XG5cdFx0XHRcdFx0XHRcdFx0dHJhbnNjcmlwdGlvbj17dGhpcy5zdGF0ZS5jdXJyZW50Vm9jYWJsZS50cmFuc2NyaXB0aW9ufVxuXHRcdFx0XHRcdFx0XHRcdHRyYW5zbGF0aW9uPXt0aGlzLnN0YXRlLmN1cnJlbnRWb2NhYmxlLnRyYW5zbGF0aW9ufVxuXHRcdFx0XHRcdFx0XHRcdGluaXRpYWxSZXZlYWxTdGF0ZT17dGhpcy5wcm9wcy5pbml0aWFsUmV2ZWFsU3RhdGV9IC8+XG5cdFx0XHRcdFx0XHQ6IG51bGw7XG5cblx0XHRyZXR1cm4gKFxuXHRcdFx0PGRpdj5cblx0XHRcdFx0PGJ1dHRvbiBvbkNsaWNrPXt0aGlzLm5leHR9IHR5cGU9XCJidXR0b25cIiBjbGFzc05hbWU9XCJidG4gYnRuLXByaW1hcnlcIj5OZXh0PC9idXR0b24+XG5cdFx0XHRcdDxkaXY+XG5cdFx0XHRcdFx0e3ZvY2FibGV9XG5cdFx0XHRcdDwvZGl2PlxuXHRcdFx0PC9kaXY+XG5cdFx0KVxuXHR9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBEaWN0aW9uYXJ5O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgRGljdGlvbmFyeSA9IHJlcXVpcmUoXCIuL0RpY3Rpb25hcnlcIik7XG52YXIgQ1NWID0gcmVxdWlyZSgnY29tbWEtc2VwYXJhdGVkLXZhbHVlcycpO1xuXG52YXIgRGljdGlvbmFyeUNob29zZXIgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG5cblx0cHJvcFR5cGVzOiB7XG5cdFx0aW5pdGlhbFJldmVhbFN0YXRlOiBSZWFjdC5Qcm9wVHlwZXMub25lT2YoWyd0cmFuc2NyaXB0aW9uJywna2FuYScsJ3RyYW5zbGF0aW9uJ10pXG5cdH0sXG5cblx0Z2V0RGVmYXVsdFByb3BzOiBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0aW5pdGlhbFJldmVhbFN0YXRlOiAndHJhbnNjcmlwdGlvbidcblx0XHR9O1xuXHR9LFxuXG5cdGdldEluaXRpYWxTdGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHZvY2FibGVzOiBbXSxcblx0XHR9XG5cdH0sXG5cblx0bG9hZFZvY2FibGVzOiBmdW5jdGlvbigpIHtcblx0XHQkLmdldChcImRpY3Rpb25hcmllcy9nZXJtYW5faGlyYWdhbmEuY3N2XCIsIGZ1bmN0aW9uKHJlc3VsdCl7XG5cdFx0XHR2YXIgb3B0aW9ucyA9IHtoZWFkZXI6dHJ1ZX07XG5cdFx0XHR2YXIgY3N2ID0gbmV3IENTVihyZXN1bHQsb3B0aW9ucykucGFyc2UoKTtcblxuXHRcdFx0aWYoQXJyYXkuaXNBcnJheShjc3YpICYmIGNzdi5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdHRoaXMuc2V0U3RhdGUoe1xuXHRcdFx0XHRcdHZvY2FibGVzOiBjc3Zcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fS5iaW5kKHRoaXMpKTtcblx0fSxcblxuXHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdGlmKHRoaXMuc3RhdGUudm9jYWJsZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0cmV0dXJuIChcblx0XHRcdFx0PGRpdj5cblx0XHRcdFx0XHQ8RGljdGlvbmFyeSB2b2NhYmxlcz17dGhpcy5zdGF0ZS52b2NhYmxlc31cblx0XHRcdFx0XHRpbml0aWFsUmV2ZWFsU3RhdGU9e3RoaXMucHJvcHMuaW5pdGlhbFJldmVhbFN0YXRlfSAgLz5cblx0XHRcdFx0PC9kaXY+XG5cdFx0XHQpXG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiAoXG5cdFx0XHRcdDxkaXY+XG5cdFx0XHRcdFx0PGJ1dHRvbiBvbkNsaWNrPXt0aGlzLmxvYWRWb2NhYmxlc30gdHlwZT1cImJ1dHRvblwiIGNsYXNzTmFtZT1cImJ0biBidG4tZGVmYXVsdFwiPkxvYWQgVm9jYWJsZXM8L2J1dHRvbj5cblx0XHRcdFx0PC9kaXY+XG5cdFx0XHQpXG5cdFx0fVxuXHR9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBEaWN0aW9uYXJ5Q2hvb3NlcjtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIERpY3Rpb25hcnlDaG9vc2VyID0gcmVxdWlyZShcIi4vRGljdGlvbmFyeUNob29zZXJcIik7XG52YXIgUmV2ZWFsT3JkZXJDb25maWcgPSByZXF1aXJlKFwiLi9SZXZlYWxPcmRlckNvbmZpZ1wiKTtcbnZhciBOaWhvbmdvQXBwID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuXG5cdGdldEluaXRpYWxTdGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGluaXRpYWxSZXZlYWxTdGF0ZTogJ3RyYW5zY3JpcHRpb24nXG5cdFx0fVxuXHR9LFxuXG5cdGNoYW5nZUluaXRpYWxSZXZlYWxTdGF0ZTogZnVuY3Rpb24obmV3U3RhdGUpIHtcblx0XHR0aGlzLnNldFN0YXRlKHtcblx0XHRcdGluaXRpYWxSZXZlYWxTdGF0ZTogbmV3U3RhdGVcblx0XHR9KVxuXHR9LFxuXG5cdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gKFxuXHRcdFx0XHQ8ZGl2PlxuXHRcdFx0XHRcdDxoMT5uaWhvbmdvPC9oMT5cblxuXHRcdFx0XHRcdDxkaXYgY2xhc3NOYW1lPVwicm93XCI+XG5cdFx0XHRcdFx0XHQ8ZGl2IGNsYXNzTmFtZT1cImNvbC1tZC04XCI+XG5cdFx0XHRcdFx0XHRcdDxEaWN0aW9uYXJ5Q2hvb3NlciBpbml0aWFsUmV2ZWFsU3RhdGU9e3RoaXMuc3RhdGUuaW5pdGlhbFJldmVhbFN0YXRlfSAvPlxuXHRcdFx0XHRcdFx0PC9kaXY+XG5cdFx0XHRcdFx0XHQ8ZGl2IGNsYXNzTmFtZT1cImNvbC1tZC00XCI+XG5cdFx0XHRcdFx0XHRcdDxSZXZlYWxPcmRlckNvbmZpZyBvblNlbGVjdD17dGhpcy5jaGFuZ2VJbml0aWFsUmV2ZWFsU3RhdGV9Lz5cblx0XHRcdFx0XHRcdDwvZGl2PlxuXHRcdFx0XHRcdDwvZGl2PlxuXG5cdFx0XHRcdDwvZGl2PlxuXHRcdFx0KVxuXHR9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBOaWhvbmdvQXBwO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgUmV2ZWFsT3JkZXJDb25maWcgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG5cblx0cHJvcFR5cGVzOiB7XG5cdFx0b25TZWxlY3Q6IFJlYWN0LlByb3BUeXBlcy5mdW5jXG5cdH0sXG5cblx0b25DaGFuZ2U6IGZ1bmN0aW9uKGV2ZW50KSB7XG5cdFx0aWYodGhpcy5wcm9wcy5vblNlbGVjdCkge1xuXHRcdFx0dGhpcy5wcm9wcy5vblNlbGVjdChldmVudC50YXJnZXQudmFsdWUpO1xuXHRcdH1cblx0fSxcblxuXHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiAoXG5cdFx0XHQ8ZGl2IGNsYXNzTmFtZT1cInBhbmVsIHBhbmVsLWRlZmF1bHRcIj5cblx0XHRcdCAgPGRpdiBjbGFzc05hbWU9XCJwYW5lbC1ib2R5XCI+XG5cblx0XHRcdFx0PHA+V2hhdCBzaG91bGQgYmUgcmV2ZWFsZWQgaW5pdGlhbGx5PzwvcD5cblxuXHRcdFx0XHQ8c2VsZWN0IGNsYXNzTmFtZT1cImZvcm0tY29udHJvbFwiIG9uQ2hhbmdlPXt0aGlzLm9uQ2hhbmdlfT5cblx0XHRcdFx0XHQ8b3B0aW9uIHZhbHVlPVwidHJhbnNjcmlwdGlvblwiPlRyYW5zY3JpcHRpb24gKGUuZy4gXCJuaWhvbmdvXCIpPC9vcHRpb24+XG5cdFx0XHRcdFx0PG9wdGlvbiB2YWx1ZT1cImthbmFcIj5LYW5hIChlLmcuIFwi44Gr44G744KT44GUXCIpPC9vcHRpb24+XG5cdFx0XHRcdFx0PG9wdGlvbiB2YWx1ZT1cInRyYW5zbGF0aW9uXCI+VHJhbnNsYXRpb24gKGUuZy4gXCJKYXBhbmVzZVwiKTwvb3B0aW9uPlxuXHRcdFx0XHQ8L3NlbGVjdD5cblx0XHRcdCAgPC9kaXY+XG5cdFx0XHQ8L2Rpdj5cblx0XHQpXG5cdH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJldmVhbE9yZGVyQ29uZmlnO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgVm9jYWJsZSA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcblx0Z2V0SW5pdGlhbFN0YXRlOiBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Y3VycmVudCA6IHRoaXMucHJvcHMuaW5pdGlhbFJldmVhbFN0YXRlXG5cdFx0fVxuXHR9LFxuXG5cdHByb3BUeXBlczoge1xuXHRcdHRyYW5zY3JpcHRpb246IFJlYWN0LlByb3BUeXBlcy5zdHJpbmcuaXNSZXF1aXJlZCxcblx0XHRrYW5hOiBSZWFjdC5Qcm9wVHlwZXMuc3RyaW5nLmlzUmVxdWlyZWQsXG5cdFx0dHJhbnNsYXRpb246IFJlYWN0LlByb3BUeXBlcy5zdHJpbmcuaXNSZXF1aXJlZCxcblxuXHRcdGluaXRpYWxSZXZlYWxTdGF0ZTogUmVhY3QuUHJvcFR5cGVzLm9uZU9mKFsndHJhbnNjcmlwdGlvbicsJ2thbmEnLCd0cmFuc2xhdGlvbiddKVxuXHR9LFxuXG5cdGdldERlZmF1bHRQcm9wczogZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGluaXRpYWxSZXZlYWxTdGF0ZTogJ3RyYW5zY3JpcHRpb24nXG5cdFx0fTtcblx0fSxcblxuXHRjb21wb25lbnRXaWxsUmVjZWl2ZVByb3BzOiBmdW5jdGlvbihuZXh0UHJvcHMpIHtcblx0XHR0aGlzLnNldFN0YXRlKHtcblx0XHRcdGN1cnJlbnQ6IG5leHRQcm9wcy5pbml0aWFsUmV2ZWFsU3RhdGVcblx0XHR9KVxuXHR9LFxuXG5cblx0Z2V0VGV4dDogZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuIHRoaXMucHJvcHNbdGhpcy5zdGF0ZS5jdXJyZW50XTtcblx0fSxcblx0cmV2ZWFsVm9jYWJsZTogZnVuY3Rpb24oKSB7XG5cdFx0c3dpdGNoKHRoaXMuc3RhdGUuY3VycmVudCkge1xuXHRcdFx0Y2FzZSBcInRyYW5zY3JpcHRpb25cIjpcblx0XHRcdFx0dGhpcy5zZXRTdGF0ZSh7Y3VycmVudDogXCJrYW5hXCJ9KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFwia2FuYVwiOlxuXHRcdFx0XHR0aGlzLnNldFN0YXRlKHtjdXJyZW50OiBcInRyYW5zbGF0aW9uXCJ9KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFwidHJhbnNsYXRpb25cIjpcblx0XHRcdFx0dGhpcy5zZXRTdGF0ZSh7Y3VycmVudDogXCJ0cmFuc2NyaXB0aW9uXCJ9KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXHR9LFxuXG5cdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHN0eWxlID0ge1xuXHRcdFx0Zm9udFNpemU6ICcyZW0nLFxuXHRcdFx0Zm9udFdlaWdodDogJ2JvbGQnXG5cdFx0fTtcblxuXHRcdHJldHVybihcblx0XHRcdDxkaXYgY2xhc3NOYW1lPVwicGFuZWwgcGFuZWwtZGVmYXVsdCBjb2wtbWQtNlwiPlxuXHRcdFx0XHQ8ZGl2IGNsYXNzTmFtZT1cInBhbmVsLWJvZHlcIj5cblx0XHRcdFx0XHQ8c3Bhbj57dGhpcy5zdGF0ZS5jdXJyZW50fTo8L3NwYW4+XG5cdFx0XHRcdFx0PGJyLz5cblx0XHRcdFx0XHQ8c3BhbiBpZD1cInRleHRcIiBzdHlsZT17c3R5bGV9Pnt0aGlzLmdldFRleHQoKX08L3NwYW4+XG5cdFx0XHRcdFx0PGJ1dHRvbiBvbkNsaWNrPXt0aGlzLnJldmVhbFZvY2FibGV9IHR5cGU9XCJidXR0b25cIiBjbGFzc05hbWU9XCJidG4gYnRuLXByaW1hcnkgcHVsbC1yaWdodFwiPlJldmVhbDwvYnV0dG9uPlxuXHRcdFx0XHQ8L2Rpdj5cblx0XHRcdDwvZGl2PlxuXHRcdClcblx0fVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gVm9jYWJsZTtcbiJdfQ==
