export async function fetchNews() {
  try {
    const res = await fetch("./data/news.json");
    if (!res.ok) throw new Error("news.json 讀取失敗");
    const data = await res.json();
    console.log("✅ 使用本地 news.json:", data);
    return data;
  } catch (err) {
    console.error("❌ fetchNews error:", err);
    return [];
  }
}
