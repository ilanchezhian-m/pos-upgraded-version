import { useEffect, useState } from 'react'
import { listPrintJobs, updatePrintStatus } from '../lib/db'
import '../App.css'

function PrintQueuePage() {
  const [prints, setPrints] = useState([])

  useEffect(() => {
    const fetchData = async () => {
      const p = await listPrintJobs()
      setPrints(p)
    }
    fetchData()
    const interval = setInterval(fetchData, 3000)
    return () => clearInterval(interval)
  }, [])

  async function handleMarkPrinted(jobId) {
    await updatePrintStatus(jobId, 'done')
    setPrints((prev) => prev.map((p) => (p.id === jobId ? { ...p, status: 'done' } : p)))
  }

  return (
    <div className="board">
      <section className="panel" style={{ width: '100%', maxWidth: '1200px', margin: '20px auto' }}>
          <h2>Print Queue</h2>
          <p className="panel-subtitle">PC listens on LAN, triggers browser print/helper.</p>
          <div className="list">
            {prints.length === 0 && <div className="muted">No print jobs.</div>}
            {prints.map((job) => (
              <div key={job.id} className="list-item">
                <div>
                  <div><strong>{job.type}</strong> • ref {job.refId?.slice(0, 6)}</div>
                  <div className="muted">{job.status}</div>
                  <div className="muted" style={{ fontSize: '11px' }}>
                    {new Date(job.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="toolbar">
                  <span className="tag">{job.synced ? 'synced' : 'queued'}</span>
                  {job.status !== 'done' && (
                    <button className="button secondary" type="button" onClick={() => handleMarkPrinted(job.id)}>
                      Mark Printed
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
    </div>
  )
}

export default PrintQueuePage

