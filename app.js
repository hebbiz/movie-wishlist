const SUPABASE_URL = "https://mttkectgdqqmejpenkrn.supabase.co";
const SUPABASE_KEY = "sb_publishable_LS48R8c2aoDZ_MSe4LWl9Q__n1M7zf_";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const movieForm = document.getElementById("movieForm");
const moviesGrid = document.getElementById("moviesGrid");
const movieCount = document.getElementById("movieCount");
const searchInput = document.getElementById("searchInput");
const clearSearchButton = document.getElementById("clearSearchButton");
const searchHint = document.getElementById("searchHint");
const filterButtons = document.querySelectorAll(".filter-btn");
const submitButton = document.getElementById("submitButton");
const cancelEditButton = document.getElementById("cancelEditButton");
const formPanel = document.getElementById("formPanel");
const formTitle = document.getElementById("formTitle");
const showAddFormButton = document.getElementById("showAddFormButton");
const statusSelect = document.getElementById("status");
const recommendedMediumGroup = document.getElementById("recommendedMediumGroup");
const ownedMediumGroup = document.getElementById("ownedMediumGroup");
const purchaseLabel = document.getElementById("purchaseLabel");
const lookupButton = document.getElementById("lookupButton");
const loginButton = document.getElementById("loginButton");
const logoutButton = document.getElementById("logoutButton");
const userInfo = document.getElementById("userInfo");
const userEmail = document.getElementById("userEmail");
const userMenuButton = document.getElementById("userMenuButton");
const userMenuDropdown = document.getElementById("userMenuDropdown");
const editProfileButton = document.getElementById("editProfileButton");
const profilePanel = document.getElementById("profilePanel");
const displayNameInput = document.getElementById("displayNameInput");
const saveProfileButton = document.getElementById("saveProfileButton");
const cancelProfileButton = document.getElementById("cancelProfileButton");
const mainView = document.getElementById("mainView");
const mykolaView = document.getElementById("mykolaView");
const openMykolaButton = document.getElementById("openMykolaButton");
const backFromMykolaButton = document.getElementById("backFromMykolaButton");
const mykolaChat = document.getElementById("mykolaChat");

let movies = [];
let editingMovieId = null;
let activeFilter = "all";
let pendingImdbUrl = null;
let pendingImdbId = null;
let currentProfile = null;
let mykolaConversationFinished =
  localStorage.getItem("mykolaConversationFinished") === "true";
let currentUser = null;
let currentRole = null;
let currentGroupId = "2481bff1-a26f-4173-8a47-f1b16029079d";

async function updateAuthUI() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (session?.user) {
    currentUser = session.user
    
    loginButton.style.display = "none";
    userInfo.style.display = "block";

    const { data: profile, error } = await supabaseClient
      .from("profiles")
      .select("display_name, email")
      .eq("id", session.user.id)
      .single();

    if (error) {
      console.warn("Profile load error:", error);
      currentProfile = null;
      userEmail.textContent = session.user.email;
      return;
    }

    currentProfile = profile;

    const displayName =
      profile?.display_name || profile?.email || session.user.email;

    userEmail.textContent = displayName;
  } else {
      currentUser = null;
      currentRole = null;
      currentProfile = null;

      loginButton.style.display = "block";
      userInfo.style.display = "none";
      userEmail.textContent = "";
  }
}

function isAnonymous() {
  return !currentUser;
}

function isVisitor() {
  return currentRole === "visitor";
}

function isMember() {
  return currentRole === "member";
}

function isOwner() {
  return currentRole === "owner";
}

function canOpenPurchaseUrl() {
  return isMember() || isOwner();
}

function canAddMovie() {
  return isMember() || isOwner();
}

function canUpdateMovie() {
  return isMember() || isOwner();
}

function canDeleteMovie(movie) {
  if (isOwner()) {
    return true;
  }

  if (isMember()) {
    return (
      movie.status === "wishlist"
    );
  }

  return false;
}

function canInviteUsers() {
  return isOwner();
}

function showAccessDenied(message) {
  alert(message);
}

const accessMessages = {
  viewPurchaseUrl:
    "Адміністратор обмежив вашу можливість переглядати посилання на покупку.",

  addOrEdit:
    "Адміністратор обмежив вашу можливість додавати чи редагувати фільми.",

  delete:
    "Адміністратор обмежив вашу можливість видаляти фільми.",

  invite:
    "Адміністратор обмежив вашу можливість запрошувати користувачів.",
};

async function loadCurrentRole() {
  if (!currentUser) {
    currentRole = null;
    return;
  }

  const { data, error } = await supabaseClient
    .from("group_members")
    .select("role")
    .eq("group_id", currentGroupId)
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.warn("Role load error:", error);
    currentRole = "visitor";
    return;
  }

  currentRole = (data?.role || "visitor").trim().toLowerCase();
}

function applyAccessLevel() {
  if (isAnonymous()) {
    mainView.style.display = "none";
    mykolaView.style.display = "none";
    return;
  }

  mainView.style.display = "";
  mykolaView.style.display = "";
}

async function ensureVisitorMembership() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session?.user) return;

  const { data } = await supabaseClient
    .from("group_members")
    .select("id")
    .eq("group_id", currentGroupId)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (data) return;

  const { error: insertError } = await supabaseClient
  .from("group_members")
  .insert({
    group_id: currentGroupId,
    user_id: session.user.id,
    role: "visitor",
  });

  if (insertError) {
    console.error("Visitor insert error:", insertError);
  }

}

