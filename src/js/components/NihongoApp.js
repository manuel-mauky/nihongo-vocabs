'use strict';

var Vocable = require("./Vocable");

var NihongoApp = React.createClass({
	render() {
			return (
				<div>
					<h1>nihongo</h1>
					<Vocable kana="ほん" transcription="hon" translation="book"/>
				</div>
			)
	}
});

module.exports = NihongoApp;
