import { useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar.jsx'

export default function LegalPageLayout({ title, children }) {
  const navigate = useNavigate()

  return (
    <div className="legal-page">
      <TopBar title={title} onBack={() => navigate(-1)} className="pc-narrow-header" />
      <div className="legal-page__body">{children}</div>
    </div>
  )
}
