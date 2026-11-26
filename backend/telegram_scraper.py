import httpx
from bs4 import BeautifulSoup
from typing import List, Dict, Any
import datetime

async def scrape_public_telegram_channel(channel_handle: str, limit: int = 15) -> List[Dict[str, Any]]:
    """
    Scrapes recent public posts from a Telegram broadcast channel using its open web preview:
    https://t.me/s/{channel_name}
    This requires ZERO phone login or credentials because Telegram provides public previews!
    """
    clean_handle = channel_handle.strip().lstrip("@").replace("https://t.me/", "").replace("http://t.me/", "").split("/")[0]
    url = f"https://t.me/s/{clean_handle}"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    scraped_posts = []

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            response = await client.get(url, headers=headers)
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, "html.parser")
                messages = soup.find_all("div", class_="tgme_widget_message_wrap")

                for msg in messages[-limit:]:
                    text_div = msg.find("div", class_="tgme_widget_message_text")
                    if not text_div:
                        continue

                    raw_text = text_div.get_text(separator=" ", strip=True)
                    if not raw_text or len(raw_text) < 10:
                        continue

                    # Extract view count
                    views_span = msg.find("span", class_="tgme_widget_message_views")
                    views_str = views_span.get_text(strip=True) if views_span else "0"

                    # Extract timestamp
                    time_elem = msg.find("time")
                    timestamp = time_elem.get("datetime") if time_elem else datetime.datetime.now().isoformat()

                    scraped_posts.append({
                        "channel": f"@{clean_handle}",
                        "raw_text": raw_text,
                        "timestamp": timestamp,
                        "views": views_str,
                        "source": "LIVE_TELEGRAM_PREVIEW"
                    })
    except Exception as e:
        print(f"[!] Live scraper notice for @{clean_handle}: {e}")

    return scraped_posts
