'use strict';

var Vocable = React.createClass({
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
			<div className="panel panel-default col-md-6">
				<div className="panel-body">
					<span>{this.state.current}:</span>
					<br/>
					<span id="text" style={style}>{this.getText()}</span>
					<button onClick={this.revealVocable} type="button" className="btn btn-primary pull-right">Reveal</button>
				</div>
			</div>
		)
	}
});

module.exports = Vocable;