loginButton.addEventListener("click", async () => {
  await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
    },
  });
});

logoutButton.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();

  currentRole = null;

  resetMykolaChat();
  clearMykolaFinishedState();

  await updateAuthUI();
  applyAccessLevel();
});

async function loadMovies() {
  console.log("Loading movies...");

  const { data, error } = await supabaseClient
    .from("movies")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Load movies error:", error);

    alert(
      "Помилка завантаження фільмів\n\n" +
      "Code: " + (error.code || "N/A") + "\n" +
      "Message: " + error.message + "\n" +
      "Details: " + (error.details || "No details")
    );

    return;
  }

  console.log("Movies loaded:", data);

  movies = data || [];
  applySearchAndFilters();
}

function renderMovies(list) {
  moviesGrid.innerHTML = "";
  movieCount.textContent = `(${list.length})`;

  if (list.length === 0) {
    moviesGrid.innerHTML = "<p>Нічого не знайдено.</p>";
    return;
  }

  list.forEach((movie) => {
    const card = document.createElement("article");
    card.className = "card";

    const poster = movie.poster_url
      ? movie.poster_url
      : "https://via.placeholder.com/400x600?text=No+Poster";

    card.innerHTML = `
      <div class="poster-wrapper">
        <img src="${poster}" alt="${movie.title}" />

        <div class="poster-badges">
           ${
             movie.recommended_medium === "Наразі недоступний"
               ? `<span class="poster-badge unavailable-badge">Наразі недоступний</span>`
           : ""
           }

           ${
             movie.status === "watched"
               ? `<span class="poster-badge watched-badge">Переглянуто</span>`
           : ""
           }
        </div>
        
      </div>

      <div class="card-content">
        <h3>${movie.title}</h3>

        <div class="meta">
          ${movie.year || "Рік не вказано"}<br>
          Рекомендовано: ${movie.recommended_medium || "не вказано"}<br>
          Статус: ${formatStatus(movie.status)}<br>
          Придбано: ${movie.is_owned ? "так" : "ні"}<br>
          ${movie.owned_medium ? "Носій: " + movie.owned_medium + "<br>" : ""}
          ${movie.added_by ? "Додав: " + movie.added_by + "<br>" : ""}
        </div>

        ${movie.notes ? `
          <p class="movie-notes collapsed" onclick="toggleNotes(this)">
            ${movie.notes}
          </p>
        ` : ""}

        <div class="links">
          ${movie.imdb_url
            ? `<a href="${movie.imdb_url}" target="_blank">IMDb</a>`
            : ""
          }

          ${movie.purchase_url
            ? `
             <a
               href="#"
               class="purchase-link"
               data-url="${movie.purchase_url}"
            >
               ${getPurchaseLabel(movie)}
             </a>
            `
            : ""
          }
        </div>

        <button onclick="startEditMovie('${movie.id}')">
          Редагувати
        </button>

        <div class="card-menu">
         <button class="menu-button" type="button" data-menu-id="${movie.id}">⋯</button>

        <div class="menu-dropdown" id="menu-${movie.id}">
         <button type="button" data-watch-id="${movie.id}">Позначити як переглянуте</button>
         <button type="button" class="delete-option" data-delete-id="${movie.id}">Видалити</button>
        </div>
       </div>
      </div>
    `;
    
    moviesGrid.appendChild(card);
  });
  attachCardMenuHandlers();
  attachPurchaseLinkHandlers();
}

function attachPurchaseLinkHandlers() {

  document.querySelectorAll(".purchase-link").forEach((link) => {

    link.addEventListener("click", (event) => {

      event.preventDefault();

      if (!canOpenPurchaseUrl()) {

        showAccessDenied(accessMessages.viewPurchaseUrl);
        return;
        
      }

      window.open(
        link.dataset.url,
        "_blank"
      );
    });

  });

}

function attachCardMenuHandlers() {
  document.querySelectorAll("[data-menu-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.menuId;
      const menu = document.getElementById("menu-" + id);

      document.querySelectorAll(".menu-dropdown").forEach((dropdown) => {
        if (dropdown !== menu) {
          dropdown.style.display = "none";
        }
      });

      if (menu) {
        menu.style.display = menu.style.display === "block" ? "none" : "block";
      }
    });
  });

  document.querySelectorAll("[data-watch-id]").forEach((button) => {
    button.addEventListener("click", () => {
      markAsWatched(button.dataset.watchId);
    });
  });

  document.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", () => {
      deleteMovie(button.dataset.deleteId);
    });
  });
}

  document.addEventListener("click", (event) => {
    const clickedInsideMenu = event.target.closest(".card-menu");

  if (!clickedInsideMenu) {
    document.querySelectorAll(".menu-dropdown").forEach((menu) => {
      menu.style.display = "none";
    });
  }
});

function formatStatus(status) {
  if (status === "wishlist") return "хочу переглянути";
  if (status === "ordered") return "замовлено";
  if (status === "owned") return "придбано";
  if (status === "watched") return "переглянуто";

  return status || "не вказано";
}

function extractImdbId(value) {
  if (!value) return null;

  const match = value.match(/tt\d+/);
  return match ? match[0] : null;
}

function normalizeImdbIdFromUrl(value) {
  if (!value) return null;
  return extractImdbId(value.trim());
}

