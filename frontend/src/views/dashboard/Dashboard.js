import React from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
} from '@coreui/react'
import GraphView from '../../components/fetch/GraphView'

const Dashboard = () => {
  return (
    <>
      <CCard className="mb-4">
        <CCardBody>
          <GraphView />
        </CCardBody>
      </CCard>
    </>
  )
}

export default Dashboard
