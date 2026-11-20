const API_KEY = "AIzaSyD8dasTk3GqvZzWnM2BKKXwL90z3rWqqMc";

const form = document.querySelector(".navbar-form");
const input = document.querySelector(".navbar-form-input");
const searchHistoryPanel = document.querySelector(".search-history");
const container = document.querySelector(".videos-video");
const videosTitle = document.querySelector(".videos-title");
const shortsSection = document.querySelector(".shorts");
const shortsContainer = document.querySelector(".shorts-grid");
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
const nextShortButton = document.querySelector(".shorts-next-button");
const previousShortButton = document.querySelector(".shorts-prev-button");

let searchRequestId = 0;
let recommendationRequestId = 0;
let shortsVideos = [];
let currentShortIndex = -1;
let shortNavigationInProgress = false;
let recommendationQueue = [];
let playedVideoIds = new Set();
let youtubeApiReadyPromise;

const SEARCH_HISTORY_KEY = "mytube-search-history";
const LAST_SEARCH_KEY = "mytube-last-search";
const NEXT_PAGE_TOKEN_KEY = "mytube-next-page-token";
let searchHistory = [];
let lastSavedSearch = "";
let reloadPageToken = "";
try {
  const savedSearches = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]");
  if (Array.isArray(savedSearches)) {
    searchHistory = savedSearches.filter((query) => typeof query === "string");
  }
  lastSavedSearch = localStorage.getItem(LAST_SEARCH_KEY) || "";
  reloadPageToken = localStorage.getItem(NEXT_PAGE_TOKEN_KEY) || "";
} catch {
  searchHistory = [];
  lastSavedSearch = "";
  reloadPageToken = "";
}

if (!input.value) input.value = lastSavedSearch || searchHistory[0] || "";

function renderSearchHistory(filter = "") {
  searchHistoryPanel.replaceChildren();
  const matchingSearches = searchHistory.filter((query) =>
    query.toLowerCase().includes(filter.toLowerCase()),
  );

  matchingSearches.forEach((query) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "search-history-item";
    option.setAttribute("role", "option");
    option.textContent = query;
    option.addEventListener("click", () => {
      input.value = query;
      searchHistoryPanel.classList.add("hidden");
      form.requestSubmit();
    });
    searchHistoryPanel.append(option);
  });

  searchHistoryPanel.classList.toggle("hidden", matchingSearches.length === 0);
}

function saveSearchQuery(query) {
  searchHistory = [query, ...searchHistory.filter((item) => item !== query)].slice(0, 20);
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searchHistory));
    localStorage.setItem(LAST_SEARCH_KEY, query);
  } catch {
    // Keep the current session history if browser storage is unavailable.
  }
}

shortsContainer.addEventListener(
  "wheel",
  (event) => {
    if (shortsContainer.scrollWidth <= shortsContainer.clientWidth) return;
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault();
      shortsContainer.scrollLeft += event.deltaY;
    }
  },
  { passive: false },
);

async function searchVideos(query, pageToken = "") {
  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    maxResults: "50",
    key: API_KEY,
  });
  if (pageToken) params.set("pageToken", pageToken);

  const url = `https://www.googleapis.com/youtube/v3/search?${params}`;
  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error(
        "YouTube API qidiruv kvotasi tugagan yoki so‘rov limiti oshgan. Kvota tiklangach qayta urinib ko‘ring.",
      );
    }
    throw new Error(
      `YouTube API xatoligi (${response.status}). API kalit va quota'ni tekshiring.`,
    );
  }

  const data = await response.json();
  return data;
}