function findMovieByImdbId(imdbId) {
  if (!imdbId) return null;

  return movies.find((movie) => {
    const existingImdbId = normalizeImdbIdFromUrl(movie.imdb_url);
    return existingImdbId === imdbId;
  });
}

function resetSmartSearchState() {
  pendingImdbUrl = null;
  pendingImdbId = null;

  searchHint.textContent = "";
  searchHint.className = "search-hint";

  showAddFormButton.textContent = "Додати";
}

function getPurchaseLabel(movie) {
  const streamingServices = [
  "Netflix",
  "HBO Max",
  "Disney+",
  "Apple TV / iTunes",
  "Prime Video",
  "Megogo",
  ];

  const displayNames = {
  "Apple TV / iTunes": "Apple TV",
  "Prime Video": "Prime Video",
  "HBO Max": "HBO Max",
  "Disney+": "Disney+",
  "Netflix": "Netflix",
  "Megogo": "Megogo",
  };

  const isPurchasedStatus = ["ordered", "owned", "watched"].includes(
    movie.status
  );

  const isStreaming = streamingServices.includes(movie.owned_medium);

  if (isPurchasedStatus && isStreaming) {
    const displayName = displayNames[movie.owned_medium] || movie.owned_medium;
    return "Дивитись на " + displayName;
  }

  if (movie.status === "wishlist") {
    return "Де купити";
  }

  return "Де придбано";
}

function toggleNotes(element) {
  element.classList.toggle("collapsed");
}

function getMovieFormData() {
  return {
    title: document.getElementById("title").value.trim(),
    year: Number(document.getElementById("year").value) || null,
    imdb_url: document.getElementById("imdb_url").value.trim() || null,
    poster_url: document.getElementById("poster_url").value.trim() || null,
    recommended_medium:
      document.getElementById("recommended_medium").value || null,
    status: document.getElementById("status").value,
    is_owned: ["ordered", "owned", "watched"].includes(
      document.getElementById("status").value
      ),
    owned_medium:
      document.getElementById("owned_medium").value.trim() || null,
    purchase_url:
      document.getElementById("purchase_url").value.trim() || null,
    notes: document.getElementById("notes").value.trim() || null,
    added_by: document.getElementById("added_by").value.trim() || null,
  };
}

async function getCurrentUserDisplayName() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session?.user) {
    return null;
  }

  if (currentProfile?.display_name) {
    return currentProfile.display_name;
  }

  if (currentProfile?.email) {
    return currentProfile.email;
  }

  return session.user.email || null;
}

function getUserAvatarLetter() {
  const name =
    currentProfile?.display_name ||
    currentProfile?.email ||
    "Я";

  return name.trim().charAt(0).toUpperCase();
}

function fillForm(movie) {
  document.getElementById("title").value = movie.title || "";
  document.getElementById("year").value = movie.year || "";
  document.getElementById("imdb_url").value = movie.imdb_url || "";
  document.getElementById("poster_url").value = movie.poster_url || "";
  document.getElementById("recommended_medium").value =
    movie.recommended_medium || "";
  document.getElementById("status").value =
    movie.status || "wishlist";
  document.getElementById("owned_medium").value =
    movie.owned_medium || "";
  document.getElementById("purchase_url").value =
    movie.purchase_url || "";
  document.getElementById("notes").value =
    movie.notes || "";
setAddedByField(movie.added_by || "", !!movie.added_by);
  
updateFormVisibility();
  
}

function setAddedByField(value, isLocked) {
  const addedByInput = document.getElementById("added_by");

  addedByInput.value = value || "";
  addedByInput.readOnly = isLocked;
  addedByInput.classList.toggle("readonly-field", isLocked);
}

function updateFormVisibility() {
  const status = statusSelect.value;

  if (status === "wishlist") {
    recommendedMediumGroup.style.display = "block";
    ownedMediumGroup.style.display = "none";
    purchaseLabel.textContent = "Де купити / рекомендоване посилання";
  } else {
    recommendedMediumGroup.style.display = "none";
    ownedMediumGroup.style.display = "block";
    purchaseLabel.textContent = "Де куплено / посилання";
  }
}

function resetFormMode() {
  console.log("Reset form mode");

  editingMovieId = null;
  movieForm.reset();
  setAddedByField("", false);

  formTitle.textContent = "Додати фільм";
  submitButton.textContent = "Додати";
  cancelEditButton.style.display = "none";
  formPanel.style.display = "none";
  showAddFormButton.style.display = "block";

  updateFormVisibility();
}

function startEditMovie(id) {
  console.log("Editing movie:", id);

  const movie = movies.find((item) => item.id === id);

  if (!movie) {
    alert("Фільм не знайдено.");
    return;
  }

  editingMovieId = id;

  formPanel.style.display = "block";
   showAddFormButton.style.display = "none";
   cancelEditButton.style.display = "block";
   formTitle.textContent = "Редагувати фільм";

  fillForm(movie);

  submitButton.textContent = "Зберегти зміни";

  cancelEditButton.style.display = "block";

  window.scrollTo({
    top: movieForm.offsetTop - 20,
    behavior: "smooth",
  });
}

movieForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (editingMovieId && !canUpdateMovie()) {
    showAccessDenied(accessMessages.addOrEdit);
    return;
  }

  if (!editingMovieId && !canAddMovie()) {
    showAccessDenied(accessMessages.addOrEdit);
    return;
  }

  const movieData = getMovieFormData();

    if (!movieData.added_by) {
       movieData.added_by = await getCurrentUserDisplayName();
    }

