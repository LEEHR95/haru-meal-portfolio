import { Icon } from './Icon.jsx'

export function IconSearch(props) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Icon>
  )
}

export function IconBack(props) {
  return (
    <Icon {...props}>
      <path d="M15 5 8 12l7 7" />
    </Icon>
  )
}

export function IconClose(props) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  )
}

export function IconPlus(props) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  )
}

export function IconHeart({ filled = false, size = 20, color = 'currentColor', style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : 'none'}
      stroke={color}
      strokeWidth="1.8"
      strokeLinejoin="round"
      strokeLinecap="round"
      style={{ display: 'block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path d="M12 20.5s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7.5a4.5 4.5 0 0 1 7.5 3c0 5.4-7.5 10-7.5 10Z" />
    </svg>
  )
}

export function IconHome({ filled = false, size = 22, color = 'currentColor', style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : 'none'}
      stroke={color}
      strokeWidth="1.8"
      strokeLinejoin="round"
      strokeLinecap="round"
      style={{ display: 'block', ...style }}
      aria-hidden="true"
    >
      <path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1Z" />
    </svg>
  )
}

export function IconBook({ filled = false, size = 22, color = 'currentColor', style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : 'none'}
      stroke={color}
      strokeWidth="1.8"
      strokeLinejoin="round"
      strokeLinecap="round"
      style={{ display: 'block', ...style }}
      aria-hidden="true"
    >
      <path d="M5 4h9a4 4 0 0 1 4 4v12H9a4 4 0 0 0-4 4V4Z" />
      <path d="M5 4v16" />
    </svg>
  )
}

export function IconChat({ filled = false, size = 22, color = 'currentColor', style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : 'none'}
      stroke={color}
      strokeWidth="1.8"
      strokeLinejoin="round"
      strokeLinecap="round"
      style={{ display: 'block', ...style }}
      aria-hidden="true"
    >
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-4 3v-3H6a2 2 0 0 1-2-2Z" />
    </svg>
  )
}

export function IconUser({ filled = false, size = 22, color = 'currentColor', style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : 'none'}
      stroke={color}
      strokeWidth="1.8"
      strokeLinejoin="round"
      strokeLinecap="round"
      style={{ display: 'block', ...style }}
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  )
}

export function IconSend(props) {
  return (
    <Icon {...props}>
      <path d="M5 12 20 5l-5 15-3-7-7-1Z" />
    </Icon>
  )
}

export function IconCamera(props) {
  return (
    <Icon {...props}>
      <path d="M4 8h3l2-2h6l2 2h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.5" />
    </Icon>
  )
}

export function IconChevron({ dir = 'down', size = 16, color = 'currentColor' }) {
  const r = { down: 0, up: 180, left: 90, right: -90 }[dir] ?? 0
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: `rotate(${r}deg)`, display: 'block' }}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function IconAlert(props) {
  return (
    <Icon {...props}>
      <path d="M12 3 2 21h20L12 3Z" />
      <path d="M12 10v5M12 18.5v.1" />
    </Icon>
  )
}

export function IconCheck(props) {
  return (
    <Icon {...props}>
      <path d="m4 12 5 5L20 6" />
    </Icon>
  )
}

export function IconBulb(props) {
  return (
    <Icon {...props}>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-4 10.5c.7.6 1 1.3 1 2v.5h6V15.5c0-.7.3-1.4 1-2A6 6 0 0 0 12 3Z" />
    </Icon>
  )
}

export function IconSparkle(props) {
  return (
    <Icon {...props}>
      <path d="M12 3v6M12 15v6M3 12h6M15 12h6M5.5 5.5l3.5 3.5M15 15l3.5 3.5M5.5 18.5 9 15M15 9l3.5-3.5" />
    </Icon>
  )
}

export function IconCopy(props) {
  return (
    <Icon {...props}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Icon>
  )
}
