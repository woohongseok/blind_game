import { Routes, Route } from 'react-router-dom'
import { HomePage } from '@ui/pages/home/HomePage'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
    </Routes>
  )
}
