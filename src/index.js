import React from "react"
import ReactDOM from "react-dom"
import NihongoApp from "./components/NihongoApp"
import registerServiceWorker from "./registerServiceWorker"

import "bootstrap/dist/css/bootstrap.css"
import "bootstrap/dist/css/bootstrap-theme.css"

ReactDOM.render(<NihongoApp />, document.getElementById("root"))
registerServiceWorker()
