import React from "react";
import PropTypes from "prop-types"

export default class Vocable extends React.Component {

	constructor(props) {
		super()
		this.state = {
			current : props.initialRevealState
		}
	}

	static propTypes = {
		transcription: PropTypes.string.isRequired,
		kana: PropTypes.string.isRequired,
		translation: PropTypes.string.isRequired,

		initialRevealState: PropTypes.oneOf(["transcription","kana","translation"])
	}

	static defaultProps = {
			initialRevealState: "transcription"
	}

	componentWillReceiveProps(nextProps) {
		this.setState({
			current: nextProps.initialRevealState
		})
	}


	getText() {
		return this.props[this.state.current];
	}

	revealVocable = () => {
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
		default:
			this.setState({current: this.props.initialRevealState})
		}
	}

	render() {
		var style = {
			fontSize: "2em",
			fontWeight: "bold"
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
}
