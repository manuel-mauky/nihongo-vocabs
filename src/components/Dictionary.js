"use strict";

var React = require("react");

var Vocable = require("./Vocable");

var Dictionary = React.createClass({

	propTypes: {
		vocables: React.PropTypes.arrayOf(React.PropTypes.shape({
			kana: React.PropTypes.string,
			transcription: React.PropTypes.string,
			translation: React.PropTypes.string
		})).isRequired,

		initialRevealState: React.PropTypes.oneOf(["transcription","kana","translation"])
	},

	getDefaultProps: function() {
		return {
			initialRevealState: "transcription"
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
				currentVocable: nextVocable[0]
			});

		} else {
			this.setState({
				currentVocable: null
			});
		}
	},

	render: function() {
		var vocable = this.state.currentVocable ?
						<Vocable kana={this.state.currentVocable.kana}
								transcription={this.state.currentVocable.transcription}
								translation={this.state.currentVocable.translation}
								initialRevealState={this.props.initialRevealState} />
						: null;

		return (
			<div>
				<button onClick={this.next} type="button" className="btn btn-primary">Next</button>
				<div>
					{vocable}
				</div>
			</div>
		)
	}
});

module.exports = Dictionary;