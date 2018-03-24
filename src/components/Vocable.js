// @flow

import React from "react"

import type { Vocab, RevealState } from './NihongoApp'

type Props = {
  vocab: Vocab,
  revealState: RevealState
}

const style = {
  fontSize: "2em",
  fontWeight: "bold",
}


const Vocable = (props: Props) => (
  <div>
      <span>{props.revealState}:</span>
      <br />
      <span id="text" style={style}>
        {props.vocab[props.revealState]}
      </span>
  </div>
)

export default Vocable
