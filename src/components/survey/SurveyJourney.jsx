import heroIllustration from '../../assets/survey-city-illustration.png'
import './SurveyJourney.css'

const CONTENT = {
  bread: {
    label: '대전엔 성심당만 있는 게 아니에요',
    title: <>좋아하는 빵에서 시작하는<br />나만의 대전 여행</>,
    description: '평소 좋아하는 맛을 골라주세요.\n오늘의 빵과 그 빵을 만날 수 있는 빵집을 찾아드릴게요.',
    steps: [
      ['취향에 맞는 빵', '내 답변으로 만나는 오늘의 빵'],
      ['빵집 발견', '어디서 맛볼 수 있는지 지도에서'],
      ['나만의 코스', '가고 싶은 곳을 하나씩 담아요'],
    ],
  },
  tour: {
    label: '빵집 가는 길, 잠깐 들를 곳',
    title: <>빵집 가는 길에 만나는<br />내 취향의 대전</>,
    description: '누구랑, 어떤 분위기로 가고 싶은지만 답해주세요.\n취향에 맞는 곳을 같이 찾아드릴게요.',
    steps: [
      ['여행 취향 찾기', '함께할 사람과 좋아하는 분위기'],
      ['관광지 발견', '내 여행에 어울리는 대전의 장소'],
      ['빵집과 한 코스', '두 설문 결과로 대전한바퀴'],
    ],
  },
}

// 설문 아래에만 놓이는 정적 안내. 문항 전환과 응답 상태에는 관여하지 않는다.
export default function SurveyJourney({ kind = 'bread' }) {
  const content = CONTENT[kind]
  const titleId = `survey-journey-${kind}-title`

  return (
    <section className={`survey-journey survey-journey--${kind}`} aria-labelledby={titleId}>
      <div className="survey-journey-intro">
        <div className="survey-journey-copy">
          <p className="survey-journey-label">{content.label}</p>
          <h2 id={titleId}>{content.title}</h2>
          <p className="survey-journey-description">{content.description}</p>
        </div>
        <div className="survey-journey-art" aria-hidden="true">
          {kind === 'bread' ? (
            <>
              <span className="survey-journey-art-note">오늘은 어떤 빵을 만나볼까요?</span>
              <img className="survey-journey-bread bread-one" src="/bread-illustrations/croissant.svg" alt="" width="160" height="120" />
              <img className="survey-journey-bread bread-two" src="/bread-illustrations/cake.svg" alt="" width="160" height="140" />
              <img className="survey-journey-bread bread-three" src="/bread-illustrations/saltBread.svg" alt="" width="160" height="120" />
              <span className="survey-journey-art-caption">취향을 모아, 맛있는 하루</span>
            </>
          ) : (
            <>
              <span className="survey-journey-art-note">가까운 곳에도 새로운 풍경이 있어요</span>
              <img className="survey-journey-city" src={heroIllustration} alt="" width="460" height="205" />
            </>
          )}
        </div>
      </div>
      <ol className="survey-journey-steps" aria-label="설문을 마치면">
        {content.steps.map(([title, description], index) => (
          <li key={title}>
            <span className="survey-journey-number" aria-hidden="true">0{index + 1}</span>
            <div><h3>{title}</h3><p>{description}</p></div>
          </li>
        ))}
      </ol>
    </section>
  )
}