async function searchShortVideos(searchResults) {
  const candidates = searchResults.filter(
    (video) =>
      video.id.videoId &&
      [video.snippet.title, video.snippet.description]
        .some((text) => (text || "").toLowerCase().includes("#shorts")),
  );
  if (candidates.length === 0) return [];

  const params = new URLSearchParams({
    part: "snippet,contentDetails",
    id: candidates.map((video) => video.id.videoId).join(","),
    key: API_KEY,
  });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
  if (!response.ok) {
    throw new Error(`Shorts ma’lumotlarini olishda xatolik (${response.status}).`);
  }

  const details = await response.json();
  const shortIds = new Set(
    (details.items || []).filter((video) => {
      const parts = video.contentDetails.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      const seconds = parts
        ? Number(parts[1] || 0) * 3600 + Number(parts[2] || 0) * 60 + Number(parts[3] || 0)
        : Infinity;
      const hasShortTag = [video.snippet.title, video.snippet.description]
        .some((text) => (text || "").toLowerCase().includes("#shorts")) ||
        (video.snippet.tags || []).some((tag) => tag.replace(/^#/, "").toLowerCase() === "shorts");
      return hasShortTag && seconds <= 180;
    }).map((video) => video.id),
  );

  return candidates.filter((video) => shortIds.has(video.id.videoId));
}

function formatVideoDuration(isoDuration) {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "";

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

async function getVideoDurations(videos) {
  const ids = videos.map((video) => video.id.videoId).filter(Boolean);
  if (ids.length === 0) return new Map();

  const params = new URLSearchParams({
    part: "contentDetails",
    id: ids.join(","),
    key: API_KEY,
  });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
  if (!response.ok) throw new Error(`Video davomiyligini olishda xatolik (${response.status}).`);

  const data = await response.json();
  return new Map(
    (data.items || []).map((video) => [video.id, formatVideoDuration(video.contentDetails.duration)]),
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

  const thumbnailWrap = document.createElement("div");
  thumbnailWrap.className = "video-thumb-wrap";
  thumbnailWrap.append(img);
  if (isRecommendation && video.durationLabel) {
    const duration = document.createElement("span");
    duration.className = "video-duration";
    duration.textContent = video.durationLabel;
    thumbnailWrap.append(duration);
  }

  const cup = document.createElement("div");
  cup.className = isRecommendation ? "recommendation-info" : "video-info";
  const title = document.createElement(isRecommendation ? "h4" : "h3");
  title.textContent = video.snippet.title;
  const text = document.createElement("p");
  text.textContent = video.snippet.channelTitle;

  cup.append(title, text);
  tugma.append(thumbnailWrap, cup);
  tugma.addEventListener("click", () => playVideo(video));
  return tugma;
}

function createShortCard(video, index) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "short-card";

  const thumbnail = document.createElement("img");
  thumbnail.className = "short-thumb";
  thumbnail.src =
    video.snippet.thumbnails?.high?.url ||
    video.snippet.thumbnails?.medium?.url ||
    video.snippet.thumbnails?.default?.url ||
    "";
  thumbnail.alt = video.snippet.title;
  thumbnail.loading = "lazy";

  const title = document.createElement("h3");
  title.textContent = video.snippet.title;
  const channel = document.createElement("p");
  channel.textContent = video.snippet.channelTitle;

  card.append(thumbnail, title, channel);
  card.addEventListener("click", () => playVideo(video, true, index));
  return card;
}

function displayVideos(videos, shortVideos) {
  container.replaceChildren();
  shortsContainer.replaceChildren();
  container.append(shortsSection);
  const shortsIds = new Set(shortVideos.map((video) => video.id.videoId));
  shortsVideos = shortVideos.slice(0, 50);
  const regularVideos = videos.filter(
    (video) => video.id.videoId && !shortsIds.has(video.id.videoId),
  );
  currentShortIndex = -1;
  if (regularVideos.length === 0 && shortsVideos.length === 0) {
    videosTitle.classList.add("hidden");
    shortsSection.classList.add("hidden");
    statusText.textContent = "Video topilmadi.";
    return false;
  }
  videosTitle.classList.toggle("hidden", regularVideos.length === 0);
  shortsSection.classList.toggle("hidden", shortsVideos.length === 0);
  shortsVideos.forEach((video, index) =>
    shortsContainer.append(createShortCard(video, index)),
  );
  regularVideos.slice(0, 8).forEach((video) => container.insertBefore(createVideoCard(video), shortsSection));
  regularVideos.slice(8).forEach((video) => container.append(createVideoCard(video)));
  return true;
}

function playVideo(video, isShort = false, shortIndex = -1, autoplay = false) {
  const videoId = video.id.videoId;
  if (!videoId) return;

  if (!autoplay) {
    recommendationQueue = [];
    playedVideoIds = new Set();
  }
  playedVideoIds.add(videoId);
  ++recommendationRequestId;
  currentShortIndex = isShort ? shortIndex : -1;
  nextShortButton.classList.toggle("hidden", !isShort || shortsVideos.length < 2);
  previousShortButton.classList.toggle("hidden", !isShort || shortIndex <= 0);
  document.body.classList.toggle("shorts-page", isShort);
  watchSection.classList.toggle("shorts-watch", isShort);
  searchSection.classList.add("hidden");
  watchSection.classList.remove("hidden");
  statusText.textContent = "";
  videoTitle.textContent = video.snippet.title;
  channelName.textContent = video.snippet.channelTitle;

  playerContainer.replaceChildren();
  if (isShort) {
    const mount = document.createElement("div");
    playerContainer.append(mount);
    createShortPlayer(mount, videoId);
  } else {
    const mount = document.createElement("div");
    playerContainer.append(mount);
    createRegularPlayer(mount, videoId, autoplay);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (!isShort && !autoplay) loadRecommendations(video);
}

function loadYouTubeIframeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiReadyPromise) return youtubeApiReadyPromise;

  youtubeApiReadyPromise = new Promise((resolve) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      resolve(window.YT);
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const apiScript = document.createElement("script");
      apiScript.src = "https://www.youtube.com/iframe_api";
      document.head.append(apiScript);
    }
  });

  return youtubeApiReadyPromise;
}

