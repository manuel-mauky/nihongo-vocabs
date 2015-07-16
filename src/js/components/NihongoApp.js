'use strict';

var Dictionary = require("./Dictionary");

var NihongoApp = React.createClass({

	render: function() {
			return (
				<div>
					<h1>nihongo</h1>
					<Dictionary />
				</div>
			)
	}
});

module.exports = NihongoApp;