console.log("Form data:", movieData);

  if (!movieData.title) {
    alert("Назва фільму обов'язкова.");
    return;
  }

  if (movieData.imdb_url) {
  const normalizedImdbUrl = movieData.imdb_url.trim().toLowerCase();

  const duplicateMovie = movies.find((movie) => {
    if (!movie.imdb_url) return false;

    return (
      movie.imdb_url.trim().toLowerCase() === normalizedImdbUrl &&
      movie.id !== editingMovieId
    );
  });

  if (duplicateMovie) {
    alert("Такий фільм вже додано до списку.");
    return;
  }
}

  if (editingMovieId) {
    console.log("Updating movie:", editingMovieId);

    const { data, error } = await supabaseClient
      .from("movies")
      .update(movieData)
      .eq("id", editingMovieId)
      .select();

    if (error) {
      console.error("Update error:", error);

      alert(
        "Помилка оновлення фільму\n\n" +
        "Code: " + (error.code || "N/A") + "\n" +
        "Message: " + error.message + "\n" +
        "Details: " + (error.details || "No details")
      );

      return;
    }

    console.log("Update success:", data);

    alert("Зміни збережено");

    resetFormMode();

    loadMovies();

    return;
  }

  console.log("Creating new movie");

  const { data, error } = await supabaseClient
    .from("movies")
    .insert([movieData])
    .select();

  if (error) {
    console.error("Insert error:", error);

    alert(
      "Помилка додавання фільму\n\n" +
      "Code: " + (error.code || "N/A") + "\n" +
      "Message: " + error.message + "\n" +
      "Details: " + (error.details || "No details")
    );

    return;
  }

  console.log("Insert success:", data);

  alert("Фільм успішно додано");

  resetFormMode();

  loadMovies();
});

cancelEditButton.addEventListener("click", () => {
  resetFormMode();
});

async function deleteMovie(id) {
  console.log("Deleting movie:", id);

  const movie = movies.find((item) => item.id === id);

  if (!movie) {
    alert("Фільм не знайдено.");
    return;
  }

  if (!canDeleteMovie(movie)) {

  if (isMember()) {
    alert(
      "Ви не можете видаляти фільми з цього списку. Зверніться до адміністратора."
    );
  } else {
    showAccessDenied(accessMessages.delete);
  }

  return;
}

  const confirmed = confirm("Видалити цей фільм?");

  if (!confirmed) {
    return;
  }

  // далі delete Supabase код

  const { error } = await supabaseClient
    .from("movies")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Delete error:", error);

    alert(
      "Помилка видалення фільму\n\n" +
      "Code: " + (error.code || "N/A") + "\n" +
      "Message: " + error.message + "\n" +
      "Details: " + (error.details || "No details")
    );

    return;
  }

  console.log("Delete success");

  if (editingMovieId === id) {
    resetFormMode();
  }

  loadMovies();
}

async function markAsWatched(id) {
  const movie = movies.find((item) => item.id === id)

  if (!movie) {
    alert("Фільм не знайдено.");
    return;
  }

  if (!canUpdateMovie()) {
    showAccessDenied(accessMessages.addOrEdit);
  return;
  }

  const updateData = {
    status: "watched",
    is_owned: true,
  };

  if (
    !movie.owned_medium &&
    movie.recommended_medium &&
    movie.recommended_medium !== "Наразі недоступний"
  ) {
    updateData.owned_medium = movie.recommended_medium;
  }

  const { error } = await supabaseClient
    .from("movies")
    .update(updateData)
    .eq("id", id);

  if (error) {
    alert(
      "Помилка оновлення статусу\n\n" +
      "Code: " + (error.code || "N/A") + "\n" +
      "Message: " + error.message
    );

    return;
  }

  loadMovies();
}