async function createShortPlayer(mount, videoId) {
  const YT = await loadYouTubeIframeApi();
  if (!mount.isConnected) return;

  new YT.Player(mount, {
    videoId,
    playerVars: { autoplay: 1, controls: 1, fs: 0, playsinline: 1, rel: 0 },
    events: {
      onReady(event) {
        event.target.unMute();
        event.target.playVideo();
      },
      onStateChange(event) {
        if (event.data === YT.PlayerState.ENDED) {
          event.target.seekTo(0);
          event.target.playVideo();
        }
      },
    },
  });
}

async function createRegularPlayer(mount, videoId, autoplay) {
  const YT = await loadYouTubeIframeApi();
  if (!mount.isConnected) return;

  new YT.Player(mount, {
    videoId,
    playerVars: { autoplay: autoplay ? 1 : 0, controls: 1, playsinline: 1, rel: 0 },
    events: {
      onReady(event) {
        if (autoplay) event.target.playVideo();
      },
      onStateChange(event) {
        if (event.data === YT.PlayerState.ENDED) playNextRecommendation();
      },
    },
  });
}

function playNextRecommendation() {
  const nextVideo = recommendationQueue.shift();
  if (nextVideo) playVideo(nextVideo, false, -1, true);
}

async function navigateShort(direction) {
  if (shortNavigationInProgress || shortsVideos.length < 2 || currentShortIndex < 0) return;
  let nextIndex = currentShortIndex + direction;
  if (direction < 0 && nextIndex < 0) return;
  if (direction > 0 && nextIndex >= shortsVideos.length) nextIndex = 0;

  shortNavigationInProgress = true;
  try {
    if (playerContainer.animate) {
      const exitAnimation = playerContainer.animate(
        [
          { transform: "translateY(0)", opacity: 1 },
          { transform: `translateY(${direction > 0 ? "-100%" : "100%"})`, opacity: 0 },
        ],
        { duration: 180, easing: "ease-in", fill: "forwards" },
      );
      await exitAnimation.finished.catch(() => {});
      exitAnimation.cancel();
    }

    playVideo(shortsVideos[nextIndex], true, nextIndex);
    if (playerContainer.animate) {
      playerContainer.animate(
        [
          { transform: `translateY(${direction > 0 ? "100%" : "-100%"})`, opacity: 0 },
          { transform: "translateY(0)", opacity: 1 },
        ],
        { duration: 240, easing: "ease-out" },
      );
    }
  } finally {
    shortNavigationInProgress = false;
  }
}
async function loadRecommendations(video, { append = false } = {}) {
  const currentRequest = ++recommendationRequestId;
  if (!append) {
    recommendations.replaceChildren();
    recommendationQueue = [];
  }
  recommendationStatus.textContent = "O‘xshash videolar yuklanmoqda...";

  try {
    const data = await searchVideos(video.snippet.title);
    if (currentRequest !== recommendationRequestId) return;
    const filtered = (data.items || []).filter(
      (item) =>
        item.id.videoId &&
        item.id.videoId !== video.id.videoId &&
        !playedVideoIds.has(item.id.videoId) &&
        !recommendationQueue.some((queued) => queued.id.videoId === item.id.videoId),
    );
    if (filtered.length === 0) {
      if (recommendationQueue.length === 0) {
        recommendationStatus.textContent = "O‘xshash video topilmadi.";
      } else {
        recommendationStatus.textContent = "";
      }
      return;
    }
    try {
      const durations = await getVideoDurations(filtered);
      filtered.forEach((item) => {
        item.durationLabel = durations.get(item.id.videoId) || "";
      });
    } catch (durationError) {
      console.error("Video davomiyligi xatoligi:", durationError);
    }
    if (currentRequest !== recommendationRequestId) return;
    recommendationQueue.push(...filtered);
    filtered.forEach((item) =>
      recommendations.append(createVideoCard(item, true)),
    );
    recommendationStatus.textContent = "";
  } catch (error) {
    if (currentRequest !== recommendationRequestId) return;
    recommendationStatus.textContent = error.message;
  } finally {
    if (currentRequest === recommendationRequestId) {
      console.log("Tavsiyalar so‘rovi tugadi");
    }
  }
}

