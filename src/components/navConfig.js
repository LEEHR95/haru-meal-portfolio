import { IconBook, IconHeart, IconHome, IconUser } from './icons/index.jsx'
import { ROUTES } from '../routes.js'

export const NAV_TABS = [
  { key: 'home', label: '홈', path: ROUTES.home, icon: IconHome },
  { key: 'feed', label: '레시피', path: ROUTES.feed, icon: IconBook },
  { key: 'bookmark', label: '보관함', path: `${ROUTES.feed}?mode=bookmark`, icon: IconHeart },
  { key: 'profile', label: '프로필', path: ROUTES.profile, icon: IconUser },
]
