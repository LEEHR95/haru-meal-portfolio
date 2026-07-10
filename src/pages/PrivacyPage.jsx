import LegalPageLayout from './LegalPageLayout.jsx'

const EFFECTIVE_DATE = '2026년 5월 22일'
const CONTACT_EMAIL = 'harumeal.team@gmail.com'

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="개인정보처리방침">
      <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 0 }}>
        시행일: {EFFECTIVE_DATE}
      </p>

      <p>
        하루한끼(이하 &quot;회사&quot;)는 반려견 급여 참고 서비스 제공을 위해 필요한 범위에서만
        개인정보를 수집·이용하며, 관련 법령을 준수합니다.
      </p>

      <h2>1. 수집하는 개인정보 항목</h2>
      <ul>
        <li><strong>회원 가입 시:</strong> 이메일 및 로그인 제공자(Google OAuth) 인증 정보</li>
        <li><strong>서비스 이용 시:</strong> 강아지 프로필(이름, 품종, 나이, 체중, 중성화 여부, 활동량, 건강 상태, 알러지·선호 재료, 선호 간식 스타일)</li>
        <li><strong>선택 기능 이용 시:</strong> 북마크, 최근 검색어, 레시피 조회 이력, 이용자가 등록한 레시피 및 첨부 이미지</li>
        <li><strong>AI 급여 상담 이용 시:</strong> 입력한 상담 메시지 및 강아지 프로필 일부(이름·체중·나이·건강 상태 등)가 AI 응답 생성을 위해 외부 AI 서비스에 전달될 수 있습니다.</li>
        <li><strong>자동 수집:</strong> 서비스 이용 기록, 접속 로그, 기기 정보(브라우저 종류 등), 오류 및 성능 정보 — 서비스 안정성·오류 개선 목적</li>
      </ul>

      <h2>2. 수집 및 이용 목적</h2>
      <ul>
        <li>회원 식별 및 계정 관리</li>
        <li>강아지 프로필 기반 급여량·레시피 추천·급여 상담 제공</li>
        <li>고객 문의 응대 및 서비스 개선</li>
        <li>법령상 의무 이행 및 분쟁 대응</li>
      </ul>

      <h2>3. 보유 및 이용 기간</h2>
      <ul>
        <li>회원 정보: 회원 탈퇴 또는 삭제 요청 시까지</li>
        <li>급여 반응·프로필·북마크: 탈퇴·삭제 요청 후 지체 없이 파기(단, 관련 법령에 따라 보관이 필요한 경우 해당 기간 동안 분리 보관)</li>
        <li>비회원 임시 데이터: 브라우저 localStorage에 저장되며, 사용자가 직접 삭제하거나 브라우저 데이터를 지우면 제거됩니다.</li>
      </ul>

      <h2>4. 제3자 제공</h2>
      <p>
        회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다.
        다만, 이용자의 사전 동의가 있거나 법령에 근거한 경우에 한해 제공할 수 있습니다.
      </p>

      <h2>5. 처리 위탁</h2>
      <p>
        서비스 운영을 위해 아래와 같이 개인정보 처리를 위탁할 수 있으며,
        위탁 시 계약을 통해 안전하게 관리합니다.
      </p>
      <ul>
        <li>클라우드 DB·인증: Supabase (데이터 저장 리전: 대한민국 서울)</li>
        <li>웹 호스팅: Vercel (웹 애플리케이션 배포)</li>
        <li>백엔드 호스팅: Railway (API 서버 운영)</li>
        <li>AI 상담 응답 생성: Upstage (Solar LLM — 상담 입력 메시지·프로필 정보 처리)</li>
        <li>서비스 이용 분석: Google Analytics (익명 집계 데이터, 광고 목적 미사용)</li>
        <li>오류 추적·안정성: Sentry (오류 정보 및 성능 데이터)</li>
      </ul>

      <h2>6. 이용자의 권리</h2>
      <p>
        이용자는 언제든지 개인정보 열람·정정·삭제·처리 정지를 요청할 수 있습니다.
        앱 내 프로필 설정, 또는 데이터 삭제 요청 페이지·아래 문의처를 통해 요청해 주세요.
      </p>

      <h2>7. 개인정보 보호책임자 및 문의</h2>
      <ul>
        <li>담당: 하루한끼 개인정보보호 담당</li>
        <li>이메일: <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--primary)' }}>{CONTACT_EMAIL}</a></li>
      </ul>
      <p>
        개인정보 침해 신고는 개인정보보호위원회(privacy.go.kr) 또는 경찰청 사이버수사국에도
        하실 수 있습니다.
      </p>
    </LegalPageLayout>
  )
}