function showSearchResults() {
  ++recommendationRequestId;
  document.body.classList.remove("shorts-page");
  watchSection.classList.remove("shorts-watch");
  watchSection.classList.add("hidden");
  searchSection.classList.remove("hidden");
  playerContainer.replaceChildren();
  recommendationStatus.textContent = "";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = input.value.trim();
  if (!query) return;
  const pageToken = query === lastSavedSearch ? reloadPageToken : "";
  reloadPageToken = "";
  saveSearchQuery(query);
  lastSavedSearch = query;
  searchHistoryPanel.classList.add("hidden");

  if (API_KEY === "YOUR_YOUTUBE_API_KEY") {
    statusText.textContent =
      "Avval script.js ichiga YouTube API kalitingizni kiriting.";
    return;
  }

  const currentRequest = ++searchRequestId;
  videosTitle.classList.add("hidden");
  shortsSection.classList.add("hidden");
  showSearchResults();
  container.replaceChildren();
  statusText.textContent = "Videolar yuklanmoqda...";

  try {
    const data = await searchVideos(query, pageToken);
    if (currentRequest !== searchRequestId) return;
    try {
      if (data.nextPageToken) {
        localStorage.setItem(NEXT_PAGE_TOKEN_KEY, data.nextPageToken);
      } else {
        localStorage.removeItem(NEXT_PAGE_TOKEN_KEY);
      }
    } catch {
      // Search still works when browser storage is unavailable.
    }

    let shortVideos = [];
    try {
      shortVideos = await searchShortVideos(data.items || []);
    } catch (shortsError) {
      console.error("Shorts qidiruv xatoligi:", shortsError);
    }
    if (currentRequest !== searchRequestId) return;

    if (displayVideos(data.items || [], shortVideos)) statusText.textContent = "";
  } catch (error) {
    if (currentRequest !== searchRequestId) return;
    statusText.textContent = error.message;
    console.error("Qidiruv xatoligi:", error);
  } finally {
    if (currentRequest === searchRequestId) {
      console.log("Qidiruv tugadi");
    }
  }
});

backButton.addEventListener("click", showSearchResults);
nextShortButton.addEventListener("click", () => navigateShort(1));
previousShortButton.addEventListener("click", () => navigateShort(-1));
input.addEventListener("focus", () => renderSearchHistory());
input.addEventListener("input", () => renderSearchHistory(input.value.trim()));
document.addEventListener("click", (event) => {
  if (!form.contains(event.target)) searchHistoryPanel.classList.add("hidden");
});
input.addEventListener("keydown", (event) => {
  if (event.key === "Escape") searchHistoryPanel.classList.add("hidden");
});
logo.addEventListener("click", () => {
  ++searchRequestId;
  showSearchResults();
  statusText.textContent = "";
});

loadYouTubeIframeApi();
if (lastSavedSearch) form.requestSubmit();
