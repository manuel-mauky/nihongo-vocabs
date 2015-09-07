"use strict";


var React = require("react");

var $ = require("jquery");

var Dictionary = require("./Dictionary");
var CSV = require("comma-separated-values");

var DictionaryChooser = React.createClass({

	propTypes: {
		initialRevealState: React.PropTypes.oneOf(["transcription","kana","translation"])
	},

	getDefaultProps: function() {
		return {
			initialRevealState: "transcription"
		};
	},

	getInitialState: function() {
		return {
			vocables: []
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
				<div>
					<Dictionary vocables={this.state.vocables}
					initialRevealState={this.props.initialRevealState}  />
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
