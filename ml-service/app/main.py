import os
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel, Field
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

load_dotenv()

app = FastAPI(title="BookRec ML Service", version="1.0.0")


class BookIn(BaseModel):
  id: str
  title: str
  author: str
  genre: List[str] = Field(default_factory=list)
  keywords: List[str] = Field(default_factory=list)
  description: str = ""
  ratingsAvg: float = 0.0
  ratingsCount: int = 0


class ActivityIn(BaseModel):
  searches: List[Dict[str, Any]] = Field(default_factory=list)
  purchases: List[Dict[str, Any]] = Field(default_factory=list)
  ratings: List[Dict[str, Any]] = Field(default_factory=list)
  bookmarks: List[Dict[str, Any]] = Field(default_factory=list)


class RecommendRequest(BaseModel):
  user_id: str
  books: List[BookIn]
  activity: ActivityIn = Field(default_factory=ActivityIn)
  top_n: int = 12


class RecommendResponse(BaseModel):
  recommended_book_ids: List[str]
  debug: Optional[Dict[str, Any]] = None


def _book_text(b: BookIn) -> str:
  parts = [
    b.title or "",
    b.author or "",
    " ".join(b.genre or []),
    " ".join(b.keywords or []),
    b.description or "",
  ]
  return " ".join([p.strip() for p in parts if p and p.strip()])


def _popularity_score(b: BookIn) -> float:
  # Smooth popularity combining avg rating and confidence from count.
  avg = float(b.ratingsAvg or 0.0)
  cnt = float(b.ratingsCount or 0.0)
  conf = 1.0 - np.exp(-cnt / 20.0)  # saturates as count grows
  return (avg / 5.0) * conf


def _extract_user_profile_text(books_by_id: Dict[str, BookIn], activity: ActivityIn) -> Tuple[str, Dict[str, Any]]:
  # Signals:
  # - High-rated books: stronger weight
  # - Purchases: medium weight
  # - Searches: light weight
  liked_texts: List[str] = []
  purchased_texts: List[str] = []
  searched_texts: List[str] = []

  for r in activity.ratings or []:
    bid = str(r.get("bookId") or "")
    rating = float(r.get("rating") or 0.0)
    b = books_by_id.get(bid)
    if not b:
      continue
    t = _book_text(b)
    if rating >= 4.0:
      liked_texts.extend([t] * 3)
    elif rating >= 3.0:
      liked_texts.extend([t] * 1)

  for p in activity.purchases or []:
    bid = str(p.get("bookId") or "")
    b = books_by_id.get(bid)
    if b:
      purchased_texts.extend([_book_text(b)] * 2)

  for bookmark in activity.bookmarks or []:
    b = books_by_id.get(str(bookmark.get("bookId") or ""))
    if b:
      liked_texts.append(_book_text(b))

  for s in activity.searches or []:
    q = str(s.get("query") or "").strip()
    if q:
      searched_texts.append(q)
    bid = str(s.get("bookId") or "")
    b = books_by_id.get(bid)
    if b:
      searched_texts.append(_book_text(b))

  profile = " ".join(liked_texts + purchased_texts + searched_texts).strip()
  debug = {
    "profile_chars": len(profile),
    "ratings_events": len(activity.ratings or []),
    "purchase_events": len(activity.purchases or []),
    "search_events": len(activity.searches or []),
    "bookmark_events": len(activity.bookmarks or []),
  }
  return profile, debug


@app.get("/health")
def health() -> Dict[str, bool]:
  return {"ok": True}


@app.post("/recommend", response_model=RecommendResponse)
def recommend(req: RecommendRequest) -> RecommendResponse:
  books = req.books or []
  top_n = int(req.top_n or 12)
  top_n = max(1, min(50, top_n))

  if not books:
    return RecommendResponse(recommended_book_ids=[], debug={"reason": "no_books"})

  books_by_id = {b.id: b for b in books}

  profile_text, debug_profile = _extract_user_profile_text(books_by_id, req.activity)

  # Build TF-IDF on catalog text (content-based filtering)
  corpus = [_book_text(b) for b in books]
  vectorizer = TfidfVectorizer(
    stop_words="english",
    max_features=5000,
    ngram_range=(1, 2),
  )
  X = vectorizer.fit_transform(corpus)

  if profile_text:
    u = vectorizer.transform([profile_text])
    content_sim = cosine_similarity(u, X).reshape(-1)
  else:
    content_sim = np.zeros(len(books), dtype=float)

  # Exclude already purchased/rated books from recommendations
  exclude_ids = set()
  for p in req.activity.purchases or []:
    exclude_ids.add(str(p.get("bookId") or ""))
  for r in req.activity.ratings or []:
    exclude_ids.add(str(r.get("bookId") or ""))
  for bookmark in req.activity.bookmarks or []:
    # Saved items inform taste but remain on the shelf as possible rediscovery.
    pass

  popularity = np.array([_popularity_score(b) for b in books], dtype=float)

  # Search boost: if user searched a query matching book text, small bump.
  search_queries = [str(s.get("query") or "").strip().lower() for s in (req.activity.searches or [])]
  search_queries = [q for q in search_queries if q]

  search_boost = np.zeros(len(books), dtype=float)
  if search_queries:
    for i, b in enumerate(books):
      text = _book_text(b).lower()
      hit = any(q in text for q in search_queries[:10])
      search_boost[i] = 0.15 if hit else 0.0

  # Hybrid score: content + popularity + activity
  # (collaborative part is approximated via popularity/confidence because this microservice
  # only receives the current user's activity in this project scaffold.)
  score = 0.55 * content_sim + 0.30 * popularity + 0.15 * search_boost

  scored = []
  for i, b in enumerate(books):
    if b.id in exclude_ids:
      continue
    scored.append((float(score[i]), b.id))

  scored.sort(key=lambda x: x[0], reverse=True)
  rec_ids = [bid for _, bid in scored[:top_n]]

  debug = {
    **debug_profile,
    "books_in_catalog": len(books),
    "excluded": len(exclude_ids),
    "top_n": top_n,
    "weights": {"content": 0.55, "popularity": 0.30, "search": 0.15},
  }

  return RecommendResponse(recommended_book_ids=rec_ids, debug=debug)
