import Link from 'next/link'
import { ArrowRight, CircleHelp, Database, Info } from 'lucide-react'

export function PageHeading({ eyebrow, title, description, actions }) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}

export function DataConnectionNotice({ title = 'Live data isn’t connected in this preview' }) {
  return (
    <div className="data-warning" role="status">
      <Database size={18} />
      <div>
        <strong>{title}</strong>
        This independent frontend has no authenticated API session configured. It won’t show sample operational data or report actions as successful.
      </div>
    </div>
  )
}

export function EmptyState({ icon: Icon = Info, title, children }) {
  return (
    <div className="empty-state">
      <div>
        <div className="empty-state-icon"><Icon size={19} /></div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  )
}

export function ActionLink({ href, icon: Icon, children }) {
  return (
    <Link href={href} className="action-link">
      <span className="action-link-label">
        <span className="action-link-icon"><Icon size={16} /></span>
        <span>{children}</span>
      </span>
      <ArrowRight size={15} />
    </Link>
  )
}

export function HelpNote({ children }) {
  return <div className="data-warning"><CircleHelp size={17} /><div>{children}</div></div>
}
