const API_KEY = "AIzaSyD8dasTk3GqvZzWnM2BKKXwL90z3rWqqMc";

const form = document.querySelector(".navbar-form");
const input = document.querySelector(".navbar-form-input");
const container = document.querySelector(".videos-video");
const statusText = document.querySelector(".status");
const searchSection = document.querySelector(".videos");
const watchSection = document.querySelector(".video-clicked");
const playerContainer = document.querySelector(".video-clicked-content-player");
const videoTitle = document.querySelector(".video-clicked-content-title");
const channelName = document.querySelector(".video-clicked-content-text");
const recommendations = document.querySelector(
  ".video-clicked-content-footer-videos",
);
const recommendationStatus = document.querySelector(
  ".video-clicked-content-footer-text",
);
const logo = document.querySelector(".navbar-btn");
const backButton = document.querySelector(".video-clicked-Return-btn");

let searchRequestId = 0;
let recommendationRequestId = 0;

function searchVideos(query) {
  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    maxResults: "50",
    key: API_KEY,
  });

  return fetch(`https://www.googleapis.com/youtube/v3/search?${params}`).then(
    (response) => {
      if (!response.ok) {
        throw new Error(
          `YouTube API xatoligi (${response.status}). API kalit va quota'ni tekshiring.`,
        );
      }
      return response.json();
    },
  );
}

function createVideoCard(video, isRecommendation = false) {
  const tugma = document.createElement("button");
  tugma.type = "button";
  tugma.className = isRecommendation ? "recommendation-card" : "video-card";

  const img = document.createElement("img");
  img.src =
    video.snippet.thumbnails?.medium?.url ||
    video.snippet.thumbnails?.default?.url ||
    "";
  img.alt = video.snippet.title;
  img.loading = "lazy";

  const cup = document.createElement("div");
  cup.className = isRecommendation ? "recommendation-info" : "video-info";
  const title = document.createElement(isRecommendation ? "h4" : "h3");
  title.textContent = video.snippet.title;
  const text = document.createElement("p");
  text.textContent = video.snippet.channelTitle;

  cup.append(title, text);
  tugma.append(img, cup);
  tugma.addEventListener("click", () => playVideo(video));
  return tugma;
}

function displayVideos(videos) {
  container.replaceChildren();
  if (videos.length === 0) {
    statusText.textContent = "Video topilmadi.";
    return;
  }
  videos.forEach((video) => container.append(createVideoCard(video)));
}

function playVideo(video) {
  const videoId = video.id.videoId;
  if (!videoId) return;

  ++recommendationRequestId;
  searchSection.classList.add("hidden");
  watchSection.classList.remove("hidden");
  statusText.textContent = "";
  videoTitle.textContent = video.snippet.title;
  channelName.textContent = video.snippet.channelTitle;

  const iframe = document.createElement("iframe");
  iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
  iframe.title = video.snippet.title;
  iframe.allow =
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  iframe.allowFullscreen = true;
  playerContainer.replaceChildren(iframe);
  window.scrollTo({ top: 0, behavior: "smooth" });

  loadRecommendations(video);
}
function loadRecommendations(video) {
  const currentRequest = ++recommendationRequestId;
  recommendations.replaceChildren();
  recommendationStatus.textContent = "O‘xshash videolar yuklanmoqda...";

  searchVideos(video.snippet.title)
    .then((data) => {
      if (currentRequest !== recommendationRequestId) return;
      const filtered = (data.items || []).filter(
        (item) => item.id.videoId && item.id.videoId !== video.id.videoId,
      );
      if (filtered.length === 0) {
        recommendationStatus.textContent = "O‘xshash video topilmadi.";
        return;
      }
      filtered.forEach((item) =>
        recommendations.append(createVideoCard(item, true)),
      );
      recommendationStatus.textContent = "";
    })
    .catch((error) => {
      if (currentRequest !== recommendationRequestId) return;
      recommendationStatus.textContent = error.message;
    })
    .finally(() => {
      if (currentRequest === recommendationRequestId) {
        console.log("Tavsiyalar so‘rovi tugadi");
      }
    });
}

function showSearchResults() {
  ++recommendationRequestId;
  watchSection.classList.add("hidden");
  searchSection.classList.remove("hidden");
  playerContainer.replaceChildren();
  recommendationStatus.textContent = "";
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = input.value.trim();
  if (!query) return;

  if (API_KEY === "YOUR_YOUTUBE_API_KEY") {
    statusText.textContent =
      "Avval script.js ichiga YouTube API kalitingizni kiriting.";
    return;
  }

  const currentRequest = ++searchRequestId;
  showSearchResults();
  container.replaceChildren();
  statusText.textContent = "Videolar yuklanmoqda...";

  searchVideos(query)
    .then((data) => {
      if (currentRequest !== searchRequestId) return;
      displayVideos(data.items || []);
      if (container.children.length > 0) statusText.textContent = "";
    })
    .catch((error) => {
      if (currentRequest !== searchRequestId) return;
      statusText.textContent = error.message;
      console.error(error);
    })
    .finally(() => {
      if (currentRequest === searchRequestId) console.log("Qidiruv tugadi");
    });
});

backButton.addEventListener("click", showSearchResults);
logo.addEventListener("click", () => {
  ++searchRequestId;
  showSearchResults();
  statusText.textContent = "";
});
