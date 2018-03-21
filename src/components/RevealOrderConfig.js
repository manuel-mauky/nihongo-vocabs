import React from "react";
import PropTypes from "prop-types"

export default class RevealOrderConfig extends React.Component {

	static propTypes = {
		onSelect: PropTypes.func
	}

	onChange(event) {
		if(this.props.onSelect) {
			this.props.onSelect(event.target.value);
		}
	}

	render() {
		return (
			<div className="panel panel-default">
				<div className="panel-body">
					<p>What should be revealed initially?</p>

					<select className="form-control" onChange={this.onChange}>
						<option value="transcription">Transcription (e.g. "nihongo")</option>
						<option value="kana">Kana (e.g. "にほんご")</option>
						<option value="translation">Translation (e.g. "Japanese")</option>
					</select>
				</div>
			</div>
		)
	}
}