function applySearchAndFilters() {
  const query = searchInput.value.toLowerCase().trim();
  const imdbId = extractImdbId(query);

  resetSmartSearchState();

  if (imdbId) {
    const existingMovie = findMovieByImdbId(imdbId);

    if (existingMovie) {
      const isUnavailable =
        existingMovie.recommended_medium === "Наразі недоступний";

      if (isUnavailable) {
        searchHint.textContent =
        "Фільм знайдено у ваших списках перегляду. Адміністратор, на жаль, позначив його як тимчасово недоступний на стрімінгових платформах та фізичних носіях.";
        searchHint.className = "search-hint unavailable";
        
      } else {
        searchHint.textContent = "Цей фільм вже є у ваших списках.";
        searchHint.className = "search-hint warning";
      }
    }
    else {
      pendingImdbUrl = searchInput.value.trim();
      pendingImdbId = imdbId;

      searchHint.textContent =
        "Якщо хочете переглянути цей фільм, натисніть «Додати з IMDb». Адміністратор може змінити статус та інформацію про фільм пізніше.";
      searchHint.className = "search-hint positive";

      showAddFormButton.textContent = "Додати з IMDb";
    }
  }

  const filtered = movies.filter((movie) => {
    const searchableText = [
      movie.title,
      movie.year,
      movie.recommended_medium,
      movie.owned_medium,
      movie.status,
      movie.notes,
      movie.added_by,
      movie.imdb_url,
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch = searchableText.includes(query);

    let matchesFilter = true;

    if (activeFilter === "wishlist") {
      matchesFilter = movie.status === "wishlist";
    }

    if (activeFilter === "ordered") {
      matchesFilter = movie.status === "ordered";
    }

    if (activeFilter === "owned") {
      matchesFilter = movie.status === "owned";
    }

    if (activeFilter === "watched") {
      matchesFilter = movie.status === "watched";
    }

    if (activeFilter === "uhd") {
      matchesFilter =
        movie.recommended_medium === "4K UHD Blu-ray" ||
        movie.owned_medium === "4K UHD Blu-ray";
    }

    return matchesSearch && matchesFilter;
  });

  renderMovies(filtered);
}

function getRecommendationCandidates() {
  return movies.filter((movie) => {
    return (
      movie.recommended_medium !== "Наразі недоступний" &&
      movie.status !== "watched" &&
      movie.status !== "ordered"
    );
  });
}

function isStreamingMedium(medium) {
  const streamingServices = [
    "Netflix",
    "HBO Max",
    "Disney+",
    "Apple TV / iTunes",
    "Prime Video",
    "Megogo",
  ];

  return streamingServices.includes(medium);
}

function pickMykolaMovie() {
  const candidates = getRecommendationCandidates();

  if (candidates.length === 0) {
    return null;
  }

  const ownedMovies = candidates.filter((movie) => {
    return movie.status === "owned";
  });

  const streamingWishlistMovies = candidates.filter((movie) => {
    return (
      movie.status === "wishlist" &&
      isStreamingMedium(movie.recommended_medium)
    );
  });

  const otherMovies = candidates.filter((movie) => {
    return (
      movie.status !== "owned" &&
      !(
        movie.status === "wishlist" &&
        isStreamingMedium(movie.recommended_medium)
      )
    );
  });

  const groups = [
    {
      weight: 0.5,
      movies: ownedMovies,
    },
    {
      weight: 0.4,
      movies: streamingWishlistMovies,
    },
    {
      weight: 0.1,
      movies: otherMovies,
    },
  ].filter((group) => group.movies.length > 0);

  if (groups.length === 0) {
    return null;
  }

  const totalWeight = groups.reduce((sum, group) => {
    return sum + group.weight;
  }, 0);

  let randomValue = Math.random() * totalWeight;

  for (const group of groups) {
    randomValue -= group.weight;

    if (randomValue <= 0) {
      return getRandomItem(group.movies);
    }
  }

  return getRandomItem(groups[groups.length - 1].movies);
}

function getRandomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

const mykolaRecommendationPhrases = [
  "Я довго думав. Приблизно 0.3 секунди. Сьогодні я б радив:",
  "Ви ж все одно будете ще 20 хвилин вибирати. Тому пропоную:",
  "Я міг би запропонувати щось дуже складне. Але навіщо? Дивіться:",
  "Мій скромний, але впевнений вибір:",
  "Після короткого, але науково бездоганного аналізу:",
  "Як доктор наук кажу: тут усе очевидно.",
  "Не хочу тиснути авторитетом, але вибір правильний:",
  "Наука не завжди має відповіді. Але сьогодні має:",
  "Я перевірив усі змінні. Результат такий:",
  "Без зайвої метафізики. Ставте:",
  "Пив би чай, радив би те саме. Але ми ж дорослі люди:",
  "Є відчуття, що вечір просить саме це:",
  "Не сперечайтесь із Миколою. Просто увімкніть:",
  "Це не порада. Це майже консенсус кафедри:",
  "Скажу культурно: кращого варіанту зараз не бачу.",
];

const mykolaAnotherReplies = [
  "Гаразд. Резервний варіант теж непоганий.",
  "Добре. Але це вже майже розкіш.",
  "Можу ще. Я сьогодні у формі.",
  "Вимогливо. Поважаю.",
  "Не питання. У мене є ще аргументи.",
  "Добре, відкриваю другу пляшку логіки.",
  "Зараз підберемо щось менш очевидне.",
  "Гаразд. Перераховую коефіцієнти.",
];

const mykolaThankYouReplies = [
  "Дякую. Приємно мати справу з освіченою людиною.",
  "Звісно хороший. Я ж Микола.",
  "Нарешті це хтось визнав уголос.",
  "Приймається. Без зайвої скромності.",
  "Дякую. Це був науково обґрунтований вибір.",
  "От і домовились. Гарного перегляду.",
  "Приємно, коли аудиторія підготовлена.",
  "Я знав, що ми порозуміємось.",
];

const MYKOLA_GIF_CHANCE = 0.05;

function addUserBubble(text) {
  const row = document.createElement("div");
  row.className = "user-message-row";

  row.innerHTML = `
    <div class="user-bubble">
      ${text}
    </div>

    <div class="user-avatar">
      ${getUserAvatarLetter()}
    </div>
  `;

  const actions = document.getElementById("mykolaActions");
  mykolaChat.insertBefore(row, actions);
  scrollMykolaChatToBottom();
}

function addMykolaBubble(text) {
  const row = document.createElement("div");
  row.className = "mykola-message-row";

  row.innerHTML = `
    <div class="mykola-avatar">М</div>

    <div class="mykola-bubble">
      ${text}
    </div>
  `;

  const actions = document.getElementById("mykolaActions");
  mykolaChat.insertBefore(row, actions);
  scrollMykolaChatToBottom();
}

function addMykolaGif() {
  const row = document.createElement("div");

  row.className = "mykola-message-row";

  const gifId = "mykola-gif-" + Date.now();

  row.innerHTML = `
    <div class="mykola-avatar">М</div>

    <div class="mykola-gif-container">
      <img
        id="${gifId}"
        src="/assets/mykola.gif?t=${Date.now()}"
        alt="Микола схвалює"
        class="mykola-gif"
      >
    </div>
  `;

  const actions = document.getElementById("mykolaActions");

  if (actions) {
    mykolaChat.insertBefore(row, actions);
  } else {
    mykolaChat.appendChild(row);
  }

  scrollMykolaChatToBottom();

  const gifElement = document.getElementById(gifId);

  if (gifElement) {
    gifElement.addEventListener("load", () => {
      scrollMykolaChatToBottom();
    });
  }

  setTimeout(() => {
    scrollMykolaChatToBottom();
  }, 150);
}

function addMykolaTypingBubble() {
  const row = document.createElement("div");
  row.className = "mykola-message-row";
  row.dataset.typing = "true";

  row.innerHTML = `
    <div class="mykola-avatar">М</div>

    <div class="mykola-bubble mykola-typing-bubble">
      <span class="mykola-typing-dot"></span>
      <span class="mykola-typing-dot"></span>
      <span class="mykola-typing-dot"></span>
    </div>
  `;

  const actions = document.getElementById("mykolaActions");
  mykolaChat.insertBefore(row, actions);

  scrollMykolaChatToBottom();

  return row;
}

function removeMykolaTypingBubble() {
  const typingBubble = mykolaChat.querySelector('[data-typing="true"]');

  if (typingBubble) {
    typingBubble.remove();
  }
}

function runWithMykolaThinking(callback, delay = 2400) {
  addMykolaTypingBubble();

  setTimeout(() => {
    removeMykolaTypingBubble();
    callback();
  }, delay);
}

function recommendMykolaMovie() {
  const movie = pickMykolaMovie();

  if (!movie) {
    addMykolaBubble(
      "Я б і радий щось порадити, але список бажаного або порожній, або все тимчасово недоступне. Навіть Микола тут безсилий."
    );
    return;
  }

  const phrase = getRandomItem(mykolaRecommendationPhrases);

  addMykolaBubble(phrase);

    setTimeout(() => {

      addMykolaMovieBubble(movie);

    }, 350);

    setTimeout(() => {
      
      addMykolaFollowUpActions();
  
    }, 700);
}

function getMykolaRecommendedMedium(movie) {
  return (
    movie.owned_medium ||
    movie.recommended_medium ||
    "Носій не вказано"
  );
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function addMykolaMovieBubble(movie) {
  const row = document.createElement("div");
  row.className = "mykola-message-row";

  const poster = movie.poster_url
    ? movie.poster_url
    : "https://via.placeholder.com/300x450?text=No+Poster";

  const medium = getMykolaRecommendedMedium(movie);

  row.innerHTML = `
    <div class="mykola-avatar">М</div>

    <div class="mykola-movie-bubble">
      <div class="mykola-movie-poster-wrapper">
        <img
          src="${escapeHtml(poster)}"
          alt="${escapeHtml(movie.title)}"
          class="mykola-movie-poster"
        >

        <div class="mykola-movie-medium-badge">
          ${escapeHtml(medium)}
        </div>

        <div class="mykola-movie-title">
          <span>${escapeHtml(movie.title)}</span>
          <span class="mykola-movie-arrow">→</span>
        </div>
      </div>
    </div>
  `;

  const actions = document.getElementById("mykolaActions");
  mykolaChat.insertBefore(row, actions);

  scrollMykolaChatToBottom();

  const img = row.querySelector("img");

  if (img) {
    img.addEventListener("load", () => {
      scrollMykolaChatToBottom();
    });
  }

  const bubble = row.querySelector(".mykola-movie-bubble");

  if (bubble) {
    bubble.addEventListener("click", () => {
      openMovieFromMykola(movie);
    });
  }
}

function openMovieFromMykola(movie) {

  mykolaView.classList.remove("active");
  mainView.classList.add("active");

  activeFilter = movie.status;

  filterButtons.forEach((btn) => {
    btn.classList.remove("active");

    if (btn.dataset.filter === movie.status) {
      btn.classList.add("active");
    }
  });

  searchInput.value = movie.title;

  applySearchAndFilters();

  window.scrollTo({
    top: moviesGrid.offsetTop - 20,
    behavior: "smooth",
  });
}

function addMykolaFollowUpActions() {
  const row = document.createElement("div");
  row.className = "mykola-actions";
  row.id = "mykolaFollowUpActions";

  row.innerHTML = `
    <button id="mykolaAnotherButton" type="button">
      Порадь ще
    </button>

    <button id="mykolaThanksButton" type="button">
      Дякую, хороший смак
    </button>
  `;
  
  const actions = document.getElementById("mykolaActions");
  mykolaChat.insertBefore(row, actions);

  scrollMykolaChatToBottom();

  document.getElementById("mykolaAnotherButton").addEventListener("click", () => {
    row.remove();

    addUserBubble("Порадь ще");

      runWithMykolaThinking(() => {
        addMykolaBubble(getRandomItem(mykolaAnotherReplies));

        runWithMykolaThinking(() => {
        recommendMykolaMovie();
        }, 2200);
      }, 1600);
  });

  document.getElementById("mykolaThanksButton").addEventListener("click", () => {
  row.remove();

    addUserBubble("Дякую, хороший смак");

    runWithMykolaThinking(() => {

      const showGif = Math.random() < MYKOLA_GIF_CHANCE;

      if (showGif) {

        addMykolaBubble("Хороший смак я схвалюю.");

        finishMykolaConversation();

        setTimeout(() => {
          addMykolaGif();
        }, 1200);

      } else {

        addMykolaBubble(
          getRandomItem(mykolaThankYouReplies)
        );

        finishMykolaConversation();

      }

    }, 1800);
  });
}

function resetMykolaChat() {
  mykolaChat.innerHTML = `
    <div class="mykola-message-row">
      <div class="mykola-avatar">М</div>

      <div class="mykola-bubble">
        Вам щось підказати?
      </div>
    </div>

    <div class="mykola-actions" id="mykolaActions">
      <button id="mykolaYesButton" type="button">
        Так
      </button>

      <button id="mykolaNoButton" type="button">
        Ні
      </button>
    </div>
  `;

  wireMykolaActionButtons();
}

function saveMykolaState() {
  localStorage.setItem(
    "mykolaConversationFinished",
    mykolaConversationFinished ? "true" : "false"
  );
}

function finishMykolaConversation() {
  mykolaConversationFinished = true;
  saveMykolaState();
}

function clearMykolaFinishedState() {
  mykolaConversationFinished = false;
  saveMykolaState();
}

function openMykolaView() {
  mainView.classList.remove("active");

  if (mykolaConversationFinished) {
    resetMykolaChat();

    const firstBubble = mykolaChat.querySelector(".mykola-bubble");

    if (firstBubble) {
      firstBubble.textContent =
        "Ви знову тут. Вам ще щось підказати?";
    }

    clearMykolaFinishedState();
  }

  mykolaView.classList.add("active");

  window.scrollTo({
    top: mykolaView.offsetTop - 20,
    behavior: "smooth",
  });

  setTimeout(() => {
    scrollMykolaChatToBottom();
  }, 260);
}

openMykolaButton.addEventListener("click", () => {
  openMykolaView();
});

backFromMykolaButton.addEventListener("click", () => {

  mykolaView.classList.remove("active");

  mainView.classList.add("active");

  window.scrollTo({
    top: mainView.offsetTop - 20,
    behavior: "smooth",
  });
});

function wireMykolaActionButtons() {
  const yesButton = document.getElementById("mykolaYesButton");
  const noButton = document.getElementById("mykolaNoButton");
  const actions = document.getElementById("mykolaActions");

  yesButton.addEventListener("click", () => {
    addUserBubble("Так");
    actions.style.display = "none";

    runWithMykolaThinking(() => {
      recommendMykolaMovie();
    });
  });

  noButton.addEventListener("click", () => {
    addUserBubble("Ні");
    actions.style.display = "none";

    runWithMykolaThinking(() => {
      addMykolaBubble(
        "Ну й добре. Я теж іноді просто дивлюсь на список і нічого не обираю."
      );

      finishMykolaConversation();
    }, 1800);
  });
}

function scrollMykolaChatToBottom() {
  const bottomOffset = 72;

  const targetPosition =
    mykolaChat.getBoundingClientRect().bottom +
    window.scrollY -
    window.innerHeight +
    bottomOffset;

  window.scrollTo({
    top: Math.max(targetPosition, 0),
    behavior: "smooth",
  });
}

function hasMykolaHistory() {
  return (
    mykolaChat.querySelectorAll(".mykola-message-row").length > 1
  );
}

function showMykolaReturnPrompt() {

  if (document.getElementById("mykolaReturnActions")) {
    return;
  }

  addMykolaBubble("Вам ще щось підказати?");

  const row = document.createElement("div");

  row.className = "mykola-actions";
  row.id = "mykolaReturnActions";

  row.innerHTML = `
    <button type="button" id="mykolaReturnYes">
      Так
    </button>

    <button type="button" id="mykolaReturnNo">
      Ні
    </button>
  `;

  const actions = document.getElementById("mykolaActions");

  mykolaChat.insertBefore(row, actions);

  document
    .getElementById("mykolaReturnYes")
    .addEventListener("click", () => {

      row.remove();

      addUserBubble("Так");

      runWithMykolaThinking(() => {
        recommendMykolaMovie();
      });
    });

  document
    .getElementById("mykolaReturnNo")
    .addEventListener("click", () => {

      row.remove();

      addUserBubble("Ні");

      runWithMykolaThinking(() => {
        addMykolaBubble(
          "Гаразд. Якщо що — я поруч."
        );

      finishMykolaConversation();
      }, 1500);
    });
}

searchInput.addEventListener("input", applySearchAndFilters);

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;

    filterButtons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");

    applySearchAndFilters();
  });
});

  lookupButton.addEventListener("click", async () => {
  const imdbUrl = document.getElementById("imdb_url").value.trim();

  const match = imdbUrl.match(/tt\d+/);

  if (!match) {
    alert("Не вдалося знайти IMDb ID у посиланні.");
    return;
  }

  const imdbId = match[0];

  lookupButton.textContent = "Шукаю...";
  lookupButton.disabled = true;

  try {
    const response = await fetch(
      `/.netlify/functions/movie-lookup?imdbId=${imdbId}`
    );

    const data = await response.json();

    if (!response.ok) {
      alert("Помилка IMDb/TMDb пошуку: " + (data.error || response.status));
      return;
    }

    document.getElementById("title").value = data.title || "";
    document.getElementById("year").value = data.year || "";
    document.getElementById("poster_url").value = data.poster_url || "";

    if (data.overview) {
      document.getElementById("notes").value = data.overview;
    }

    alert("Дані фільму заповнено.");
  } catch (error) {
    alert("Помилка запиту: " + error.message);
  } finally {
    lookupButton.textContent = "Заповнити з IMDb";
    lookupButton.disabled = false;
  }
});

