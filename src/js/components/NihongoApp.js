'use strict';

var DictionaryChooser = require("./DictionaryChooser");
var RevealOrderConfig = require("./RevealOrderConfig");
var NihongoApp = React.createClass({

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
				<div>
					<h1>nihongo</h1>

					<div className="row">
						<div className="col-md-8">
							<DictionaryChooser initialRevealState={this.state.initialRevealState} />
						</div>
						<div className="col-md-4">
							<RevealOrderConfig onSelect={this.changeInitialRevealState}/>
						</div>
					</div>

				</div>
			)
	}
});

module.exports = NihongoApp;
