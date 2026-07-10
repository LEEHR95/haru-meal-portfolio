import { Link } from 'react-router-dom'
import LegalPageLayout from './LegalPageLayout.jsx'
import { DISCLAIMER_TEXT } from '../components/Disclaimer.jsx'
import { ROUTES } from '../routes.js'

const EFFECTIVE_DATE = '2026년 5월 22일'

export default function TermsPage() {
  return (
    <LegalPageLayout title="이용약관">
      <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 0 }}>
        시행일: {EFFECTIVE_DATE}
      </p>

      <h2>1. 서비스 개요</h2>
      <p>
        하루한끼(이하 &quot;서비스&quot;)는 반려견 보호자가 냉장고 재료의 안전성을 확인하고,
        맞춤 레시피·급여량·급여 상담 정보를 참고할 수 있도록 돕는 웹 서비스입니다.
        서비스는 Rule 기반 안전성 검증과 AI 설명을 결합하여 정보를 제공합니다.
      </p>

      <h2>2. 회원 가입 및 이용</h2>
      <ul>
        <li>일부 기능은 비회원(임시 프로필)으로 이용할 수 있습니다.</li>
        <li>회원 가입은 Google 계정을 통한 OAuth 로그인으로 진행됩니다.</li>
        <li>타인의 정보를 도용하거나 서비스를 부정 이용해서는 안 됩니다.</li>
      </ul>

      <h2>3. 면책 조항</h2>
      <p>
        <strong>{DISCLAIMER_TEXT}</strong>
      </p>
      <ul>
        <li>서비스가 제공하는 재료 안전성·급여량·레시피·AI 상담 답변은 <strong>참고용</strong>이며, 수의학적 진단·처방·치료를 대체하지 않습니다.</li>
        <li>AI 및 Rule 검증 결과는 데이터·입력 정보에 따라 오류가 있을 수 있으며, 최종 급여 결정은 보호자와 수의사의 판단에 따릅니다.</li>
        <li>위험 재료(레이어1)는 서비스에서 차단하나, 데이터 갱신 지연·오입력 등으로 누락될 수 있어 반드시 수의사와 상담하시기 바랍니다.</li>
        <li>서비스 이용으로 발생한 건강 문제·손해에 대해 회사는 고의 또는 중대한 과실이 없는 한 책임을 지지 않습니다.</li>
      </ul>

      <h2>4. 콘텐츠 및 지식재산</h2>
      <ul>
        <li>서비스 UI·문구·데이터베이스 구조 등은 회사 또는 정당한 권리자에게 귀속됩니다.</li>
        <li>서비스 내 일부 아이콘·시각 자료는 생성형 AI를 활용해 제작될 수 있습니다.</li>
        <li>이용자가 등록한 레시피·이미지 등은 본인이 작성했거나 이용 권한을 보유한 콘텐츠여야 합니다. 타인의 저작권·상표권·초상권 등을 침해하는 콘텐츠는 등록할 수 없습니다.</li>
        <li>이용자가 등록한 콘텐츠는 서비스 운영·개선 목적으로 이용될 수 있습니다.</li>
      </ul>

      <h2>5. 서비스 변경·중단</h2>
      <p>
        회사는 운영상·기술상 필요에 따라 서비스의 전부 또는 일부를 변경·중단할 수 있으며,
        중요한 변경 시 사전에 공지합니다.
      </p>

      <h2>6. 이용 제한 및 계약 해지</h2>
      <p>
        약관 위반, 불법·부적절한 이용이 확인되면 이용을 제한하거나 계정을 해지할 수 있습니다.
        이용자는 언제든지 탈퇴 또는{' '}
        <Link to={`${ROUTES.contact}?type=account_delete_request`} style={{ color: 'var(--primary)' }}>데이터 삭제 요청</Link>
        을 통해 이용 계약을 종료할 수 있습니다.
      </p>

      <h2>7. 준거법 및 분쟁</h2>
      <p>
        본 약관은 대한민국 법령에 따르며, 분쟁 발생 시 회사 소재지 관할 법원을 전속 관할로 합니다.
      </p>

      <h2>8. 문의</h2>
      <p>
        서비스·약관 관련 문의:{' '}
        <a href="mailto:harumeal.team@gmail.com" style={{ color: 'var(--primary)' }}>
          harumeal.team@gmail.com
        </a>
      </p>

    </LegalPageLayout>
  )
}
