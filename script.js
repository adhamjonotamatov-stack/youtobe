const API_KEY = "AIzaSyD8dasTk3GqvZzWnM2BKKXwL90z3rWqqMc";

const form = document.getElementById("searchForm");
const input = document.getElementById("searchInput");
const container = document.getElementById("videoContainer");
const statusText = document.getElementById("status");

let requestId = 0;

// 1. YouTube API dan videolarni olish
function searchVideos(query) {
  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    maxResults: "12",
    key: API_KEY,
  });

  const url =
    "https://www.googleapis.com/youtube/v3/search?" + params.toString();

  return fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error("API xatoligi: " + response.status);
    }

    return response.json();
  });
}

// 2. Videolarni ekranga chiqarish
function displayVideos(videos) {
  container.innerHTML = "";

  if (videos.length === 0) {
    statusText.textContent = "Video topilmadi.";
    return;
  }

  videos.forEach((video) => {
    const videoId = video.id.videoId;
    const title = video.snippet.title;
    const channel = video.snippet.channelTitle;
    const thumbnail = video.snippet.thumbnails.medium.url;

    const card = document.createElement("div");
    card.className = "video-card";

    const link = document.createElement("a");
    link.href = `https://www.youtube.com/watch?v=${videoId}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    const img = document.createElement("img");
    img.src = thumbnail;
    img.alt = title;

    const info = document.createElement("div");
    info.className = "video-info";

    const heading = document.createElement("h3");
    heading.textContent = title;

    const paragraph = document.createElement("p");
    paragraph.textContent = channel;

    info.append(heading, paragraph);
    link.append(img, info);
    card.append(link);
    container.append(card);
  });
}

// 3. Search tugmasi bosilganda
form.addEventListener("submit", (event) => {
  event.preventDefault();

  const query = input.value.trim();

  if (!query) return;

  const currentRequest = ++requestId;

  container.innerHTML = "";
  statusText.textContent = "Loading videos...";

  searchVideos(query)
    .then((data) => {
      if (currentRequest !== requestId) return;

      displayVideos(data.items);
      console.log("Videos loaded:", data.items);
    })
    .catch((error) => {
      if (currentRequest !== requestId) return;

      statusText.textContent = error.message;
      console.error(error);
    })
    .finally(() => {
      if (currentRequest !== requestId) return;

      if (container.children.length > 0) {
        statusText.textContent = "";
      }

      console.log("Request finished!");
    });
});