statusSelect.addEventListener("change", () => {
  const status = statusSelect.value;
  const recommendedMedium = document.getElementById("recommended_medium").value;
  const ownedMedium = document.getElementById("owned_medium").value;

  if (
    ["ordered", "owned", "watched"].includes(status) &&
    recommendedMedium &&
    recommendedMedium !== "Наразі недоступний" &&
    !ownedMedium
  ) {
    document.getElementById("owned_medium").value = recommendedMedium;
  }

  updateFormVisibility();
});

updateFormVisibility();

showAddFormButton.addEventListener("click", async () => {
  
  if (pendingImdbUrl && pendingImdbId) {
      const existingMovie = findMovieByImdbId(pendingImdbId);

    if (!canAddMovie()) {
      showAccessDenied(accessMessages.addOrEdit);
    return;
    }

    if (existingMovie) {
      alert("Такий фільм вже додано до списку.");
      return;
    }

    showAddFormButton.textContent = "Додаю...";
    showAddFormButton.disabled = true;

    try {
      const response = await fetch(
        `/.netlify/functions/movie-lookup?imdbId=${pendingImdbId}`
      );

      const data = await response.json();

      if (!response.ok) {
        alert("Помилка IMDb/TMDb пошуку: " + (data.error || response.status));
        return;
      }

      const addedBy = await getCurrentUserDisplayName();

      const newMovie = {
        title: data.title || "Без назви",
        year: data.year ? Number(data.year) : null,
        imdb_url: pendingImdbUrl,
        poster_url: data.poster_url || null,
        recommended_medium: null,
        status: "wishlist",
        is_owned: false,
        owned_medium: null,
        purchase_url: null,
        notes: data.overview || null,
        added_by: addedBy,
      };

      const { error } = await supabaseClient.from("movies").insert([newMovie]);

      if (error) {
        alert(
          "Помилка додавання фільму\n\n" +
          "Code: " + (error.code || "N/A") + "\n" +
          "Message: " + error.message + "\n" +
          "Details: " + (error.details || "No details")
        );
        return;
      }

      searchInput.value = "";
      resetSmartSearchState();
      await loadMovies();

      alert("Фільм додано до списку.");
    } catch (error) {
      alert("Помилка запиту: " + error.message);
    } finally {
      showAddFormButton.disabled = false;
      showAddFormButton.textContent = "Додати";
    }

    return;
  }

  resetFormMode();

  formPanel.style.display = "block";
  showAddFormButton.style.display = "none";
  cancelEditButton.style.display = "block";

  formTitle.textContent = "Додати фільм";
  submitButton.textContent = "Додати";

  const displayName = await getCurrentUserDisplayName();

    if (displayName) {
       setAddedByField(displayName, true);
    } else {
       setAddedByField("", false);
    }

  window.scrollTo({
    top: formPanel.offsetTop - 20,
    behavior: "smooth",
  });
});

