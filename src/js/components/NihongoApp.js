'use strict';

var DictionaryChooser = require("./DictionaryChooser");

var NihongoApp = React.createClass({

	render: function() {
			return (
				<div>
					<h1>nihongo</h1>
					<DictionaryChooser />
				</div>
			)
	}
});

module.exports = NihongoApp;
