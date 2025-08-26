import React, { useEffect, useState } from "react"
import { CSpinner } from "@coreui/react"

function GraphView() {
  const [graphUrl, setGraphUrl] = useState(null)

  useEffect(() => {
    fetch("http://localhost:8000/graph")
      .then((res) => res.blob())
      .then((blob) => {
        setGraphUrl(URL.createObjectURL(blob))
      })
      .catch((err) => console.error("Error fetching graph:", err))
  }, [])

  if (!graphUrl) {
    return <CSpinner color="primary" />
  }

  return <img src={graphUrl} alt="Graphviz" style={{ maxWidth: "100%" }} />
}

export default GraphView
