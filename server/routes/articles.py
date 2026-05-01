"""Article endpoints — race recap news stories."""
from fastapi import APIRouter, Query
from server.db import execute

router = APIRouter()


@router.get("/articles")
async def list_articles(season_id: int = Query(None)):
    if not season_id:
        season = execute("SELECT id FROM seasons WHERE is_active = 1 LIMIT 1", fetch="one")
        if not season:
            return []
        season_id = season["id"]

    return execute("""
        SELECT a.*, r.track_name, r.country, r.round_number
        FROM articles a
        LEFT JOIN races r ON a.race_id = r.id
        WHERE a.season_id = ? AND a.published = 1
        ORDER BY a.featured DESC, a.created_at DESC
    """, (season_id,))


@router.get("/articles/{article_id}")
async def get_article(article_id: int):
    article = execute("""
        SELECT a.*,
               r.track_name, r.country, r.round_number, r.date,
               r.hero_image AS race_hero_image
        FROM articles a
        LEFT JOIN races r ON a.race_id = r.id
        WHERE a.id = ?
    """, (article_id,), fetch="one")

    if not article:
        return {"detail": "Article not found."}

    return article
