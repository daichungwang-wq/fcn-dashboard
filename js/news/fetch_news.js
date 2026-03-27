export async function fetchNews() {
  const res = await fetch(
    "https://newsapi.org/v2/everything?q=stock OR fed OR inflation OR AI&sortBy=publishedAt&apiKey=YOUR_API_KEY"
  );

  const data = await res.json();

  return data.articles.map((a) => ({
    title: a.title,
    summary: a.description || "",
    source: a.source.name,
    published_at: a.publishedAt
  }));
}
