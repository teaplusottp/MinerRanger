import React, { useEffect, useState, useRef } from 'react'
import { CCard, CCardBody, CCol, CRow } from '@coreui/react'
import { CChartLine } from '@coreui/react-chartjs'
import { getStyle } from '@coreui/utils'

const WidgetsDropdown = () => {
  const [stats, setStats] = useState(null)
  const widgetChartRef1 = useRef(null)
  const widgetChartRef2 = useRef(null)
  const widgetChartRef3 = useRef(null)
  const widgetChartRef4 = useRef(null)

  useEffect(() => {
    fetch('http://localhost:8000/stats')
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch((err) => console.error(err))
  }, [])

  if (!stats) {
    return <div>Loading...</div>
  }

  return (
    <CRow>
      {/* Users */}
      <CCol sm={6} lg={3}>
        <CCard className="mb-4" color="primary" textColor="white" >
          <CCardBody>
            <div className="fs-4 fw-semibold">{stats.users.value.toLocaleString()}{" "}
  <span className="fs-6 fw-normal">
    ({stats.users.change}% {stats.users.change < 0 ? '↓' : '↑'})
  </span>
              
            </div>
            <div>Users</div>
          </CCardBody>
          <CChartLine
            ref={widgetChartRef1}
            className="mt-3 mx-3"
            style={{ height: '70px' }}
            data={{
              labels: Array(stats.users.data.length).fill(''),
              datasets: [
                {
                  label: 'Users',
                  backgroundColor: 'transparent',
                  borderColor: 'rgba(255,255,255,.55)',
                  pointBackgroundColor: getStyle('--cui-primary'),
                  data: stats.users.data,
                },
              ],
            }}
            options={{
              plugins: { legend: { display: false } },
              maintainAspectRatio: false,
              scales: { x: { display: false }, y: { display: false } },
              elements: {
                line: { borderWidth: 1, tension: 0.4 },
                point: { radius: 0, hitRadius: 10, hoverRadius: 4 },
              },
            }}
          />
        </CCard>
      </CCol>

      {/* Income */}
      <CCol sm={6} lg={3}>
        <CCard className="mb-4"  color="info" textColor="white">
          <CCardBody>
            <div className="fs-4 fw-semibold">${stats.income.value}{" "}
                <span className="fs-6 fw-normal">
    ({stats.income.change}% {stats.income.change < 0 ? '↓' : '↑'})
  </span>
            </div>
            <div>Income</div>
          </CCardBody>
          <CChartLine
            ref={widgetChartRef2}
            className="mt-3 mx-3"
            style={{ height: '70px' }}
            data={{
              labels: Array(stats.income.data.length).fill(''),
              datasets: [
                {
                  label: 'Income',
                  backgroundColor: 'transparent',
                  borderColor: 'rgba(255,255,255,.55)',
                  pointBackgroundColor: getStyle('--cui-info'),
                  data: stats.income.data,
                },
              ],
            }}
            options={{
              plugins: { legend: { display: false } },
              maintainAspectRatio: false,
              scales: { x: { display: false }, y: { display: false } },
              elements: {
                line: { borderWidth: 1, tension: 0.4 },
                point: { radius: 0, hitRadius: 10, hoverRadius: 4 },
              },
            }}
          />
        </CCard>
      </CCol>

      {/* Conversion */}
      <CCol sm={6} lg={3}>
        <CCard className="mb-4"  color="warning" textColor="white">
          <CCardBody>
            <div className="fs-4 fw-semibold">{stats.conversion.value}%{" "}
  <span className="fs-6 fw-normal">
    ({stats.conversion.change}% {stats.conversion.change < 0 ? '↓' : '↑'})
  </span>

            </div>
            <div>Conversion</div>
          </CCardBody>
          <CChartLine
            ref={widgetChartRef3}
            className="mt-3 mx-3"
            style={{ height: '70px' }}
            data={{
              labels: Array(stats.conversion.data.length).fill(''),
              datasets: [
                {
                  label: 'Conversion',
                  backgroundColor: 'transparent',
                  borderColor: 'rgba(255,255,255,.55)',
                  pointBackgroundColor: getStyle('--cui-warning'),
                  data: stats.conversion.data,
                },
              ],
            }}
            options={{
              plugins: { legend: { display: false } },
              maintainAspectRatio: false,
              scales: { x: { display: false }, y: { display: false } },
              elements: {
                line: { borderWidth: 1, tension: 0.4 },
                point: { radius: 0, hitRadius: 10, hoverRadius: 4 },
              },
            }}
          />
        </CCard>
      </CCol>

      {/* Sessions */}
      <CCol sm={6} lg={3}>
        <CCard className="mb-4" color="success" textColor="white" >
          <CCardBody>
            <div className="fs-4 fw-semibold">
              {stats.sessions.value.toLocaleString()}{' '}
              <span className="fs-6 fw-normal">
              ({stats.sessions.change}% {stats.sessions.change < 0 ? '↓' : '↑'})
            </span>
              </div>
           
            <div>Sessions</div>
          </CCardBody>
          <CChartLine
            ref={widgetChartRef4}
            className="mt-3 mx-3"
            style={{ height: '70px' }}
            data={{
              labels: Array(stats.sessions.data.length).fill(''),
              datasets: [
                {
                  label: 'Sessions',
                  backgroundColor: 'transparent',
                  borderColor: 'rgba(255,255,255,.55)',
                  pointBackgroundColor: getStyle('--cui-success'),
                  data: stats.sessions.data,
                },
              ],
            }}
            options={{
              plugins: { legend: { display: false } },
              maintainAspectRatio: false,
              scales: { x: { display: false }, y: { display: false } },
              elements: {
                line: { borderWidth: 1, tension: 0.4 },
                point: { radius: 0, hitRadius: 10, hoverRadius: 4 },
              },
            }}
          />
        </CCard>
      </CCol>
    </CRow>
  )
}

export default WidgetsDropdown
