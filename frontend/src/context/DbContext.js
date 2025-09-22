// DbContext.js
import React, { createContext, useState, useContext } from "react"

const DbContext = createContext()

export const DbProvider = ({ children }) => {
  const [selectedDb, setSelectedDb] = useState("")
  return (
    <DbContext.Provider value={{ selectedDb, setSelectedDb }}>
      {children}
    </DbContext.Provider>
  )
}

export const useDb = () => useContext(DbContext)
