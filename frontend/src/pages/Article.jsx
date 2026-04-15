import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { get } from '../api'

export default function Article() {
  const { articleId } = useParams()
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    get(`/articles/${articleId}`)
      .then(setArticle)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [articleId])

  if (loading) {
    return <div className="flex justify-center py-20"><p className="text-[#8892A8] text-sm">Loading...</p></div>
  }

  if (!article || article.detail) {
    return <div className="max-w-4xl mx-auto px-4 py-12"><p className="text-center text-[#555F78] py-8">Article not found.</p></div>
  }

  return (
    <div>
      {/* Hero image */}
      {article.hero_image && (
        <div className="relative w-full h-[300px] overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${article.hero_image})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D1117] via-[#0D1117]/40 to-transparent" />
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-8">
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
          <p className="text-lg text-[#8892A8] mt-3 leading-relaxed">
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
          <div className="mt-8 pt-6 border-t border-[#2A3458]">
            <Link
              to={`/race/${article.race_id}`}
              className="text-sm text-[#7ED321] hover:underline uppercase tracking-wider"
            >
              View Full Race Results →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
