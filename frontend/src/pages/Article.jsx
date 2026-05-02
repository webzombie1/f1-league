import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { get } from '../api'

function getYoutubeId(url) {
  if (!url) return null
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

export default function Article() {
  const { articleId } = useParams()
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [highlights, setHighlights] = useState([])
  const [playingVideo, setPlayingVideo] = useState(null)

  useEffect(() => {
    get(`/articles/${articleId}`)
      .then(setArticle)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [articleId])

  useEffect(() => {
    if (article?.race_id) {
      get(`/highlights?race_id=${article.race_id}`).then(setHighlights).catch(() => {})
    }
  }, [article?.race_id])

  if (loading) {
    return <div className="flex justify-center py-20"><p className="text-[#999999] text-sm">Loading...</p></div>
  }

  if (!article || article.detail) {
    return <div className="max-w-4xl mx-auto px-4 py-12"><p className="text-center text-[#777777] py-8">Article not found.</p></div>
  }

  return (
    <div>
      {/* Hero image — prefer the race's generated celebration hero. Full
          natural width so the whole image (including wide-extended ones) is
          visible without cropping. */}
      {(article.race_hero_image || article.hero_image) && (
        <div className="max-w-[1400px] mx-auto px-4 pt-6">
          <img
            src={article.race_hero_image || article.hero_image}
            alt=""
            className="w-full rounded-xl"
          />
        </div>
      )}

      <div className="max-w-[1400px] mx-auto px-4 py-8">
        <div className={highlights.length > 0 ? "grid grid-cols-1 lg:grid-cols-10 gap-8" : ""}>
          <div className={highlights.length > 0 ? "lg:col-span-7 min-w-0" : "max-w-3xl mx-auto"}>
            {/* Meta */}
            <div className="mb-6">
              <Link to="/" className="text-sm text-[#7ED321] hover:underline">← Back</Link>
              {article.round_number && (
                <p className="text-xs text-[#7ED321] uppercase tracking-[0.2em] font-bold mt-4">
                  Round {article.round_number} · {article.country}
                </p>
              )}
            </div>

            {/* Headline */}
            <h1 className="text-3xl md:text-4xl font-black text-[#E8ECF4] uppercase tracking-tight leading-tight">
              {article.headline}
            </h1>

            {article.subtitle && (
              <p className="text-lg text-[#999999] mt-3 leading-relaxed">
                {article.subtitle}
              </p>
            )}

            {/* Divider */}
            <div className="relative h-3 overflow-hidden my-8">
              <div className="absolute top-0 left-0 right-8 h-[2px] bg-[#7ED321]" />
              <div className="absolute top-[5px] left-12 right-0 h-[1px] bg-[#7ED321]/40" />
            </div>

            {/* Body */}
            <div className="prose prose-invert max-w-none">
              {article.body.split('\n').map((paragraph, i) => (
                paragraph.trim() ? (
                  <p key={i} className="text-[#C0C8D8] leading-relaxed mb-4 text-[15px]">
                    {paragraph}
                  </p>
                ) : null
              ))}
            </div>

            {/* Link to race results */}
            {article.race_id && (
              <div className="mt-8 pt-6 border-t border-[#1F1F1F]">
                <Link
                  to={`/race/${article.race_id}`}
                  className="flex items-center justify-center bg-[#7ED321] hover:bg-[#6BC11A] text-[#0D1117] font-black uppercase text-xs tracking-wider px-6 py-3 rounded-md transition-colors w-fit mx-auto shadow-lg shadow-[#7ED321]/20"
                >
                  View Full Race Results
                </Link>
              </div>
            )}
          </div>

          {/* Highlights sidebar — only when highlights exist */}
          {highlights.length > 0 && (
            <aside className="lg:col-span-3 min-w-0">
              <div className="bg-[#111111] border border-[#1F1F1F] rounded-xl overflow-hidden shadow-lg shadow-black/30 lg:sticky lg:top-4">
                <div className="px-4 py-3 border-b border-[#1F1F1F]">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-[#E8ECF4]">Highlights</h2>
                </div>
                <div className="flex flex-col gap-3 p-3">
                  {highlights.map((video) => {
                    const ytId = getYoutubeId(video.youtube_url)
                    return (
                      <button
                        key={video.id}
                        onClick={() => setPlayingVideo(video)}
                        className="group block rounded-lg overflow-hidden bg-[#0D1117] border border-[#1F1F1F] hover:border-[#7ED321]/40 transition-colors text-left cursor-pointer"
                      >
                        <div className="relative aspect-video bg-[#191919] overflow-hidden">
                          {ytId && (
                            <img
                              src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                              alt=""
                              className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
                            />
                          )}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-[#7ED321]/90 flex items-center justify-center group-hover:scale-110 transition-transform">
                              <svg className="w-4 h-4 text-[#0D1117] ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z"/>
                              </svg>
                            </div>
                          </div>
                        </div>
                        <p className="px-3 py-2 text-xs font-medium text-[#E8ECF4] truncate">
                          {video.title}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Video player modal */}
      {playingVideo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80" onClick={() => setPlayingVideo(null)}>
          <div className="w-full max-w-4xl mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-medium text-[#E8ECF4] truncate">{playingVideo.title}</h3>
              <button onClick={() => setPlayingVideo(null)} className="text-[#999999] hover:text-white text-2xl leading-none cursor-pointer">×</button>
            </div>
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <iframe
                className="absolute inset-0 w-full h-full rounded-lg"
                src={`https://www.youtube.com/embed/${getYoutubeId(playingVideo.youtube_url)}?autoplay=1`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
