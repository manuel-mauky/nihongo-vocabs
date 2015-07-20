'use strict';

var Dictionary = require("./Dictionary");
var CSV = require('comma-separated-values');

var DictionaryChooser = React.createClass({

	getInitialState: function() {
		return {
			vocables: [],
		}
	},

	loadVocables: function() {
		$.get("german_hiragana.csv", function(result){
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
				<div>
					<Dictionary vocables={this.state.vocables} />
				</div>
			)
		} else {
			return (
				<div>
					<button onClick={this.loadVocables} type="button" className="btn btn-default">Load Vocables</button>
				</div>
			)
		}
	}
});

module.exports = DictionaryChooser;