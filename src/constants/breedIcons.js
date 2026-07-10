// 파일명 그대로 import (변경 금지)
import maltese            from '../assets/breeds/icons/Maltese.png'
import pomeranian         from '../assets/breeds/icons/Pomeranian.png'
import bichonFrise        from '../assets/breeds/icons/Bichon Frise.png'
import toyPoodle          from '../assets/breeds/icons/Toy Poodle.png'
import shibaInu           from '../assets/breeds/icons/Shiba Inu.png'
import borderCollie       from '../assets/breeds/icons/Border Collie.png'
import koreanJindo        from '../assets/breeds/icons/Korean Jindo Dog.png'
import samoyed            from '../assets/breeds/icons/Samoyed.png'
import cockerSpaniel      from '../assets/breeds/icons/Cocker Spaniel.png'
import welshCorgi         from '../assets/breeds/icons/Welsh Corgi.png'
import chihuahua          from '../assets/breeds/icons/Chihuahua.png'
import shihTzu            from '../assets/breeds/icons/Shih Tzu.png'
import miniSchnauzer      from '../assets/breeds/icons/Miniature Schnauzer.png'
import goldenRetriever    from '../assets/breeds/icons/Golden Retriever.png'
import yorkshireTerrier   from '../assets/breeds/icons/Yorkshire Terrier.png'
import labradorRetriever  from '../assets/breeds/icons/Labrador Retriever.png'
import frenchBulldog      from '../assets/breeds/icons/French Bulldog.png'
import pug                from '../assets/breeds/icons/Pug.png'
import longHairedChi      from '../assets/breeds/icons/Long-Haired Chihuahua.png'
import bedlingtonTerrier  from '../assets/breeds/icons/Bedlington Terrier.png'
import beagle             from '../assets/breeds/icons/Beagle.png'
import italianGreyhound   from '../assets/breeds/icons/Italian Greyhound.png'
import whippet            from '../assets/breeds/icons/Whippet.png'
import dachshund          from '../assets/breeds/icons/Dachshund.png'
import siberianHusky      from '../assets/breeds/icons/Siberian Husky.png'
import alaskanMalamute    from '../assets/breeds/icons/Alaskan Malamute.png'
import jackRussell        from '../assets/breeds/icons/Jack Russell Terrier.png'
import doberman           from '../assets/breeds/icons/Doberman Pinscher.png'
import dalmatian          from '../assets/breeds/icons/Dalmatian.png'
import englishBulldog     from '../assets/breeds/icons/English Bulldog.png'
import germanShepherd     from '../assets/breeds/icons/German Shepherd.png'
import berneseMountain    from '../assets/breeds/icons/Bernese Mountain Dog.png'
import saintBernard       from '../assets/breeds/icons/Saint Bernard.png'
import newfoundland       from '../assets/breeds/icons/Newfoundland.png'
import greatDane          from '../assets/breeds/icons/Great Dane.png'
import rottweiler         from '../assets/breeds/icons/Rottweiler.png'
import shetlandSheepdog   from '../assets/breeds/icons/Shetland Sheepdog.png'
import greatPyrenees      from '../assets/breeds/icons/Great Pyrenees.png'
import mixed              from '../assets/breeds/icons/MixedBreed.png'
import mixedKorean        from '../assets/breeds/icons/Mixed Korean.png'
import cotonDeTulear      from '../assets/breeds/icons/Coton de Tulear.png'
import cavalierKCS        from '../assets/breeds/icons/Cavalier King Charles Spaniel.png'

