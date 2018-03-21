import React from "react"

import DictionaryChooser from "./DictionaryChooser"
import RevealOrderConfig from "./RevealOrderConfig"

export default class NihongoApp extends React.Component {
  constructor() {
    super()
    this.state = {
      initialRevealState: "transcription",
    }
  }

  changeInitialRevealState = newState => {
    this.setState({
      initialRevealState: newState,
    })
  }

  render() {
    return (
      <div className="container">
        <div>
          <h1>nihongo</h1>

          <div className="row">
            <div className="col-md-8">
              <DictionaryChooser initialRevealState={this.state.initialRevealState} />
            </div>
            <div className="col-md-4">
              <RevealOrderConfig onSelect={this.changeInitialRevealState} />
            </div>
          </div>
        </div>
      </div>
    )
  }
}
