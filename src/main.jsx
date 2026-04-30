import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { cacheService } from './services/cacheService'
import { caseService } from './services/caseService'

cacheService.installAutoReplay({ runOp: op => caseService._replayOp(op) })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
)
