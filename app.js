const SUPABASE_URL = "https://mttkectgdqqmejpenkrn.supabase.co";
const SUPABASE_KEY = "sb_publishable_LS48R8c2aoDZ_MSe4LWl9Q__n1M7zf_";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const movieForm = document.getElementById("movieForm");
const moviesGrid = document.getElementById("moviesGrid");
const movieCount = document.getElementById("movieCount");
const searchInput = document.getElementById("searchInput");
const clearSearchButton = document.getElementById("clearSearchButton");
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

let movies = [];
let editingMovieId = null;
let activeFilter = "all";

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
      <img src="${poster}" alt="${movie.title}" />

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
          ${movie.imdb_url ? `<a href="${movie.imdb_url}" target="_blank">IMDb</a>` : ""}
          ${movie.purchase_url ? `<a href="${movie.purchase_url}" target="_blank">${getPurchaseLabel(movie)}</a>` : ""}
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

function getPurchaseLabel(movie) {
  const streamingServices = [
    "Netflix",
    "HBO Max",
    "Disney+",
    "Apple TV / iTunes",
    "Megogo",
  ];

  const displayNames = {
    "Apple TV / iTunes": "Apple TV",
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
    const displayName =
      displayNames[movie.owned_medium] || movie.owned_medium;

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
  document.getElementById("added_by").value =
    movie.added_by || "";
updateFormVisibility();
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

  const movieData = getMovieFormData();

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

  const confirmed = confirm("Видалити цей фільм?");

  if (!confirmed) {
    return;
  }

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
  const { error } = await supabaseClient
    .from("movies")
    .update({
      status: "watched",
      is_owned: true,
    })
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

  const filtered = movies.filter((movie) => {
    const searchableText = [
      movie.title,
      movie.year,
      movie.recommended_medium,
      movie.owned_medium,
      movie.status,
      movie.notes,
      movie.added_by,
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

statusSelect.addEventListener("change", updateFormVisibility);

updateFormVisibility();

showAddFormButton.addEventListener("click", () => {
  resetFormMode();

  formPanel.style.display = "block";
  showAddFormButton.style.display = "none";
  cancelEditButton.style.display = "block";

  formTitle.textContent = "Додати фільм";
  submitButton.textContent = "Додати";

  window.scrollTo({
    top: formPanel.offsetTop - 20,
    behavior: "smooth",
  });
});

clearSearchButton.addEventListener("click", () => {
  searchInput.value = "";
  applySearchAndFilters();
  searchInput.focus();
});

loadMovies();
