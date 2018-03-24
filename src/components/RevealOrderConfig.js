// @flow

import React from "react"

import type { RevealState } from "./NihongoApp"

type Props = {
  onSelect: (newState: RevealState) => void,
}

const RevealOrderConfig = (props: Props) => (
  <div>
    <p>What should be revealed initially?</p>

    <select className="form-control" onChange={event => props.onSelect(event.target.value)}>
      <option value="transcription">Transcription (e.g. "nihongo")</option>
      <option value="kana">Kana (e.g. "にほんご")</option>
      <option value="translation">Translation (e.g. "Japanese")</option>
    </select>
  </div>
)

export default RevealOrderConfig
