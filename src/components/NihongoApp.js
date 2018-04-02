// @flow

import React from "react"

import Vocable from "./Vocable"

import RevealOrderConfig from "./RevealOrderConfig"

import CSV from "comma-separated-values"

import './NihongoApp.css'

export type RevealState = "transcription" | "kana" | "translation"

export type Vocab = {
  [RevealState]: string,
}

type State = {
  revealState: RevealState,
  initialRevealState: RevealState,
  vocabs: Array<Vocab>,
  vocabsLeft: Array<Vocab>,
  currentVocab: ?Vocab,
}

export default class NihongoApp extends React.Component<any, State> {
  state = {
    revealState: "translation",
    initialRevealState: "translation",
    vocabs: [],
    vocabsLeft: [],
    currentVocab: null,
  }

  componentDidMount = () => {
    fetch("dictionaries/german_hiragana.csv")
      .then(result => result.text())
      .then(result => {
        const options = { header: true }
        const csv: Array<Vocab> = new CSV(result, options).parse()

        if (Array.isArray(csv) && csv.length > 0) {
          const nextVocable = this.computeNextVocab(csv)

          this.setState({
            currentVocab: nextVocable,
            vocabs: csv,
          })
        }
      })
  }

  changeInitialRevealState = (newState: RevealState) => {
    this.setState({
      initialRevealState: newState,
    })
  }

  changeRevealState = () => {
    this.setState(state => {
      switch (this.state.revealState) {
        case "transcription":
          this.setState({ revealState: "kana" })
          break
        case "kana":
          this.setState({ revealState: "translation" })
          break
        case "translation":
          this.setState({ revealState: "transcription" })
          break
        default:
          this.setState({ revealState: this.state.initialRevealState })
      }
    })
  }

  computeNextVocab(vocableList: Array<Vocab>): Vocab {
    const i = Math.floor(Math.random() * vocableList.length)

    return vocableList.splice(i, 1)[0]
  }

  nextVocab = () => {
    let vocablesLeft

    if (this.state.vocabsLeft.length === 0) {
      vocablesLeft = this.state.vocabs
    } else {
      vocablesLeft = this.state.vocabsLeft
    }

    if (vocablesLeft.length > 0) {
      const nextVocable = this.computeNextVocab(vocablesLeft)

      this.setState(state => ({
        vocabsLeft: vocablesLeft,
        currentVocab: nextVocable,
        revealState: state.initialRevealState,
      }))
    } else {
      this.setState({
        currentVocab: null,
      })
    }
  }

  render() {
    return (
      <div className="container">
        <h1>Nihongo Vocabs</h1>

        {this.state.currentVocab ? (
          <div className="panel panel-default">
            <div className="panel-body">

              <div className="main-box">
                <div className="vocab-box">
                  <Vocable vocab={this.state.currentVocab} revealState={this.state.revealState} />
                </div>

                <div className="button-box">
                  <button onClick={this.changeRevealState} type="button" className="btn btn-primary">
                    Reveal
                  </button>
                  <button onClick={this.nextVocab} type="button" className="btn btn-primary">
                    Next
                  </button>
                </div>
                </div>
            </div>
          </div>
        ) : null}
        <div className="panel panel-default">
          <div className="panel-body">
            <RevealOrderConfig onSelect={this.changeInitialRevealState} />
          </div>
        </div>
      </div>
    )
  }
}
