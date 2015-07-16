'use strict';

var Vocable = require("./Vocable");
var CSV = require('comma-separated-values');

var Dictionary = React.createClass({

	getInitialState: function() {
		return {
			vocables: [],
			vocableToShow: null,
			loadingComplete: false
		}
	},

	loadVocables: function() {
		$.get("german_hiragana.csv", function(result){
			var options = {header:true};
			var csv = new CSV(result,options).parse();

			if(Array.isArray(csv) && csv.length > 0) {

				var i = Math.floor(Math.random() * csv.length);
				var nextVocable = csv.splice(i, 1);

				this.setState({
					vocables: csv,
					vocableToShow:nextVocable[0],
					loadingComplete:true
				});
			}
		}.bind(this));
	},

	nextVocable: function() {
		var allVocables = this.state.vocables;

		if(allVocables.length > 0) {
			var i = Math.floor(Math.random() * allVocables.length);

			var nextVocable = allVocables.splice(i, 1);

			this.setState({
				vocables: allVocables,
				vocableToShow:nextVocable[0],
			});
		} else {
			this.setState({
				vocableToShow:null
			})
		}
	},

	render: function() {
		var nextVocable = this.state.vocableToShow;
		var vocable = nextVocable ?
						<Vocable kana={nextVocable.kana} transcription={nextVocable.transcription} translation={nextVocable.translation} />
						: null;


		var button;
		if(this.state.loadingComplete) {
			if(this.state.vocables.length > 0) {
				button = <button onClick={this.nextVocable} type="button" className="btn btn-primary">Next (left: {this.state.vocables.length})</button>;
			} else {
				button = <button onClick={this.loadVocables} type="button" className="btn btn-default">Reload Vocables</button>;
			}
		} else {
			button = <button onClick={this.loadVocables} type="button" className="btn btn-default">Load Vocables</button>;
		}

		return (
			<div>
				{button}
				<div>
					{vocable}
				</div>
			</div>
		)
	}
});

module.exports = Dictionary;