clearSearchButton.addEventListener("click", () => {
  searchInput.value = "";
  resetSmartSearchState();
  applySearchAndFilters();
  searchInput.focus();
});

userMenuButton.addEventListener("click", () => {
  userMenuDropdown.style.display =
    userMenuDropdown.style.display === "block" ? "none" : "block";
});

editProfileButton.addEventListener("click", () => {
  displayNameInput.value = currentProfile?.display_name || "";
  profilePanel.style.display = "block";
  userMenuDropdown.style.display = "none";

  window.scrollTo({
    top: profilePanel.offsetTop - 20,
    behavior: "smooth",
  });
});

document.addEventListener("click", (event) => {
  const clickedInsideUserMenu = event.target.closest(".user-menu");

  if (!clickedInsideUserMenu) {
    userMenuDropdown.style.display = "none";
  }
});

saveProfileButton.addEventListener("click", async () => {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session?.user) {
    alert("Потрібно увійти в акаунт.");
    return;
  }

  const displayName = displayNameInput.value.trim();

  if (!displayName) {
    alert("Ім'я не може бути порожнім.");
    return;
  }

  const { error } = await supabaseClient
    .from("profiles")
    .update({
      display_name: displayName,
    })
    .eq("id", session.user.id);

  if (error) {
    alert(
      "Помилка збереження профілю\n\n" +
      "Message: " + error.message
    );
    return;
  }

  currentProfile = {
    ...(currentProfile || {}),
    display_name: displayName,
  };

  userEmail.textContent = displayName;
  profilePanel.style.display = "none";
});

cancelProfileButton.addEventListener("click", () => {
  profilePanel.style.display = "none";
});

async function initApp() {
  await updateAuthUI();
  await ensureVisitorMembership();
  await loadCurrentRole();
  applyAccessLevel();

  if (!isAnonymous()) {
    await loadMovies();
  }
}

wireMykolaActionButtons();

initApp();

supabaseClient.auth.onAuthStateChange(() => {
  initApp();
});
