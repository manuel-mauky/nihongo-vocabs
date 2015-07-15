'use strict';

var Vocable = React.createClass({
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
			<div className="panel panel-default col-md-6">
				<div className="panel-body">
					<span>{this.state.current}:</span>
					<br/>
					<span id="text" style={style}>{this.getText()}</span>
					<button onClick={this.switchVocable} type="button" className="btn btn-primary pull-right">Switch</button>
				</div>
			</div>
		)
	}
});

module.exports = Vocable;