// 소문자 alias → 아이콘 맵 (한국어 + 영어 표기 포함)
const _MAP = new Map([
  // Maltese / 말티즈
  ['말티즈', maltese],
  ['maltese', maltese],
  // 디자이너견: Maltese 계열
  ['말티푸', maltese],
  ['말티숑', maltese],
  ['말티치', maltese],
  ['몰키', maltese],
  ['maltipoo', maltese],
  ['maltichi', maltese],
  ['morkie', maltese],

  // Pomeranian / 포메라니안
  ['포메라니안', pomeranian],
  ['pomeranian', pomeranian],
  // 디자이너견: Pomeranian 계열
  ['폼피츠', pomeranian],
  ['포메푸', pomeranian],
  ['포메치', pomeranian],
  ['pomchi', pomeranian],
  ['pomapoo', pomeranian],

  // Bichon Frise / 비숑 프리제
  ['비숑 프리제', bichonFrise],
  ['비숑프리제', bichonFrise],
  ['비숑', bichonFrise],
  ['bichon frise', bichonFrise],
  ['bichon', bichonFrise],
  // 디자이너견: Bichon Frise 계열
  ['푸숑', bichonFrise],
  ['비숑푸', bichonFrise],
  ['비숑믹스', bichonFrise],
  ['bichpoo', bichonFrise],
  ['bishonpoo', bichonFrise],

  // Toy Poodle / 토이 푸들
  ['토이 푸들', toyPoodle],
  ['토이푸들', toyPoodle],
  ['푸들', toyPoodle],
  ['미니어쳐 푸들', toyPoodle],
  ['미니어처 푸들', toyPoodle],
  ['toy poodle', toyPoodle],
  ['poodle', toyPoodle],
  ['miniature poodle', toyPoodle],
  // 푸들 계열 혼합 / 믹스
  ['푸들믹스', toyPoodle],
  ['토이푸들믹스', toyPoodle],
  ['푸들계열', toyPoodle],
  ['poodle mix', toyPoodle],

  // Shiba Inu / 시바
  ['시바', shibaInu],
  ['시바견', shibaInu],
  ['shiba inu', shibaInu],
  ['shiba', shibaInu],

  // Border Collie / 보더 콜리
  ['보더 콜리', borderCollie],
  ['보더콜리', borderCollie],
  ['border collie', borderCollie],

  // Korean Jindo / 진도견
  ['진도견', koreanJindo],
  ['진돗개', koreanJindo],
  ['진도개', koreanJindo],
  ['korean jindo dog', koreanJindo],
  ['korean jindo', koreanJindo],
  ['jindo', koreanJindo],

  // Samoyed / 사모예드
  ['사모예드', samoyed],
  ['samoyed', samoyed],

  // Cocker Spaniel / 코커 스패니얼
  ['잉글리쉬 코카 스파니엘', cockerSpaniel],
  ['코커 스패니얼', cockerSpaniel],
  ['코카 스파니엘', cockerSpaniel],
  ['cocker spaniel', cockerSpaniel],
  ['american cocker spaniel', cockerSpaniel],
  ['english cocker spaniel', cockerSpaniel],
  // 디자이너견: Cocker Spaniel 계열
  ['코카푸', cockerSpaniel],
  ['캐바푸', cockerSpaniel],
  ['cockapoo', cockerSpaniel],
  ['cavapoo', cockerSpaniel],

  // Welsh Corgi / 웰시 코기
  ['웰시 코기 펨브로크', welshCorgi],
  ['웰시 코기 카디건', welshCorgi],
  ['웰시 코기', welshCorgi],
  ['웰시코기', welshCorgi],
  ['welsh corgi', welshCorgi],
  ['corgi', welshCorgi],

  // Chihuahua / 치와와
  ['치와와', chihuahua],
  ['chihuahua', chihuahua],
  // 디자이너견: Chihuahua 계열
  ['치와푸', chihuahua],
  ['chi-poo', chihuahua],

  // Shih Tzu / 시츄
  ['시츄', shihTzu],
  ['시츄푸', shihTzu],
  ['shih tzu', shihTzu],
  ['shitzu', shihTzu],
  // 디자이너견: Shih Tzu 계열
  ['시츄믹스', shihTzu],
  ['shitzu mix', shihTzu],

  // Miniature Schnauzer / 슈나우저
  ['미니어쳐 슈나우저', miniSchnauzer],
  ['미니어처 슈나우저', miniSchnauzer],
  ['슈나우저', miniSchnauzer],
  ['슈나우져', miniSchnauzer],
  ['miniature schnauzer', miniSchnauzer],
  ['schnauzer', miniSchnauzer],
  // 디자이너견: Schnauzer 계열
  ['슈나푸', miniSchnauzer],
  ['슈누들', miniSchnauzer],
  ['schnoodle', miniSchnauzer],

  // Golden Retriever / 골든 리트리버
  ['골든 리트리버', goldenRetriever],
  ['골든리트리버', goldenRetriever],
  ['골든두들', goldenRetriever],
  ['golden retriever', goldenRetriever],
  ['golden', goldenRetriever],
  ['goldendoodle', goldenRetriever],
  // 디자이너견: Golden Retriever 계열
  ['골든푸', goldenRetriever],

  // Yorkshire Terrier / 요크셔 테리어
  ['요크셔 테리어', yorkshireTerrier],
  ['요크셔테리어', yorkshireTerrier],
  ['yorkshire terrier', yorkshireTerrier],
  ['yorkie', yorkshireTerrier],
  // 디자이너견: Yorkshire Terrier 계열
  ['요키푸', yorkshireTerrier],
  ['yorkipoo', yorkshireTerrier],

  // Labrador Retriever / 래브라도 리트리버
  ['래브라도 리트리버', labradorRetriever],
  ['라브라도 리트리버', labradorRetriever],
  ['래브라도리트리버', labradorRetriever],
  ['labrador retriever', labradorRetriever],
  ['labrador', labradorRetriever],
  ['lab', labradorRetriever],

  // French Bulldog / 프렌치 불독
  ['프렌치 불독', frenchBulldog],
  ['프렌치불독', frenchBulldog],
  ['french bulldog', frenchBulldog],
  ['frenchie', frenchBulldog],

  // Pug / 퍼그
  ['퍼그', pug],
  ['pug', pug],

  // Long-Haired Chihuahua / 장모형 치와와
  ['장모형 치와와', longHairedChi],
  ['장모 치와와', longHairedChi],
  ['long-haired chihuahua', longHairedChi],
  ['longhaired chihuahua', longHairedChi],

  // Bedlington Terrier / 베들링턴 테리어
  ['베들링턴 테리어', bedlingtonTerrier],
  ['베들링턴테리어', bedlingtonTerrier],
  ['bedlington terrier', bedlingtonTerrier],

  // Beagle / 비글
  ['비글', beagle],
  ['beagle', beagle],

  // Italian Greyhound / 이탈리안 그레이 하운드
  ['이탈리안 그레이 하운드', italianGreyhound],
  ['이탈리안그레이하운드', italianGreyhound],
  ['italian greyhound', italianGreyhound],

  // Whippet / 휘핏
  ['휘핏', whippet],
  ['whippet', whippet],

  // Dachshund / 닥스훈트
  ['스탠다드 닥스훈트', dachshund],
  ['미니어쳐 닥스훈트', dachshund],
  ['미니어처 닥스훈트', dachshund],
  ['래빗 닥스훈트', dachshund],
  ['닥스훈트', dachshund],
  ['dachshund', dachshund],

  // Siberian Husky / 시베리안 허스키
  ['시베리안 허스키', siberianHusky],
  ['시베리안허스키', siberianHusky],
  ['siberian husky', siberianHusky],
  ['husky', siberianHusky],

  // Alaskan Malamute / 말라뮤트
  ['알라스칸 말라뮤트', alaskanMalamute],
  ['알라스칸말라뮤트', alaskanMalamute],
  ['말라뮤트', alaskanMalamute],
  ['alaskan malamute', alaskanMalamute],
  ['malamute', alaskanMalamute],

  // Jack Russell Terrier / 잭 러셀 테리어
  ['잭 러셀 테리어', jackRussell],
  ['잭러셀테리어', jackRussell],
  ['잭러셀', jackRussell],
  ['jack russell terrier', jackRussell],
  ['jack russell', jackRussell],

  // Doberman / 도베르만
  ['도베르만', doberman],
  ['doberman pinscher', doberman],
  ['doberman', doberman],

  // Dalmatian / 달마시안
  ['달마시안', dalmatian],
  ['dalmatian', dalmatian],

  // English Bulldog / 불독
  ['불독', englishBulldog],
  ['올드 잉글리쉬 불독', englishBulldog],
  ['아메리칸 불독', englishBulldog],
  ['잉글리쉬 불독', englishBulldog],
  ['english bulldog', englishBulldog],
  ['bulldog', englishBulldog],

  // German Shepherd / 저먼 셰퍼드
  ['저먼 셰퍼드 독', germanShepherd],
  ['저먼 셰퍼드', germanShepherd],
  ['저먼셰퍼드', germanShepherd],
  ['german shepherd', germanShepherd],
  ['german shepherd dog', germanShepherd],

  // Bernese Mountain Dog / 버니즈 마운틴 독
  ['버니즈 마운틴 독', berneseMountain],
  ['버니즈마운틴독', berneseMountain],
  ['bernese mountain dog', berneseMountain],

  // Saint Bernard / 세인트 버나드
  ['세인트 버나드', saintBernard],
  ['세인트버나드', saintBernard],
  ['saint bernard', saintBernard],

  // Newfoundland / 뉴펀들랜드
  ['뉴펀들랜드', newfoundland],
  ['newfoundland', newfoundland],

  // Great Dane / 그레이트 덴
  ['그레이트 덴', greatDane],
  ['그레이트덴', greatDane],
  ['great dane', greatDane],

  // Rottweiler / 로트와일러
  ['로트와일러', rottweiler],
  ['rottweiler', rottweiler],

  // Shetland Sheepdog / 셰틀랜드 쉽독
  ['셰틀랜드 쉽독', shetlandSheepdog],
  ['셰틀랜드쉽독', shetlandSheepdog],
  ['셸티', shetlandSheepdog],
  ['shetland sheepdog', shetlandSheepdog],
  ['sheltie', shetlandSheepdog],

  // Great Pyrenees / 그레이트 피레니즈
  ['그레이트 피레니즈', greatPyrenees],
  ['그레이트피레니즈', greatPyrenees],
  ['great pyrenees', greatPyrenees],
  ['pyrenees', greatPyrenees],

  // Mixed Breed / 믹스견 · 잡종 · 발바리
  ['믹스견', mixed],
  ['믹스', mixed],
  ['mixed', mixed],
  ['믹스견 혼종', mixed],
  ['발바리', mixed],
  ['시고르자브종', mixed],
  ['잡종', mixed],
  ['mixed breed', mixed],

  // Coton de Tulear / 꼬똥 드 툴레아
  ['꼬똥 드 툴레아', cotonDeTulear],
  ['꼬똥 드 뚤레아', cotonDeTulear],    // DB 대표 alias 표기
  ['꼬동', cotonDeTulear],
  ['coton de tulear', cotonDeTulear],
  // 디자이너견: Coton de Tulear 계열 (꼬똥+비숑)
  ['꼬숑', cotonDeTulear],
  ['코숑', cotonDeTulear],
  ['cotonchon', cotonDeTulear],
  ['coton bichon', cotonDeTulear],
  ['coton de tulear bichon', cotonDeTulear],

  // Cavalier King Charles Spaniel / 캐벌리어 킹 찰스 스패니얼
  ['캐벌리어 킹 찰스 스패니얼', cavalierKCS],
  ['캐벌리어 킹 찰스 스파니엘', cavalierKCS],  // DB 표기 (스파니엘)
  ['캐벌리어', cavalierKCS],
  ['cavalier king charles spaniel', cavalierKCS],
  ['cavalier', cavalierKCS],

  // Mixed Korean / 한국 토종·진도 계열 믹스
  ['토종개', mixedKorean],
  ['토종견', mixedKorean],
  ['진도믹스', mixedKorean],
  ['진돗개믹스', mixedKorean],
  ['진도견믹스', mixedKorean],
  ['한국믹스', mixedKorean],
  ['코리안믹스', mixedKorean],
  ['korean mix', mixedKorean],
  ['korean mixed breed', mixedKorean],
])

/**
 * 품종명으로 아이콘 URL 반환.
 * 매핑 실패 시 null → 호출부에서 fallback 처리.
 * @param {string|null|undefined} breedName
 * @returns {string|null}
 */
export function getBreedIcon(breedName) {
  if (!breedName) return null
  const lower = breedName.trim().toLowerCase()
  return _MAP.get(lower) ?? null
}
