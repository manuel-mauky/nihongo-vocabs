'use strict';

class Vocable extends React.Component {
	constructor() {
		super()
		this.state = {
			vocable: {
				kana: "ほん",
				transcription: "hon",
				translation: "Book"
			},
			kanaVisible: true,
			transcriptionVisible: false,
			translationVisiblle: false
		};
	}

	render() {
		return(
			<div>
				<p>{this.state.vocable.kana}</p>
				<p>{this.state.vocable.transcription}</p>
				<p>{this.state.vocable.translation}</p>
			</div>
		)
	}
}

export default Vocable;
