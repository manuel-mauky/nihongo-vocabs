import React from "react"
import PropTypes from "prop-types"

import $ from "jquery"

import Dictionary from "./Dictionary"
import CSV from "comma-separated-values";

export default class DictionaryChooser extends React.Component {

	static defaultProps = {
		initialRevealState: "transcription"
	}

	static propTypes = {
		initialRevealState: PropTypes.oneOf(["transcription","kana","translation"])
	}

	constructor() {
		super()
		this.state = {
			vocables: []
		}
	}

	loadVocables = () => {
		$.get("dictionaries/german_hiragana.csv", function(result){
			var options = {header:true};
			var csv = new CSV(result,options).parse();

			if(Array.isArray(csv) && csv.length > 0) {
				this.setState({
					vocables: csv
				});
			}
		}.bind(this));
	}

	render() {
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
}
