// @flow

import React from "react"

import type { Vocab, RevealState } from './NihongoApp'

type Props = {
  vocab: Vocab,
  revealState: RevealState,
  revealVocable: () => void
}

const style = {
  fontSize: "2em",
  fontWeight: "bold",
}


const Vocable = (props: Props) => (
  <div className="panel panel-default col-md-6">
    <div className="panel-body">
      <span>{props.revealState}:</span>
      <br />
      <span id="text" style={style}>
        {props.vocab[props.revealState]}
      </span>
      <button onClick={props.revealVocable} type="button" className="btn btn-primary pull-right">
        Reveal
      </button>
    </div>
  </div>
)

export default Vocable
