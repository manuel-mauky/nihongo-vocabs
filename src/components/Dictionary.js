import React from "react"
import PropTypes from "prop-types"
import Vocable from './Vocable'

export default class Dictionary extends React.Component {

	static defaultProps = {
		initialRevealState: "transcription"
	}

	static propTypes = {
		vocables: PropTypes.arrayOf(PropTypes.shape({
			kana: PropTypes.string,
			transcription: PropTypes.string,
			translation: PropTypes.string
		})).isRequired,

		initialRevealState: PropTypes.oneOf(["transcription","kana","translation"])
	}

	constructor() {
		super()
		this.state = {
			currentVocable: null,
			vocablesLeft: []
		}
	}

	componentWillMount() {
		this.next();
	}

	next = () => {
		var vocablesLeft;

		if(this.state.vocablesLeft.length === 0) {
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
	}

	render() {
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
}
