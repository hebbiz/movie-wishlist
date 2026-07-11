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
const loginDescription = document.getElementById("loginDescription");
const logoutButton = document.getElementById("logoutButton");
const userInfo = document.getElementById("userInfo");
const userEmail = document.getElementById("userEmail");
const userAvatarLetter = document.getElementById("userAvatarLetter");
const userMenuButton = document.getElementById("userMenuButton");
const userMenuDropdown = document.getElementById("userMenuDropdown");
const editProfileButton = document.getElementById("editProfileButton");
const profilePanel = document.getElementById("profilePanel");
const displayNameInput = document.getElementById("displayNameInput");
const saveProfileButton = document.getElementById("saveProfileButton");
const cancelProfileButton = document.getElementById("cancelProfileButton");
const groupSelectorButton = document.getElementById("groupSelectorButton");
const groupTypeText = document.getElementById("groupTypeText");
const groupNameText = document.getElementById("groupNameText");
const groupMembersList = document.getElementById("groupMembersList");
const groupInfoMenuButton = document.getElementById("groupInfoMenuButton");
const groupInfoMenuDropdown = document.getElementById("groupInfoMenuDropdown");
const editGroupInfoButton = document.getElementById("editGroupInfoButton");
const groupSelectorDropdown = document.getElementById("groupSelectorDropdown");
const openGroupSettingsButton = document.getElementById("openGroupSettingsButton");
const groupSettingsView = document.getElementById("groupSettingsView");
const backFromGroupSettingsButton = document.getElementById("backFromGroupSettingsButton");
const groupSettingsName = document.getElementById("groupSettingsName");
const groupSettingsType = document.getElementById("groupSettingsType");
const otherGroupsList = document.getElementById("otherGroupsList");
const createGroupButton = document.getElementById("createGroupButton");
const groupFormView = document.getElementById("groupFormView");
const backFromGroupFormButton = document.getElementById("backFromGroupFormButton");
const groupForm = document.getElementById("groupForm");
const groupFormTitle = document.getElementById("groupFormTitle");
const groupTypeInput = document.getElementById("groupTypeInput");
const groupNameInput = document.getElementById("groupNameInput");
const saveGroupButton = document.getElementById("saveGroupButton");
const invitePanel = document.getElementById("invitePanel");
const invitePanelTitle = document.getElementById("invitePanelTitle");
const inviteEmailInput = document.getElementById("inviteEmailInput");
const sendInviteButton = document.getElementById("sendInviteButton");
const cancelInviteButton = document.getElementById("cancelInviteButton");
const recommendedGroupsList = document.getElementById("recommendedGroupsList");
const mainView = document.getElementById("mainView");
const mykolaView = document.getElementById("mykolaView");
const openMykolaButton = document.getElementById("openMykolaButton");
const backFromMykolaButton = document.getElementById("backFromMykolaButton");
const mykolaChat = document.getElementById("mykolaChat");
const DEBUG_ADVICE_ROOM = false;

let movies = [];
let editingMovieId = null;
let activeFilter = "all";
let pendingImdbUrl = null;
let pendingImdbId = null;
let pendingSearchQuery = "";
let imdbSearchResults = [];
let isShowingImdbResults = false;
let currentProfile = null;
let mykolaConversationFinished =
  localStorage.getItem("mykolaConversationFinished") === "true";
let mykolaMode = "main";
let savedMainMykolaChatHtml = null;
let currentUser = null;
let currentRole = null;
let currentGroup = null;
let currentGroupId = null;
let editingGroupId = null;
let currentUserGroups = [];
let currentGroupMembers = [];
let recommendedGroups = [];
let currentUserRecommendations = [];
let movieRecommendationCounts = {};
let movieRecommendationDetails = {};
let activeRecommendationStack = [];
let activeRecommendationStackOffset = 0;
let isRecommendationStackInteracting = false;
let appHasInitialized = false;
let pendingInviteRole = null;
let isLoggingOut = false;
let activeAdviceRoom = null;
let adviceRoomPollingTimer = null;
let adviceRoomResultShown = false;

function debugAdviceRoom(message) {
  if (!DEBUG_ADVICE_ROOM) return;
  alert(message);
}

function showAppLoader(message = null) {
  const loaderText =
    document.getElementById("appLoaderText");

  if (loaderText) {
    if (message) {
      loaderText.textContent = message;
      loaderText.classList.add("visible");
    } else {
      loaderText.textContent = "";
      loaderText.classList.remove("visible");
    }
  }

  document.body.classList.remove("app-ready");
}

function hideAppLoader() {
  setTimeout(() => {
    document.body.classList.add("app-ready");

    setTimeout(() => {
      const loaderText = document.getElementById("appLoaderText");

      if (loaderText) {
        loaderText.classList.remove("visible");
        loaderText.textContent = "";
      }
    }, 500);
  }, 300);
}

async function getDefaultGroupId() {
  const { data, error } = await supabaseClient
    .from("groups")
    .select("id")
    .eq("is_default", true)
    .single();

  if (error || !data) {
    throw new Error("Default group not found");
  }

  return data.id;
}

function saveActiveGroupId(groupId) {
  localStorage.setItem("activeGroupId", groupId);
}

function getSavedActiveGroupId() {
  return localStorage.getItem("activeGroupId");
}

async function ensureUserMembership() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session?.user) return;

  const userId = session.user.id;

  const params = new URLSearchParams(window.location.search);
  const inviteToken =
    params.get("invite") || localStorage.getItem("pendingInviteToken");

  if (inviteToken) {
    const { data: invitation, error: invitationError } = await supabaseClient
      .from("invitations")
      .select("*")
      .eq("token", inviteToken)
      .maybeSingle();

    if (invitationError) {
      alert("Помилка читання запрошення\n\n" + invitationError.message);
      throw invitationError;
    }

    if (!invitation) {
      alert("Запрошення не знайдено або вже використане.");
      localStorage.removeItem("pendingInviteToken");
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (invitation.email.toLowerCase() !== session.user.email.toLowerCase()) {
      alert(
        "Email акаунта не збігається з email у запрошенні.\n\n" +
        "Запрошення для: " + invitation.email + "\n" +
        "Ви увійшли як: " + session.user.email
      );
      return;
    }

    const { data: existingMembership, error: existingMembershipError } =
      await supabaseClient
        .from("group_members")
        .select("id")
        .eq("group_id", invitation.group_id)
        .eq("user_id", userId)
        .maybeSingle();

    if (existingMembershipError) {
      alert("Помилка перевірки участі в групі\n\n" + existingMembershipError.message);
      throw existingMembershipError;
    }

    if (!existingMembership) {
      const { error: membershipInsertError } = await supabaseClient
        .from("group_members")
        .insert({
          group_id: invitation.group_id,
          user_id: userId,
          role: invitation.role,
          is_group_subscriber: false,
        });

      if (membershipInsertError) {
        alert("Помилка додавання користувача до групи\n\n" + membershipInsertError.message);
        throw membershipInsertError;
      }
    }

    currentGroupId = invitation.group_id;

    saveActiveGroupId(currentGroupId);

    await supabaseClient
      .from("invitations")
      .delete()
      .eq("id", invitation.id);

    localStorage.removeItem("pendingInviteToken");
    window.history.replaceState({}, document.title, window.location.pathname);

    return;
  }

  const { data: memberships, error: membershipsError } = await supabaseClient
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId);

  if (membershipsError) {
    alert("Помилка перевірки груп користувача\n\n" + membershipsError.message);
    throw membershipsError;
  }

  if (memberships?.length) {
  const savedGroupId = getSavedActiveGroupId();

  const savedMembership = memberships.find((membership) => {
    return membership.group_id === savedGroupId;
  });

  currentGroupId = savedMembership
    ? savedMembership.group_id
    : memberships[0].group_id;

  saveActiveGroupId(currentGroupId);

  return;
  }

  const defaultGroupId = await getDefaultGroupId();

  const { error: defaultMembershipInsertError } = await supabaseClient
    .from("group_members")
    .insert({
      group_id: defaultGroupId,
      user_id: userId,
      role: "visitor",
      is_group_subscriber: true,
    });

  if (defaultMembershipInsertError) {
    alert("Помилка додавання користувача до default group\n\n" + defaultMembershipInsertError.message);
    throw defaultMembershipInsertError;
  }

  currentGroupId = defaultGroupId;

  saveActiveGroupId(currentGroupId);
  
}

async function updateAuthUI() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (session?.user) {
    currentUser = session.user;
    
    loginButton.style.display = "none";
    userInfo.style.display = "block";
    groupSelectorButton.style.display = "inline-flex";
    loginDescription.style.display = "none";

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
    userAvatarLetter.textContent = getUserAvatarLetter();
  } else {
      currentUser = null;
      currentRole = null;
      currentProfile = null;

      loginButton.style.display = "block";
      userInfo.style.display = "none";
      userEmail.textContent = "";
      loginDescription.style.display = "block";
      groupSelectorButton.style.display = "none";
  }
}

function getGroupTypePossessiveLabel(groupType) {
  const labels = {
    family: "сімʼї",
    friends: "друзів",
    community: "спільноти",
  };

  return labels[groupType] || "групи";
}

function getGroupTypeNominativeLabel(groupType) {
  const labels = {
    family: "Сімʼя",
    friends: "Друзі",
    community: "Спільнота",
  };

  return labels[groupType] || "Група";
}

const groupTypes = [
  { value: "family", label: "Сімʼя" },
  { value: "friends", label: "Друзі" },
  { value: "community", label: "Спільнота" },
];

async function loadCurrentUserGroups() {
  if (!currentUser) {
    currentUserGroups = [];
    return;
  }

  const { data, error } = await supabaseClient
    .from("group_members")
    .select(`
      role,
      is_group_subscriber,
      groups (
        id,
        name,
        type
      )
    `)
    .eq("user_id", currentUser.id);

  if (error) {
    console.error(error);
    currentUserGroups = [];
    return;
  }

  currentUserGroups = data || [];
}

function getOwnedGroupTypes() {
  return currentUserGroups
    .filter((g) => g.role === "owner" && g.groups?.type)
    .map((g) => g.groups.type);
}

function renderGroupTypeOptions() {
  const ownedTypes = getOwnedGroupTypes();

  const availableTypes = groupTypes.filter((type) => {
    return !ownedTypes.includes(type.value);
  });

  groupTypeInput.innerHTML = `
    <option value="">Тип групи</option>
  `;

  availableTypes.forEach((type) => {
    const option = document.createElement("option");
    option.value = type.value;
    option.textContent = type.label;
    groupTypeInput.appendChild(option);
  });

  return availableTypes;
}

async function loadCurrentGroup() {
  const { data, error } = await supabaseClient
    .from("groups")
    .select("id, name, type")
    .eq("id", currentGroupId)
    .single();

  if (error) {
    console.error("Group load error:", error);
    currentGroup = null;
    return;
  }

  currentGroup = data;
}

function renderCurrentGroupInfo() {
  if (!currentGroup) {
    groupTypeText.textContent = "групи";
    groupNameText.textContent = "";
    return;
  }

  groupTypeText.textContent =
  getGroupTypePossessiveLabel(currentGroup.type);
  groupNameText.textContent = currentGroup.name || "";
}

function openGroupSettingsView() {
  mainView.classList.remove("active");
  mykolaView.classList.remove("active");
  groupFormView.classList.remove("active");
  groupSettingsView.classList.add("active");

  groupSelectorDropdown.style.display = "none";
  groupSelectorButton.disabled = true;
  groupSelectorButton.classList.add("disabled");

  renderGroupSettings();
  renderOtherGroups();

  loadCurrentGroupMembers().then(() => {
    renderGroupMembers();
  });

  loadRecommendedGroups().then(() => {
    renderRecommendedGroups();
  });

  window.scrollTo({
    top: groupSettingsView.offsetTop - 20,
    behavior: "smooth",
  });

  groupInfoMenuDropdown.style.display = "none";
  document
  .querySelectorAll(".group-section-menu-dropdown")
  .forEach((dropdown) => {
    dropdown.style.display = "none";
  });
  
}

function renderGroupSettings() {
  if (!currentGroup) {
    groupSettingsName.textContent = "Групу не знайдено";
    groupSettingsType.textContent = "";
    return;
  }

  groupSettingsName.innerHTML = `
    <span class="group-name-text">
      ${getGroupTypeNominativeLabel(currentGroup.type)} ${currentGroup.name}
    </span>

    <span class="group-current-badge">
      Поточна
    </span>
  `;

  groupSettingsType.textContent = "";
  groupSettingsType.style.display = "none";

  groupInfoMenuButton.style.display = isOwner() ? "flex" : "none";
  
  updateCreateGroupButtonVisibility();
}

function renderOtherGroups() {
  otherGroupsList.innerHTML = "";

  const otherGroups = currentUserGroups.filter((membership) => {
    return membership.groups?.id !== currentGroupId;
  });

  if (!otherGroups.length) {
    otherGroupsList.innerHTML = `
      <p class="group-empty-note">
        Інших груп немає.
      </p>
    `;
    return;
  }

  otherGroups.forEach((membership) => {
    const group = membership.groups;

    const row = document.createElement("div");
    row.className = "other-group-row";

    row.innerHTML = `
      <div class="other-group-name">
        ${getGroupTypeNominativeLabel(group.type)}
        ${escapeHtml(group.name)}
      </div>

      <button
        type="button"
        class="switch-group-button"
        data-switch-group-id="${group.id}"
        aria-label="Перейти до групи"
      >
        →
      </button>
    `;

    otherGroupsList.appendChild(row);
  });
}

function openCreateGroupView() {
  editingGroupId = null;

  groupFormTitle.textContent = "Нова група";
  saveGroupButton.textContent = "Створити групу";

  const availableTypes = renderGroupTypeOptions();

    if (availableTypes.length === 0) {
      alert("Ви вже створили всі доступні типи груп.");
      return;
    }

    groupTypeInput.value = "";
    groupNameInput.value = "";

  mainView.classList.remove("active");
  mykolaView.classList.remove("active");
  groupSettingsView.classList.remove("active");
  groupFormView.classList.add("active");

  groupSelectorDropdown.style.display = "none";
  groupInfoMenuDropdown.style.display = "none";

  window.scrollTo({
    top: groupFormView.offsetTop - 20,
    behavior: "smooth",
  });
}

function updateCreateGroupButtonVisibility() {
  const ownedTypes = getOwnedGroupTypes();
  const hasAvailableTypes = groupTypes.some((type) => {
    return !ownedTypes.includes(type.value);
  });

  createGroupButton.style.display = hasAvailableTypes ? "inline-flex" : "none";
}

function backToGroupSettingsView() {
  groupFormView.classList.remove("active");
  groupSettingsView.classList.add("active");

  window.scrollTo({
    top: groupSettingsView.offsetTop - 20,
    behavior: "smooth",
  });
}

createGroupButton.addEventListener("click", () => {
  openCreateGroupView();
});

backFromGroupFormButton.addEventListener("click", () => {
  backToGroupSettingsView();
});

groupForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) {
    alert("Потрібно увійти в акаунт.");
    return;
  }

  const groupType = groupTypeInput.value;
  const groupName = groupNameInput.value.trim();

  if (!groupType || !groupName) {
    alert("Вкажіть тип і назву групи.");
    return;
  }

  const ownedTypes = getOwnedGroupTypes();

  if (ownedTypes.includes(groupType)) {
    alert("У вас вже є група цього типу.");
    renderGroupTypeOptions();
    return;
  }

  saveGroupButton.disabled = true;
  saveGroupButton.textContent = "Створюю...";

  try {
    const { data: createdGroups, error: groupInsertError } =
      await supabaseClient
        .from("groups")
        .insert({
          name: groupName,
          type: groupType,
          created_by: currentUser.id,
          is_default: false,
        })
        .select();

    if (groupInsertError) {
      alert(
        "Помилка створення групи\n\n" +
        "Message: " + groupInsertError.message
      );
      return;
    }

    const createdGroup = createdGroups?.[0];

    if (!createdGroup) {
      alert("Групу створено, але не отримано її id.");
      return;
    }

    const { error: memberInsertError } = await supabaseClient
      .from("group_members")
      .insert({
        group_id: createdGroup.id,
        user_id: currentUser.id,
        role: "owner",
        is_group_subscriber: false,
      });

    if (memberInsertError) {
      alert(
        "Групу створено, але не вдалося додати вас як власника\n\n" +
        "Message: " + memberInsertError.message
      );
      return;
    }

    currentGroupId = createdGroup.id;
    currentGroup = createdGroup;
    
    saveActiveGroupId(createdGroup.id);

    await loadCurrentUserGroups();
    await loadCurrentRole();

    await loadCurrentGroup();
    renderCurrentGroupInfo();
    renderGroupSettings();
    renderOtherGroups();

    movies = [];
    applySearchAndFilters();

    groupForm.reset();
    backToGroupSettingsView();

    await loadCurrentGroupMembers();
    renderGroupMembers();

    alert("Групу створено.");
  } finally {
    saveGroupButton.disabled = false;
    saveGroupButton.textContent = editingGroupId
      ? "Зберегти зміни"
      : "Створити групу";
  }
});

async function loadCurrentGroupMembers() {
  const { data, error } = await supabaseClient
    .from("group_members")
    .select(`
      id,
      role,
      is_group_subscriber,
      profiles (
        display_name,
        email
      )
    `)
    .eq("group_id", currentGroupId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Group members load error:", error);
    currentGroupMembers = [];
    return;
  }

  currentGroupMembers = data || [];
}

function renderGroupMembers() {
  groupMembersList.innerHTML = "";

  if (currentGroupMembers.length === 0) {
    groupMembersList.innerHTML = `<p>Учасників не знайдено.</p>`;
    return;
  }

  const members = currentGroupMembers.filter(
    (member) => member.role === "owner" || member.role === "member"
  );

  const visitors = currentGroupMembers.filter(
    (member) => member.role === "visitor"
  );

  renderGroupMemberSection("Учасники", members, "member");
  renderGroupMemberSection("Відвідувачі", visitors, "visitor");
}

function renderGroupMemberSection(title, members, roleType) {
  const section = document.createElement("div");
  section.className = "group-member-subsection";

  const menuHtml = isOwner()
    ? `
      <div class="group-settings-menu">
        <button class="menu-button group-section-menu-button" type="button">⋯</button>

        <div class="menu-dropdown group-section-menu-dropdown">
          <button type="button" data-invite-role="${roleType}">
            Запросити нового
          </button>
        </div>
      </div>
    `
    : "";

  section.innerHTML = `
    <div class="group-members-header">
      <h4>${title}</h4>
      ${menuHtml}
    </div>
  `;

  if (members.length === 0) {
    section.innerHTML += `
      <p class="group-empty-note">
        Поки нікого немає.
      </p>
    `;

    groupMembersList.appendChild(section);
    return;
  }

  members.forEach((member) => {
    const name =
      member.profiles?.display_name ||
      "Користувач без імені";

    const canManageMember =
      isOwner() &&
      member.role !== "owner";

    const row = document.createElement("div");
    row.className = "group-member-row";

    row.innerHTML = `
      <span class="group-member-name">
        ${escapeHtml(name)}
      </span>

      ${
        canManageMember
          ? `
            <div class="group-member-menu">
              <button
                class="group-member-menu-button"
                type="button"
              >
                ▾
              </button>

              <div class="menu-dropdown group-member-menu-dropdown">
                <div class="group-member-menu-info">
                  <div class="group-member-menu-email">
                    ${escapeHtml(member.profiles?.email || "Email не вказано")}
                  </div>

                  ${
                    member.is_group_subscriber
                      ? `<div class="group-member-menu-subtitle">підписник групи</div>`
                      : ""
                  }
                </div>

                <button
                  type="button"
                  class="delete-option"
                  data-remove-member-id="${member.id}"
                  data-remove-member-role="${member.role}"
                >
                  Видалити
                </button>
              </div>
            </div>
          `
          : ""
      }
    `;

    section.appendChild(row);
  });

  groupMembersList.appendChild(section);
}

async function loadRecommendedGroups() {
  recommendedGroups = [];

  if (!currentUser || !currentUserGroups.length) {
    return;
  }

  const currentUserGroupIds = currentUserGroups
    .map((membership) => membership.groups?.id)
    .filter(Boolean);

  const existingGroupIds = new Set(currentUserGroupIds);

  const { data: sharedMembers, error: sharedMembersError } =
    await supabaseClient
      .from("group_members")
      .select("user_id")
      .in("group_id", currentUserGroupIds)
      .neq("user_id", currentUser.id);

  if (sharedMembersError) {
    console.error("Recommended groups members error:", sharedMembersError);
    return;
  }

  const connectedUserIds = [
    ...new Set((sharedMembers || []).map((member) => member.user_id)),
  ];

  if (!connectedUserIds.length) {
    return;
  }

  const { data: candidateGroups, error: candidateGroupsError } =
    await supabaseClient
      .from("groups")
      .select("id, name, type, created_by")
      .in("created_by", connectedUserIds);

  if (candidateGroupsError) {
    console.error("Recommended groups load error:", candidateGroupsError);
    return;
  }

  const availableGroups = (candidateGroups || []).filter((group) => {
    return !existingGroupIds.has(group.id);
  });

  const groupsWithCounts = await Promise.all(
    availableGroups.map(async (group) => {
      const { count, error } = await supabaseClient
        .from("movie_group_lists")
        .select("id", { count: "exact", head: true })
        .eq("group_id", group.id);

      return {
        ...group,
        movie_count: error ? 0 : count || 0,
      };
    })
  );

  recommendedGroups = groupsWithCounts
    .sort((a, b) => b.movie_count - a.movie_count)
    .slice(0, 5);
}

function renderRecommendedGroups() {
  recommendedGroupsList.innerHTML = "";

  if (!recommendedGroups.length) {
    recommendedGroupsList.innerHTML = `
      <p class="group-empty-note">
        Поки немає рекомендованих груп.
      </p>
    `;
    return;
  }

  recommendedGroups.forEach((group) => {
    const row = document.createElement("div");
    row.className = "recommended-group-row";

    row.innerHTML = `
      <div class="recommended-group-info">
        <div class="recommended-group-name">
          ${getGroupTypeNominativeLabel(group.type)}
          ${escapeHtml(group.name)}
        </div>

        <div class="recommended-group-meta">
          ${group.movie_count} ${formatMovieCountWord(group.movie_count)}
        </div>
      </div>

      <button
        type="button"
        class="subscribe-group-button"
        data-subscribe-group-id="${group.id}"
      >
        +
      </button>
    `;

    recommendedGroupsList.appendChild(row);
  });
}

async function subscribeToRecommendedGroup(groupId) {
  if (!currentUser) {
    alert("Потрібно увійти в акаунт.");
    return;
  }

  const { error } = await supabaseClient
    .from("group_members")
    .insert({
      group_id: groupId,
      user_id: currentUser.id,
      role: "visitor",
      is_group_subscriber: true,
    });

  if (error) {
    if (error.code === "23505") {
      alert("Ви вже підписані на цю групу.");
      return;
    }

    alert(
      "Помилка підписки на групу\n\n" +
      "Message: " + error.message
    );
    return;
  }

  currentGroupId = groupId;
  saveActiveGroupId(groupId);

  await loadCurrentUserGroups();
  await loadCurrentGroup();
  await loadCurrentRole();
  await loadCurrentGroupMembers();
  await loadMovies();
  await loadRecommendedGroups();

  renderCurrentGroupInfo();
  renderGroupSettings();
  renderGroupMembers();
  renderOtherGroups();
  renderRecommendedGroups();

  alert("Підписку додано.");
}

async function removeGroupMember(memberId, memberRole) {
  if (!isOwner()) {
    showAccessDenied(accessMessages.delete);
    return;
  }

  if (memberRole === "owner") {
    alert("Власника групи не можна видалити.");
    return;
  }

  const confirmed = confirm("Видалити користувача з цієї групи?");

  if (!confirmed) return;

  const { error } = await supabaseClient
    .from("group_members")
    .delete()
    .eq("id", memberId)
    .eq("group_id", currentGroupId);

  if (error) {
    alert(
      "Помилка видалення користувача\n\n" +
      "Message: " + error.message
    );
    return;
  }

  await loadCurrentGroupMembers();
  renderGroupMembers();
}

groupInfoMenuButton.addEventListener("click", (event) => {
  event.stopPropagation();

  document
  .querySelectorAll(".group-section-menu-dropdown")
  .forEach((dropdown) => {
    dropdown.style.display = "none";
  });

  groupInfoMenuDropdown.style.display =
    groupInfoMenuDropdown.style.display === "block" ? "none" : "block";
});

editGroupInfoButton.addEventListener("click", () => {
  groupInfoMenuDropdown.style.display = "none";
  alert("Редагування групи додамо наступним кроком.");
});

groupMembersList.addEventListener("click", async (event) => {
  const memberMenuButton = event.target.closest(".group-member-menu-button");
  const removeMemberButton = event.target.closest("[data-remove-member-id]");
  const menuButton = event.target.closest(".group-section-menu-button");
  const inviteButton = event.target.closest("[data-invite-role]");

  if (memberMenuButton) {
    event.stopPropagation();

    groupInfoMenuDropdown.style.display = "none";

    document
      .querySelectorAll(".group-section-menu-dropdown")
      .forEach((dropdown) => {
        dropdown.style.display = "none";
      });

    const menu = memberMenuButton
      .closest(".group-member-menu")
      .querySelector(".group-member-menu-dropdown");

    document.querySelectorAll(".group-member-menu-dropdown").forEach((dropdown) => {
      if (dropdown !== menu) {
        dropdown.style.display = "none";
      }
    });

    menu.style.display =
      menu.style.display === "block" ? "none" : "block";

    return;
  }

  if (removeMemberButton) {
    event.stopPropagation();

    await removeGroupMember(
      removeMemberButton.dataset.removeMemberId,
      removeMemberButton.dataset.removeMemberRole
    );

    return;
  }
  
  if (menuButton) {
    event.stopPropagation();

    groupInfoMenuDropdown.style.display = "none";

    document
      .querySelectorAll(".group-member-menu-dropdown")
      .forEach((dropdown) => {
        dropdown.style.display = "none";
      });

    const menu = menuButton
      .closest(".group-settings-menu")
      .querySelector(".group-section-menu-dropdown");

    document
      .querySelectorAll(".group-section-menu-dropdown")
      .forEach((dropdown) => {
        if (dropdown !== menu) {
          dropdown.style.display = "none";
        }
      });

    menu.style.display =
      menu.style.display === "block" ? "none" : "block";

    return;
  }

  if (inviteButton) {
    event.stopPropagation();

    const role = inviteButton.dataset.inviteRole;

    document
      .querySelectorAll(".group-section-menu-dropdown")
      .forEach((dropdown) => {
        dropdown.style.display = "none";
      });

    pendingInviteRole = role;

    invitePanelTitle.textContent =
      role === "member"
        ? "Запросити учасника"
        : "Запросити відвідувача";

    inviteEmailInput.value = "";
    invitePanel.style.display = "block";

    window.scrollTo({
      top: invitePanel.offsetTop - 20,
      behavior: "smooth",
    });
  }
});

cancelInviteButton.addEventListener("click", () => {
  invitePanel.style.display = "none";
  inviteEmailInput.value = "";
  pendingInviteRole = null;
});

sendInviteButton.addEventListener("click", async () => {
  if (!isOwner()) {
    showAccessDenied(accessMessages.invite);
    return;
  }

  const email = inviteEmailInput.value.trim().toLowerCase();

  if (!email) {
    alert("Вкажіть email користувача.");
    return;
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;

  if (!emailRegex.test(email)) {
    alert("Вкажіть email у форматі user@gmail.com.");
    return;
  }

  if (!pendingInviteRole) {
    alert("Роль запрошення не визначена.");
    return;
  }

  const { data: existingInvite, error: existingInviteError } =
    await supabaseClient
      .from("invitations")
      .select("id")
      .eq("group_id", currentGroupId)
      .eq("email", email)
      .maybeSingle();

  if (existingInviteError) {
    alert(
      "Помилка перевірки існуючого запрошення\n\n" +
      "Message: " + existingInviteError.message
    );
    return;
  }

  if (existingInvite) {
    alert("Запрошення для цього користувача в цю групу вже створене.");
    return;
  }

  const token = crypto.randomUUID();

  const { error } = await supabaseClient
    .from("invitations")
    .insert({
      group_id: currentGroupId,
      email,
      role: pendingInviteRole,
      token,
      created_by: currentUser.id,
    });

  if (error) {
    alert(
      "Помилка створення запрошення\n\n" +
      "Message: " + error.message
    );
    return;
  }

  // invite.html uses ?token=...
  // app.html uses ?invite=...
  // The invite page converts token -> invite during redirect.

  const inviteUrl =
  `${window.location.origin}/invite.html?token=${token}`;

  let copied = false;

  try {
    await navigator.clipboard.writeText(inviteUrl);
    copied = true;
  } catch (clipboardError) {
    console.warn("Clipboard error:", clipboardError);
  }

  alert(
    copied
      ? "Запрошення створено. Посилання скопійовано:\n\n" + inviteUrl
      : "Запрошення створено, але посилання не вдалося скопіювати автоматично:\n\n" + inviteUrl
  );

  invitePanel.style.display = "none";
  inviteEmailInput.value = "";
  pendingInviteRole = null;
});

function backToMainView() {
  groupSettingsView.classList.remove("active");
  groupFormView.classList.remove("active");
  mykolaView.classList.remove("active");
  mainView.classList.add("active");
  groupSelectorButton.disabled = false;
  groupSelectorButton.classList.remove("disabled");

  window.scrollTo({
    top: mainView.offsetTop - 20,
    behavior: "smooth",
  });

  groupInfoMenuDropdown.style.display = "none";
  document
  .querySelectorAll(".group-section-menu-dropdown")
  .forEach((dropdown) => {
    dropdown.style.display = "none";
  });
  
}

groupSelectorButton.addEventListener("click", (event) => {
  event.stopPropagation();

  groupSelectorDropdown.style.display =
    groupSelectorDropdown.style.display === "block" ? "none" : "block";
});

openGroupSettingsButton.addEventListener("click", (event) => {
  event.stopPropagation();
  openGroupSettingsView();
});

otherGroupsList.addEventListener("click", async (event) => {
  const button = event.target.closest(
    "[data-switch-group-id]"
  );

  if (!button) return;

  showAppLoader("Змінюємо поточну групу...");

  try {

    currentGroupId = button.dataset.switchGroupId;

    saveActiveGroupId(currentGroupId);

    await loadCurrentGroup();
    await loadCurrentRole();
    await loadCurrentGroupMembers();
    await loadMovies();
    await loadRecommendedGroups();

    renderCurrentGroupInfo();
    renderGroupSettings();
    renderGroupMembers();
    renderOtherGroups();
    renderRecommendedGroups();

    groupInfoMenuDropdown.style.display = "none";

    document
      .querySelectorAll(".group-section-menu-dropdown")
      .forEach((dropdown) => {
        dropdown.style.display = "none";
      });

    window.scrollTo({
      top: groupSettingsView.offsetTop - 20,
      behavior: "smooth",
    });

  } finally {
      setTimeout(() => {
        hideAppLoader();
      }, 1000);  
    }
});

recommendedGroupsList?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-subscribe-group-id]");

  if (!button) return;

  await subscribeToRecommendedGroup(button.dataset.subscribeGroupId);
});

backFromGroupSettingsButton.addEventListener("click", () => {
  backToMainView();
});

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

function canOpenMovieUrl(movie) {
  if (isMember() || isOwner()) {
    return true;
  }

  if (isVisitor()) {
    return movie.status === "wishlist";
  }

  return false;
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
      movie.status === "wishlist" ||
      (
        movie.status === "watched" &&
        !movie.owned_medium
      )
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
  "Адміністратор обмежив перегляд інформації про покупки цієї групи.",

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
    groupSettingsView.style.display = "none";
    groupFormView.style.display = "none";
    return;
  }

  mainView.style.display = "";
  mykolaView.style.display = "";
  groupSettingsView.style.display = "";
  groupFormView.style.display = "";
}

loginButton.addEventListener("click", async () => {
  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get("invite");

  if (inviteToken) {
    localStorage.setItem("pendingInviteToken", inviteToken);
  }

  await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin + "/app.html",
    },
  });
});

logoutButton.addEventListener("click", async () => {
  isLoggingOut = true;

  showAppLoader();

  const start = Date.now();

  await supabaseClient.auth.signOut();

  currentRole = null;
  currentGroup = null;
  currentGroupId = null;
  currentUserGroups = [];
  currentGroupMembers = [];
  movies = [];

  resetMykolaChat();
  clearMykolaFinishedState();

  await updateAuthUI();
  applyAccessLevel();

  const elapsed = Date.now() - start;
  const minDuration = 1200;

  setTimeout(() => {
    hideAppLoader();
    isLoggingOut = false;
  }, Math.max(0, minDuration - elapsed));
});

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function hashString(value) {
  let hash = 0;

  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }

  return hash;
}

function seededRandom(seed) {
  return hashString(seed) / 4294967295;
}

function getSeededItem(items, seed) {
  if (!items.length) return null;

  const index = Math.floor(seededRandom(seed) * items.length);
  return items[index];
}

function pickMykolaDailyRecommendationMovie() {
  const candidates = getRecommendationCandidates();

  if (!candidates.length) return null;

  const seedBase = `${currentGroupId}:${getTodayKey()}`;

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
    { weight: 0.5, movies: ownedMovies, key: "owned" },
    { weight: 0.4, movies: streamingWishlistMovies, key: "streaming" },
    { weight: 0.1, movies: otherMovies, key: "other" },
  ].filter((group) => group.movies.length > 0);

  const totalWeight = groups.reduce((sum, group) => {
    return sum + group.weight;
  }, 0);

  let randomValue = seededRandom(seedBase) * totalWeight;

  for (const group of groups) {
    randomValue -= group.weight;

    if (randomValue <= 0) {
      return getSeededItem(group.movies, `${seedBase}:${group.key}`);
    }
  }

  return getSeededItem(
    groups[groups.length - 1].movies,
    `${seedBase}:fallback`
  );
}

function applyMykolaDailyRecommendation() {
  // прибираємо попередню тимчасову пораду Миколи
  Object.keys(movieRecommendationDetails).forEach((movieId) => {
    movieRecommendationDetails[movieId] =
      movieRecommendationDetails[movieId].filter((item) => !item.is_mykola);

    if (movieRecommendationDetails[movieId].length === 0) {
      delete movieRecommendationDetails[movieId];
    }
  });

  Object.keys(movieRecommendationCounts).forEach((movieId) => {
    const realCount =
      movieRecommendationDetails[movieId]?.length || 0;

    if (realCount > 0) {
      movieRecommendationCounts[movieId] = realCount;
    } else {
      delete movieRecommendationCounts[movieId];
    }
  });

  const movie = pickMykolaDailyRecommendationMovie();

  if (!movie?.movie_id) return;

  movieRecommendationCounts[movie.movie_id] =
    (movieRecommendationCounts[movie.movie_id] || 0) + 1;

  if (!movieRecommendationDetails[movie.movie_id]) {
    movieRecommendationDetails[movie.movie_id] = [];
  }

  movieRecommendationDetails[movie.movie_id].push({
    movie_id: movie.movie_id,
    user_id: "mykola",
    context_group_id: currentGroupId,
    created_at: `${getTodayKey()}T00:00:00.000Z`,
    profiles: {
      display_name: "Микола",
      email: "mykola@movie-wishlist.local",
    },
    groups: currentGroup,
    is_mykola: true,
  });
}

async function loadMovies() {
  console.log("Loading movies...");

  const { data, error } = await supabaseClient
    .from("movie_group_lists")
    .select(`
      *,
      movies (*)
    `)
    .eq("group_id", currentGroupId)
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

  movies = (data || []).map((item) => ({
    id: item.id,
    movie_id: item.movie_id,
    group_id: item.group_id,

    title: item.movies?.title,
    year: item.movies?.year,
    imdb_id: item.movies?.imdb_id,
    imdb_url: item.movies?.imdb_url,
    poster_url: item.movies?.poster_url,
    notes: item.movies?.notes,

    status: item.status,
    recommended_medium: item.recommended_medium,
    owned_medium: item.owned_medium,
    purchase_url: item.purchase_url,
    added_by: item.added_by,

    is_owned: !!item.owned_medium,

    created_at: item.created_at,
    updated_at: item.updated_at,
}));

  await loadCurrentUserRecommendations();
  await loadMovieRecommendationCounts();
  await loadMovieRecommendationDetails();

  applyMykolaDailyRecommendation();
  
  applySearchAndFilters();
}

function getCurrentUserRecommendation(movieId) {
  return currentUserRecommendations.find((item) => {
    return item.movie_id === movieId;
  });
}

async function loadCurrentUserRecommendations() {
  if (!currentUser) {
    currentUserRecommendations = [];
    return;
  }

  const { data, error } = await supabaseClient
    .from("recommendations")
    .select(`
      id,
      movie_id,
      user_id,
      comment,
      rating_value,
      context_group_id,
      created_at,
      profiles!recommendations_user_id_fkey (
        display_name,
        email
      ),
      groups!recommendations_context_group_id_fkey (
        id,
        name,
        type
      )
    `)
    .eq("user_id", currentUser.id);

  if (error) {
    console.error("Recommendations load error:", error);
    currentUserRecommendations = [];
    return;
  }

  currentUserRecommendations = data || [];
}

function hasCurrentUserRecommended(movieId) {
  return currentUserRecommendations.some((recommendation) => {
    return recommendation.movie_id === movieId;
  });
}

function currentUserRecommendationHasComment(movieId) {
  const recommendation = currentUserRecommendations.find((item) => {
    return item.movie_id === movieId;
  });

  return !!recommendation?.comment;
}

function toggleMyAdviceCard(movieId, button) {
  const existingCard = document.querySelector(
    `[data-my-advice-card="${movieId}"]`
  );

  document.querySelectorAll(".card.has-open-advice").forEach((card) => {
    card.classList.remove("has-open-advice");
  });

  document.querySelectorAll(".my-advice-card").forEach((card) => {
    if (card !== existingCard) {
      card.remove();
    }
  });

  if (existingCard) {
    existingCard.remove();
    return;
  }

  const recommendation = getCurrentUserRecommendation(movieId);

  if (!recommendation) return;

  const name =
    recommendation.profiles?.display_name ||
    recommendation.profiles?.email ||
    getUserAvatarLetter();

  const groupName = recommendation.groups?.name
    ? `${getGroupTypeNominativeLabel(recommendation.groups.type)} ${recommendation.groups.name}`
    : "Поточна група";

  const comment =
    recommendation.comment ||
    "Коментар ще не додано.";

  const archiveMark = getMykolaArchiveMark(recommendation);

  const card = document.createElement("div");
  card.className = "my-advice-card";
  card.dataset.myAdviceCard = movieId;

  card.innerHTML = `
    <div class="my-advice-card-name">
      ${escapeHtml(name)}
    </div>

    <div class="my-advice-card-group">
      ${escapeHtml(groupName)}
    </div>

    <div class="my-advice-card-divider"></div>

    <div class="my-advice-card-comment">
      ${escapeHtml(comment)}
    </div>

    ${archiveMark ? `
      <div class="mykola-archive-mark">
        <div class="mykola-archive-mark-label">
          <span class="icon">✎</span> М. для архіву:
        </div>

        <div class="mykola-archive-mark-text">
          ${escapeHtml(archiveMark)}
        </div>
      </div>
    ` : ""}

    <button
      type="button"
      class="my-advice-edit-button"
      data-edit-my-advice="${movieId}"
    >
      Змінити
    </button>
  `;

  const wrapper = button.closest(".movie-social-section");
  wrapper.closest(".card")?.classList.add("has-open-advice");
  wrapper.appendChild(card);
}

function openMyAdviceEditFlow(movieId) {
  const movie = movies.find((item) => item.movie_id === movieId);
  const recommendation = getCurrentUserRecommendation(movieId);

  if (!movie || !recommendation) {
    alert("Пораду не знайдено.");
    return;
  }

  openMykolaAdviceContextView();
  
  resetMykolaRecommendationFlow();

  addUserBubble(`Змінити мою пораду: ${movie.title}`);

  runWithMykolaThinking(() => {
    addMykolaBubble(
      getRandomItem([
        "Бачу вашу попередню пораду. Переписувати історію — справа серйозна.",
        "Знайшов вашу картку. Внесемо правки акуратно, без архівного вандалізму.",
        "Ось ваша порада. Можна уточнити формулювання, посилити аргумент або просто зробити її менш загадковою.",
      ])
    );

    showMykolaEditRecommendationForm(
      movieId,
      recommendation.comment || "",
      recommendation.rating_value || 10
    );
  }, 900);
}

function showMykolaEditRecommendationForm(
  movieId,
  currentComment = "",
  currentRatingValue = 10
) {
  const row = document.createElement("div");
  row.className = "user-message-row user-input-row";
  row.id = "mykolaEditRecommendationForm";

  row.innerHTML = `
    <div class="user-bubble user-comment-form-bubble">
      <textarea
        id="mykolaEditRecommendationInput"
        placeholder="Оновіть вашу пораду..."
      >${escapeHtml(currentComment)}</textarea>

      ${createRatingSliderHtml(currentRatingValue)}

      <div class="mykola-comment-form-actions user-comment-form-actions">
        <button id="mykolaUpdateAdviceButton" type="button">
          Зберегти
        </button>

        <button id="mykolaWithdrawAdviceButton" type="button">
          Відкликати
        </button>
      </div>
    </div>

    <div class="user-avatar">
      ${getUserAvatarLetter()}
    </div>
  `;

  const actions = document.getElementById("mykolaActions");
  mykolaChat.insertBefore(row, actions);

  scrollMykolaChatToBottom();
  wireRatingSlider(row);

  document
    .getElementById("mykolaUpdateAdviceButton")
    .addEventListener("click", async () => {
      const comment = document
        .getElementById("mykolaEditRecommendationInput")
        .value
        .trim();

      const ratingValue = getRatingValue(row);

      const success = await updateMyRecommendation(
        movieId,
        comment || null,
        ratingValue
      );

      if (!success) return;

      row.remove();

      runWithMykolaThinking(() => {
        addMykolaBubble("Зміни внесено. Картка знову виглядає пристойно.");
      }, 800);
    });

  document
    .getElementById("mykolaWithdrawAdviceButton")
    .addEventListener("click", async () => {
      const confirmed = confirm("Відкликати вашу пораду?");

      if (!confirmed) return;

      const success = await withdrawMyRecommendation(movieId);

      if (!success) return;

      row.remove();

      runWithMykolaThinking(() => {
        addMykolaBubble("Пораду відкликано. Архів зробив вигляд, що нічого не бачив.");
      }, 800);
    });
}

async function updateMyRecommendation(movieId, comment, ratingValue = null) {
  const { data: recommendation, error: lookupError } = await supabaseClient
    .from("recommendations")
    .select("id")
    .eq("movie_id", movieId)
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (lookupError || !recommendation) {
    alert("Пораду не знайдено для цього фільму.");
    return false;
  }

  const numericRating = Number(ratingValue);

  if (
    ratingValue === null ||
    ratingValue === undefined ||
    ratingValue === "" ||
    !Number.isFinite(numericRating) ||
    !Number.isInteger(numericRating * 2) ||
    numericRating < 1 ||
    numericRating > 20
  ) {
    alert("Оберіть оцінку фільму.");
    return false;
  }

  const { data, error } = await supabaseClient
    .from("recommendations")
    .update({
      comment,
      rating_value: numericRating,
    })
    .eq("id", recommendation.id)
    .eq("user_id", currentUser.id)
    .select(`
      id,
      movie_id,
      user_id,
      comment,
      rating_value,
      context_group_id,
      created_at,
      profiles!recommendations_user_id_fkey (
        display_name,
        email
      ),
      groups!recommendations_context_group_id_fkey (
        id,
        name,
        type
      )
    `)
    .maybeSingle();

  if (error || !data) {
    alert("Помилка оновлення поради\n\n" + (error?.message || "Пораду не оновлено."));
    return false;
  }

  await loadCurrentUserRecommendations();
  await loadMovieRecommendationCounts();
  await loadMovieRecommendationDetails();
  applyMykolaDailyRecommendation();
  applySearchAndFilters();

  return true;
}

async function withdrawMyRecommendation(movieId) {
  const { data: recommendation, error: lookupError } = await supabaseClient
    .from("recommendations")
    .select("id")
    .eq("movie_id", movieId)
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (lookupError || !recommendation) {
    alert("Пораду не знайдено для цього фільму.");
    return false;
  }

  const { error } = await supabaseClient
    .from("recommendations")
    .delete()
    .eq("id", recommendation.id)
    .eq("user_id", currentUser.id);

  if (error) {
    alert("Помилка відкликання поради\n\n" + error.message);
    return false;
  }

  await loadCurrentUserRecommendations();
  await loadMovieRecommendationCounts();
  await loadMovieRecommendationDetails();
  applyMykolaDailyRecommendation();
  applySearchAndFilters();

  return true;
}

async function loadMovieRecommendationCounts() {
  movieRecommendationCounts = {};

  const movieIds = movies
    .map((movie) => movie.movie_id)
    .filter(Boolean);

  if (!movieIds.length) return;

  const { data, error } = await supabaseClient
    .from("recommendations")
    .select("movie_id")
    .in("movie_id", movieIds)
    .neq("user_id", currentUser.id);

  if (error) {
    console.error("Recommendation counts load error:", error);
    return;
  }

  (data || []).forEach((item) => {
    movieRecommendationCounts[item.movie_id] =
      (movieRecommendationCounts[item.movie_id] || 0) + 1;
  });
}

async function loadMovieRecommendationDetails() {
  movieRecommendationDetails = {};

  const movieIds = movies
    .map((movie) => movie.movie_id)
    .filter(Boolean);

  if (!movieIds.length) return;

  const { data, error } = await supabaseClient
    .from("recommendations")
    .select(`
      movie_id,
      user_id,
      context_group_id,
      comment,
      rating_value,
      created_at,
      profiles!recommendations_user_id_fkey (
        display_name,
        email
      ),
      groups!recommendations_context_group_id_fkey (
        id,
        name,
        type
      )
    `)
    .in("movie_id", movieIds)
    .neq("user_id", currentUser.id);

  if (error) {
    alert(
      "Recommendation details error:\n\n" +
      error.message
    );
    console.error("Recommendation details load error:", error);
    return;
  }

  (data || []).forEach((item) => {
    if (!movieRecommendationDetails[item.movie_id]) {
      movieRecommendationDetails[item.movie_id] = [];
    }

    movieRecommendationDetails[item.movie_id].push(item);
  });
}

function getRecommendationPriority(item) {
  if (item.context_group_id === currentGroupId) {
    return 1;
  }

  const groupId = item.context_group_id;

  const membership = currentUserGroups.find((membership) => {
    return membership.groups?.id === groupId;
  });

  if (membership?.role === "visitor" && membership?.is_group_subscriber) {
    return 2;
  }

  return 3;
}

function renderRecommendationContext(movieId) {
  const recommendations = movieRecommendationDetails[movieId] || [];

  if (!recommendations.length) {
    return "";
  }

  const sortedItems = [...recommendations].sort((a, b) => {
    return getRecommendationPriority(a) - getRecommendationPriority(b);
  });

  const visibleItems = sortedItems.slice(0, 5);

  const namesHtml = visibleItems
    .map((item) => {
      const name =
        item.profiles?.display_name ||
        item.profiles?.email ||
        "Користувач";

      const commentIcon = item.comment || item.is_mykola
        ? `<span class="recommend-context-comment-icon" title="Є коментар"></span>`
        : "";

      return `
        <span class="recommend-context-person">
          ${commentIcon}${escapeHtml(name)}
        </span>
      `;
    })
    .join("");

  return `
    <div
      class="recommend-context-menu"
      data-recommend-context-menu="${movieId}"
    >
      <div class="recommend-context-title">
        ${recommendations.length === 1 ? "Порада" : "Поради"}
      </div>

      <div class="recommend-context-names">
        ${namesHtml}
      </div>

      <button
        type="button"
        class="recommend-context-open-button"
        data-open-mykola-context="${movieId}"
        aria-label="Всі поради"
      >
        Дивитись <span class="mykola-hint-arrow">→</span>
      </button>
    </div>
  `;
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
               data-movie-id="${movie.id}"
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

        <div class="movie-social-section">
          <button
            type="button"
            class="recommend-button ${
              hasCurrentUserRecommended(movie.movie_id) ? "recommended" : ""
            } ${
            currentUserRecommendationHasComment(movie.movie_id) ? "has-comment" : ""
            }"
           data-recommend-movie-id="${movie.movie_id}"
         >
           <span
             class="recommend-bubble-icon"
               aria-hidden="true"
            ></span>

            <span class="recommend-text">
              ${
                hasCurrentUserRecommended(movie.movie_id)
                  ? "Моя порада"
                  : "Порадити"
              }
            </span>
          </button>

          ${
            (movieRecommendationCounts[movie.movie_id] || 0) > 0
              ? `
                <div class="recommend-count-wrapper">
                  <button
                    type="button"
                    class="recommend-count-button has-recommendations ${
                      (movieRecommendationDetails[movie.movie_id] || []).some((item) => item.comment || item.is_mykola)
                        ? "has-comments"
                        : ""
                    }"
                    data-recommend-context-movie-id="${movie.movie_id}"
                    aria-label="Показати рекомендації"
                  >
                    <span class="recommend-count-icon"></span>
                      ${movieRecommendationCounts[movie.movie_id]}
                  </button>

                  ${renderRecommendationContext(movie.movie_id)}
                  </div>
                `
                : ""
              }
        </div>

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

async function recommendMovie(
  movieId,
  button,
  comment = null,
  ratingValue = null
) {
  if (!currentUser) {
    alert("Потрібно увійти в акаунт.");
    return false;
  }

  if (!currentGroupId) {
    alert("Поточну групу не визначено.");
    return false;
  }

  if (hasCurrentUserRecommended(movieId)) {
    return false;
  }

  const numericRating = Number(ratingValue);

  if (
    ratingValue === null ||
    ratingValue === undefined ||
    ratingValue === "" ||
    !Number.isFinite(numericRating) ||
    !Number.isInteger(numericRating * 2) ||
    numericRating < 1 ||
    numericRating > 20
  ) {
    alert("Оберіть оцінку фільму.");
    return false;
  }

  button.disabled = true;
  button.classList.add("recommended");
  // button.querySelector(".recommend-heart").textContent = "♥";
  button.querySelector(".recommend-text").textContent = "Зберігаю";

button.classList.toggle("has-comment", !!comment);

  const { data, error } = await supabaseClient
    .from("recommendations")
    .insert({
      movie_id: movieId,
      user_id: currentUser.id,
      context_group_id: currentGroupId,
      comment,
      rating_value: numericRating,
    })
    .select(`
      id,
      movie_id,
      user_id,
      comment,
      rating_value,
      context_group_id,
      created_at,
      profiles!recommendations_user_id_fkey (
        display_name,
        email
      ),
      groups!recommendations_context_group_id_fkey (
        id,
        name,
        type
      )
    `)
    .single();

  if (error) {
    button.disabled = false;
    button.classList.remove("recommended");
    button.classList.remove("has-comment");
    // button.querySelector(".recommend-heart").textContent = "♡";
    button.querySelector(".recommend-text").textContent = "Порадити";

    if (error.code === "23505") {
      await loadCurrentUserRecommendations();
      await loadMovieRecommendationCounts();
      await loadMovieRecommendationDetails();
      applyMykolaDailyRecommendation();
      applySearchAndFilters();
      return false;
    }

    alert(
      "Помилка збереження рекомендації\n\n" +
      "Message: " + error.message
    );
    return false;
  }

  currentUserRecommendations.push(data);

  button.querySelector(".recommend-text").textContent = "Моя порада";
  button.disabled = false;

  await loadMovieRecommendationCounts();
  await loadMovieRecommendationDetails();
  applyMykolaDailyRecommendation();
  applySearchAndFilters();

  return true;
}

function formatAdviceCountWord(count) {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return "порад";
  if (lastDigit === 1) return "порада";
  if (lastDigit >= 2 && lastDigit <= 4) return "поради";

  return "порад";
}

function resetMykolaRecommendationFlow() {
  mykolaChat.innerHTML = `
    <div class="mykola-actions" id="mykolaActions"></div>
  `;
}

function openMykolaAdviceContextView() {
  saveMainMykolaContext();
  mykolaMode = "advice";

  mainView.classList.remove("active");
  groupSettingsView.classList.remove("active");
  groupFormView.classList.remove("active");
  mykolaView.classList.add("active");

  window.scrollTo({
    top: mykolaView.offsetTop - 20,
    behavior: "smooth",
  });
}

function renderAdviceRoomIndicator(room) {
  const existing = document.getElementById("adviceRoomIndicator");

  if (existing) {
    existing.remove();
  }

  if (!room) return;

  const indicator = document.createElement("div");
  indicator.id = "adviceRoomIndicator";
  indicator.className = "advice-room-indicator";

  indicator.innerHTML = `
    <span>У кімнаті порад: ${room.result_participant_count}</span>
  `;

  mykolaChat.prepend(indicator);
}

function stopAdviceRoomPolling() {
  if (adviceRoomPollingTimer) {
    clearInterval(adviceRoomPollingTimer);
    adviceRoomPollingTimer = null;
  }
}

async function getActiveAdviceRoomRecommendations(movieId) {
  if (!activeAdviceRoom?.result_room_id) {
    return [];
  }

  const { data: participants, error } = await supabaseClient
    .from("advice_room_participants")
    .select("user_id")
    .eq("room_id", activeAdviceRoom.result_room_id)
    .in("status", ["active", "finished"]);

  if (error) {
    console.warn("Advice room participants load error:", error);
    return [];
  }

  const participantIds = new Set(
    (participants || []).map((participant) => participant.user_id)
  );

  if (!participantIds.size) {
    return [];
  }

  const allRecommendations = [
    ...(movieRecommendationDetails[movieId] || []),
  ];

  const myRecommendation = getCurrentUserRecommendation(movieId);

  if (myRecommendation) {
    allRecommendations.push(myRecommendation);
  }

  return allRecommendations.filter((recommendation) => {
    return (
      !recommendation.is_mykola &&
      participantIds.has(recommendation.user_id)
    );
  });
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function showAdviceRoomResult(recommendations, movieId) {
  addMykolaBubble(
    "Думки зафіксовано. Розберемо їх детальніше."
  );

  await wait(750);

  const preparationRow = addMykolaBubble(
    "Оформлюю висновок…"
  );

  preparationRow.classList.add(
    "mykola-result-preparation"
  );

  await wait(1100);

  preparationRow.classList.add("is-fading");

  await wait(550);

  preparationRow.remove();

  addMykolaArchiveSummaryBubble(
    recommendations,
    movieId,
    {
      title: "Загальний настрій кімнати",
      showRatingScale: true,
      animate: true,
    }
  );

  await wait(2100);

  addMykolaBubble(
    getAdviceAgreementPhrase(recommendations)
  );
}

async function refreshAdviceRoomState() {
  if (!activeAdviceRoom?.result_room_id) return;

  const { data, error } = await supabaseClient.rpc("get_advice_room_state", {
    p_room_id: activeAdviceRoom.result_room_id,
  });

  if (error) {
    console.warn("Advice room polling error:", error);
    return;
  }

  const roomState = data?.[0];

  if (!roomState) return;

  activeAdviceRoom = {
    ...activeAdviceRoom,
    ...roomState,
  };

  renderAdviceRoomIndicator(activeAdviceRoom);

  if (
    roomState.result_is_complete &&
    !adviceRoomResultShown
  ) {
    adviceRoomResultShown = true;
    stopAdviceRoomPolling();

    await loadMovieRecommendationDetails();
    applyMykolaDailyRecommendation();

    renderAdviceRoomIndicator(null);

    const movieId = activeAdviceRoom.result_movie_id;

    const recommendations =
        await getActiveAdviceRoomRecommendations(movieId);

    await showAdviceRoomResult(
      recommendations,
      movieId
    );
  }
}

function startAdviceRoomPolling() {
  stopAdviceRoomPolling();

  adviceRoomPollingTimer = setInterval(() => {
    refreshAdviceRoomState();
  }, 3000);
}

async function leaveActiveAdviceRoom() {
  if (!activeAdviceRoom?.result_room_id) return;

  const roomId = activeAdviceRoom.result_room_id;

  activeAdviceRoom = null;
  stopAdviceRoomPolling();
  renderAdviceRoomIndicator(null);

  await supabaseClient.rpc("leave_advice_room", {
    p_room_id: roomId,
  });
}

async function finishActiveAdviceRoom() {
  if (!activeAdviceRoom?.result_room_id) return null;

  const { data, error } = await supabaseClient.rpc("finish_advice_room", {
    p_room_id: activeAdviceRoom.result_room_id,
  });

  if (error) {
    console.warn("Finish advice room error:", error);
    alert(
      "Не вдалося завершити участь у кімнаті порад.\n\n" +
      error.message
    );
    return null;
  }

  const roomResult = data?.[0];

  if (!roomResult) {
    console.warn("Finish advice room returned no data");
    return null;
  }

  activeAdviceRoom = {
    ...activeAdviceRoom,
    ...roomResult,
    user_has_finished: true,
  };

  renderAdviceRoomIndicator(activeAdviceRoom);

  if (
    roomResult.result_is_complete &&
    !adviceRoomResultShown
  ) {
    adviceRoomResultShown = true;
    stopAdviceRoomPolling();

    await loadCurrentUserRecommendations();
    await loadMovieRecommendationDetails();
    applyMykolaDailyRecommendation();

    renderAdviceRoomIndicator(null);

    const movieId = activeAdviceRoom.result_movie_id;
    
    const recommendations =
      await getActiveAdviceRoomRecommendations(movieId);

    await showAdviceRoomResult(
      recommendations,
      movieId
    );  
  }

  return activeAdviceRoom;
}

async function openMykolaRecommendationFlow(movieId, button) {
  const movie = movies.find((item) => item.movie_id === movieId);

  if (!movie) {
    alert("Фільм не знайдено.");
    return;
  }

  const { data: roomData, error: roomError } =
    await supabaseClient.rpc("enter_advice_room", {
      p_movie_id: movieId,
      p_group_id: currentGroupId,
    });

  if (roomError) {
    debugAdviceRoom(
      `Помилка кімнати:\n${roomError.message}`
    );
    return;
  }

  const room = roomData?.[0];

  if (!room) {
    alert("Кімнату порад не вдалося створити.");
    return;
  }

  activeAdviceRoom = {
    ...room,
    result_movie_id: movieId,
    user_has_finished: false,
  };

  adviceRoomResultShown = false;

  debugAdviceRoom(
    `Кімната відкрита

Статус: ${room.result_room_status}
Учасників: ${room.result_participant_count}`
  );

  openMykolaAdviceContextView();
  resetMykolaRecommendationFlow();

  renderAdviceRoomIndicator(activeAdviceRoom);
  startAdviceRoomPolling();

  addUserBubble(
    `Моя порада щодо: ${movie.title}`
  );

  showMykolaRecommendationCommentForm(
    movieId,
    button
  );
}

const mykolaArchiveMarkScale = [
  [
    "Випадок майже без шансів на виправдання.",
    "Матеріал не витримав перевірки.",
    "Цей експонат краще залишити. Сподівання марні.",
  ],
  [
    "Нічого цікавого. На кафедру не виносити.",
    "До архіву не проситься. І причин не знаходжу.",
    "Обговорення можна завершити достроково.",
  ],
  [
    "Негативне враження. Аргументів на користь стрічки майже нема.",
    "Захищати цей випадок було б непросто.",
    "Враження не склалося. І матеріал не допоміг.",
  ],
  [
    "Стрічка не переконала. Хоча окремі наміри читаються.",
    "Наміри були цікавіші за результат.",
    "Формула не спрацювала. Але пошук напрямку помітний.",
  ],
  [
    "Матеріал так собі. І Скорсезе тут ні до чого.",
    "Кіно не винне. Але цього разу не зрослося.",
    "Більше запитань, ніж бажання порадити.",
  ],
  [
    "Слабкий результат. Потенціал проглядається під лупою.",
    "Не густо. Дещо все ж можна відкопати.",
    "Ріденько. До висновку ще бракує складових.",
  ],
  [
    "Стримано позитивне враження. Формула починає працювати з другого оберту.",
    "Другий погляд може виявитися щедрішим за перший.",
    "Початок обережний. Але висновок уже схиляється.",
  ],
  [
    "Непогано. Експертна комісія була не така сувора. А варто було б.",
    "Підстав для обережного схвалення вистачило.",
    "Кафедра ще сперечатиметься, але результат помітний.",
  ],
  [
    "До контрольного перегляду. З першого разу не зрозуміло.",
    "Випадок просить ще одного сеансу. Але не одразу.",
    "Остаточний висновок поки відкладається. Треба переварити.",
  ],
  [
    "Виважений висновок. Фільм не залишив байдужим.",
    "Матеріал переконливий. Первинну експертизу пройде.",
    "Спроба вдалася. Кафедра погодить.",
  ],
  [
    "Перспективний випадок. Додати в архів.",
    "Позначити окремою вкладкою. Може знадобитися.",
    "Архівне місце підготовлено. Третій ряд.",
  ],
  [
    "Скорсезе ще не телефонував, але інтерес уже є.",
    "Тут уже з’являється професійна цікавість.",
    "Випадок явно не для нижньої полиці.",
  ],
  [
    "Залишає хороше враження. Без скепсису.",
    "Аргументів проти майже не знаходиться.",
    "Матеріал не намагається виправдатись. І не треба.",
  ],
  [
    "Такі оцінки рідко бувають випадковими. Це вже не середнячок.",
    "Тут уже видно доказову базу. Схвалюю.",
    "Висновок має вагомі підстави. Віддати на кафедру.",
  ],
  [
    "Ближче до П. Джексона. До Alien ще далеко.",
    "Alien ще спокійний. Але насторожився.",
    "Амбіції читаються. Радити можна.",
  ],
  [
    "Майже без зауважень. Перевірити рецензійний журнал.",
    "Дрібні сумніви залишилися лише з професійної звички.",
    "Причепитися майже ні до чого. Це трохи підозріло.",
  ],
  [
    "Формула кіно виявилася напрочуд елегантною.",
    "Теорія майже на відмінно. Практика - задовільно.",
    "Рідкісний випадок, коли теорія і практика збіглися.",
  ],
  [
    "Екземпляр перевищив очікування.",
    "Був готовий до меншого. Розширити верхню полицю.",
    "Випадок приємно порушив мої розрахунки.",
  ],
  [
    "До головної теки. Такі оцінки нечасті.",
    "На окрему полицю. Без додаткових обговорень.",
    "Кафедру тут не питатимемо. Все очевидно.",
  ],
  [
    "Можна поставити поряд з Alien.",
    "Відкладаю олівець.",
    "Ось це і є кіно.",
  ],
];

function getMykolaArchiveMark(item) {
  if (
    item.rating_value === null ||
    item.rating_value === undefined ||
    item.rating_value === ""
  ) {
    return null;
  }

  const numericRating = Number(item.rating_value);

  if (!Number.isFinite(numericRating)) {
    return null;
  }

  const rating = Math.max(1, Math.min(20, Math.round(numericRating)));
  const variants = mykolaArchiveMarkScale[rating - 1];

  const seed =
    `${item.movie_id}:${item.user_id || currentUser?.id || "current-user"}:${item.rating_value}:${item.comment || ""}:archive-mark`;

  return getSeededItem(variants, seed);
}

function getAverageRecommendationRating(recommendations) {
  const ratings = recommendations
    .filter((item) => !item.is_mykola)
    .filter((item) =>
      item.rating_value !== null &&
      item.rating_value !== undefined &&
      item.rating_value !== ""
    )
    .map((item) => Number(item.rating_value))
    .filter((value) => Number.isFinite(value));

  if (!ratings.length) return null;

  const total = ratings.reduce((sum, value) => sum + value, 0);

  return total / ratings.length;
}

const mykolaArchiveMoodLabels = [
  ["майже антирекомендація", "архівне застереження", "службова тривога"],
  ["помітний скепсис", "дуже холодна підтримка", "сумнів із печаткою"],
  ["негативна порада", "радше попередження", "обережне «не поспішайте»"],
  ["рекомендація через силу", "слабка довіра", "підтримка з примітками"],
  ["слабкий інтерес", "дуже стримана симпатія", "обережне припущення"],
  ["помірний ентузіазм", "стримана цікавість", "низька, але жива підтримка"],
  ["обережна симпатія", "нерівна прихильність", "половинчаста підтримка"],
  ["стримана підтримка", "тиха симпатія", "обережний позитив"],
  ["міцна середина", "нейтральний плюс", "без сорому, без фанфар"],
  ["позитив без фанфар", "спокійна підтримка", "чесна середина"],
  ["спокійна прихильність", "тепла рекомендація", "помірна впевненість"],
  ["добрий знак", "впевнена симпатія", "архівне схвалення"],
  ["впевнена рекомендація", "помітна прихильність", "міцний запис"],
  ["явна прихильність", "переконлива підтримка", "сильний позитив"],
  ["дуже добрий настрій", "виразне схвалення", "майже урочистий тон"],
  ["сильна підтримка", "серйозна прихильність", "вагома рекомендація"],
  ["майже захоплення", "помітний слід", "висока довіра"],
  ["висока одностайність", "майже беззаперечне схвалення", "верхня полиця"],
  ["архівне захоплення", "урочиста прихильність", "Микола майже аплодує"],
  ["шедевральний консенсус", "повна архівна капітуляція", "верховне схвалення"],
];

const mykolaArchiveSummaries = [
  [
    "Картотека радить це радше як приклад того, чого краще уникати.",
    "Загальний настрій такий, ніби фільм переглянули з обовʼязку.",
    "Микола не забороняє, але дуже виразно піднімає брову.",
  ],
  [
    "Фільм згадують, але підтримка виглядає крихкою.",
    "Архів бачить тут більше попередження, ніж запрошення.",
    "Це той випадок, коли порада звучить майже як вибачення.",
  ],
  [
    "Загальний сигнал радше негативний: дивитись можна, але не поспішати.",
    "Картотека не викидає картку, але кладе її в підозрілу шухляду.",
    "Поради схиляються до того, що фільм краще залишити на потім.",
  ],
  [
    "Фільм отримав мінімальну підтримку, але без особливої віри.",
    "Тут є спроба щось порадити, але Микола чує втому в голосі.",
    "Картотека фіксує слабкий інтерес і сильну обережність.",
  ],
  [
    "Архів бачить інтерес, але не поспішає ставити печатку.",
    "Фільм не провалився остаточно, але й не переконав.",
    "Загальний настрій: можна, якщо очікування вже лежать на підлозі.",
  ],
  [
    "Ентузіазм помірний. Та все ж фільм не пройшов повз.",
    "Картотека не захоплена, але визнає: щось у цьому є.",
    "Фільм радять із поправкою на настрій, терпіння і чай.",
  ],
  [
    "Картотека схиляється до прихильності, але обережно.",
    "Фільм має своїх захисників, хоча Микола ще не переконаний повністю.",
    "Тут є симпатія, але без права на гучні заяви.",
  ],
  [
    "Фільм тримається краще, ніж здається на перший погляд.",
    "Підтримка стримана, але вже доволі стабільна.",
    "Архів не аплодує, але й не ховає картку назад.",
  ],
  [
    "Стабільна середина. Без сорому, без фанфар.",
    "Фільм отримує чесне «нормально», що в архіві теж іноді комплімент.",
    "Картотека не драматизує: перед нами міцна середина.",
  ],
  [
    "Позитивний запис, але Микола не драматизує.",
    "Фільм радять спокійно, без фанатизму і без сорому.",
    "Загальний настрій доброзичливий, хоча шампанське ще не відкривають.",
  ],
  [
    "Картотека ставиться до фільму тепло й спокійно.",
    "Фільм має достатньо підстав, щоб його радити.",
    "Микола бачить тут чесну, спокійну прихильність.",
  ],
  [
    "Тут уже є впевнена симпатія.",
    "Фільм радять не випадково: він явно працює.",
    "Архів помітно теплішає.",
  ],
  [
    "Фільм радять не випадково. Є за що зачепитись.",
    "Картотека бачить сильний запис і не сперечається.",
    "Загальний настрій уже впевнено позитивний.",
  ],
  [
    "Загальний настрій явно прихильний.",
    "Фільм залишив добрий слід, і це видно навіть крізь архівний пил.",
    "Микола вважає цю пораду достатньо переконливою.",
  ],
  [
    "Картотека майже посміхається. Майже.",
    "Фільм сприйняли дуже добре, без зайвого шуму.",
    "Тут уже серйозна заявка на сильну рекомендацію.",
  ],
  [
    "Підтримка сильна. Микола це занотував окремо.",
    "Фільм явно має вагу в цій картотеці.",
    "Архів бачить не просто симпатію, а стійку прихильність.",
  ],
  [
    "Фільм явно залишив помітний слід.",
    "Це вже майже територія особистої рекомендації з підкресленням.",
    "Картотека тримає цей запис ближче до верху.",
  ],
  [
    "Картотека майже не вагається.",
    "Фільм дуже близько до категорії «треба дивитись».",
    "Микола вже не просто радить, а майже наполягає.",
  ],
  [
    "Микола близький до урочистого формулювання.",
    "Архів ставиться до цього фільму з явною повагою.",
    "Це той випадок, коли картка виглядає особливо важкою.",
  ],
  [
    "Архів аплодує стоячи, але тихо. Бо архів.",
    "Картотека визнає: це один із найсильніших записів.",
    "Микола кладе цю картку туди, де пил витирають частіше.",
  ],
];

function getMykolaArchiveMoodLabel(averageRating, seedBase = "") {
  if (!averageRating) return null;

  const rating = Math.max(1, Math.min(20, Math.round(Number(averageRating))));
  const variants = mykolaArchiveMoodLabels[rating - 1];

  return getSeededItem(variants, `${seedBase}:${rating}:mood-label`);
}

function getMykolaArchiveSummary(averageRating, seedBase = "") {
  if (!averageRating) return null;

  const rating = Math.max(1, Math.min(20, Math.round(Number(averageRating))));
  const variants = mykolaArchiveSummaries[rating - 1];

  return getSeededItem(variants, `${seedBase}:${rating}:summary`);
}

function getRecommendationDisplayName(item) {
  return (
    item.profiles?.display_name ||
    item.profiles?.email ||
    "Користувач"
  );
}

function getRatedRecommendations(recommendations) {
  return recommendations
    .filter((item) => !item.is_mykola)
    .filter((item) => {
      return (
        item.rating_value !== null &&
        item.rating_value !== undefined &&
        item.rating_value !== "" &&
        Number.isFinite(Number(item.rating_value))
      );
    })
    .map((item) => ({
      ...item,
      numericRating: Number(item.rating_value),
    }))
    .sort((a, b) => {
      const ratingDifference =
        a.numericRating - b.numericRating;

      if (ratingDifference !== 0) {
        return ratingDifference;
      }

      /*
       * Стабільний порядок для однакових оцінок.
       * Не залежить від того, хто зараз переглядає результат.
       */
      return String(a.user_id || "").localeCompare(
        String(b.user_id || "")
      );
    });
}

function positionFloatingAdviceLabels(container) {
  const labels = container.querySelectorAll(
    ".advice-result-scale-label.is-floating"
  );

  labels.forEach((label) => {
    const scale = label.closest(".advice-result-scale");
    const line = scale?.querySelector(".advice-result-scale-line");

    if (!scale || !line) return;

    const targetPosition =
      Number(label.dataset.targetPosition);

    if (!Number.isFinite(targetPosition)) return;

    const scaleRect = scale.getBoundingClientRect();
    const lineRect = line.getBoundingClientRect();

    const lineStart =
      lineRect.left - scaleRect.left;

    const desiredCenter =
      lineStart +
      lineRect.width * (targetPosition / 100);

    const edgePadding = 8;

    label.style.left = "";
    label.style.right = "";
    label.style.transform = "";
    label.style.textAlign = "";

    if (targetPosition <= 25) {
      label.style.left = `${edgePadding}px`;
      label.style.right = "auto";
      label.style.transform = "none";
      label.style.textAlign = "left";
    } else if (targetPosition >= 75) {
      label.style.left = "auto";
      label.style.right = `${edgePadding}px`;
      label.style.transform = "none";
      label.style.textAlign = "right";
    } else {
      const labelWidth = label.offsetWidth;

      const minimumCenter =
        labelWidth / 2 + edgePadding;

      const maximumCenter =
        scale.clientWidth -
        labelWidth / 2 -
        edgePadding;

      const actualCenter =
        minimumCenter <= maximumCenter
          ? Math.max(
              minimumCenter,
              Math.min(maximumCenter, desiredCenter)
            )
          : scale.clientWidth / 2;

      label.style.left = `${actualCenter}px`;
      label.style.right = "auto";
      label.style.transform = "translateX(-50%)";
      label.style.textAlign = "center";
    }
  });
}

function createAdviceRoomRatingScaleHtml(recommendations) {
  const ratedItems =
    getRatedRecommendations(recommendations);

  if (ratedItems.length < 2) {
    return "";
  }

  const minRating =
    ratedItems[0].numericRating;

  const maxRating =
    ratedItems[ratedItems.length - 1].numericRating;

  const minItems = ratedItems.filter((item) => {
    return item.numericRating === minRating;
  });

  const maxItems = ratedItems.filter((item) => {
    return item.numericRating === maxRating;
  });

  /*
   * Порядок імен стабільний, оскільки ratedItems
   * уже відсортований спочатку за оцінкою,
   * а для однакових оцінок — за user_id.
   */
  const minNames = minItems
    .map(getRecommendationDisplayName)
    .join(" • ");

  const maxNames = maxItems
    .map(getRecommendationDisplayName)
    .join(" • ");

  const ratingToPercent = (rating) => {
    return ((rating - 1) / 19) * 100;
  };

  /*
   * Підпис залишається точно на координаті своєї оцінки.
   * Клас визначає лише напрямок розгортання тексту.
   */
  const getLabelAnchorClass = (position) => {
    if (position <= 24) {
      return "is-left";
    }

    if (position >= 76) {
      return "is-right";
    }

    return "is-center";
  };

  /*
   * Групуємо голоси за оцінкою.
   * Однакові оцінки показуємо окремими поділками,
   * трохи розсунутими горизонтально.
   */
  const ratingGroups = new Map();

  ratedItems.forEach((item) => {
    const rating = item.numericRating;

    if (!ratingGroups.has(rating)) {
      ratingGroups.set(rating, []);
    }

    ratingGroups.get(rating).push(item);
  });

  const ticksHtml = [...ratingGroups.entries()]
    .flatMap(([rating, items]) => {
      const position =
        ratingToPercent(Number(rating));

      return items.map((item, index) => {
        const groupCenter =
          (items.length - 1) / 2;

        const offset =
          (index - groupCenter) * 4;

        return `
          <span
            class="advice-result-scale-tick"
            style="
              left: ${position}%;
              margin-left: ${offset}px;
            "
          ></span>
        `;
      });
    })
    .join("");

  /*
   * Повна одностайність:
   * усі імена в одному підписі біля спільної оцінки.
   */
  if (minRating === maxRating) {
    const allNames = ratedItems
      .map(getRecommendationDisplayName)
      .join(" • ");

    const position =
      ratingToPercent(minRating);

    const anchorClass =
      getLabelAnchorClass(position);

    return `
      <div class="advice-result-scale">
        <div class="advice-result-scale-line">
          ${ticksHtml}
        </div>

        <div
          class="
            advice-result-scale-label
            advice-result-scale-label-combined
            ${anchorClass}
          "
          style="left: ${position}%"
        >
          ${escapeHtml(allNames)}
        </div>
      </div>
    `;
  }

  /*
   * Вузький діапазон:
   * один спільний підпис у правильному порядку:
   *
   * нижча оцінка • вища оцінка
   *
   * Проміжні голоси залишаються лише поділками.
   */

  // тут був старий блок показу вузького діапазону

  /*
   * Ширший діапазон:
   * підписуємо лише найнижчу і найвищу оцінки.
   * Кожен підпис розташований точно біля своєї поділки.
   */
  const minPosition =
    ratingToPercent(minRating);

  const maxPosition =
    ratingToPercent(maxRating);

  const minAnchorClass =
    getLabelAnchorClass(minPosition);

  const maxAnchorClass =
    getLabelAnchorClass(maxPosition);

  const middleRating =
    (minRating + maxRating) / 2;

  const middlePosition =
    ratingToPercent(middleRating);

  const combinedNames =
    `${minNames} • ${maxNames}`;

  return `
    <div class="advice-result-scale">
      <div class="advice-result-scale-line">
        ${ticksHtml}
      </div>

      <div
        class="
          advice-result-scale-label
          advice-result-scale-label-min
          ${minAnchorClass}
        "
        style="left: ${minPosition}%"
      >
        ${escapeHtml(minNames)}
      </div>

      <div
        class="
          advice-result-scale-label
          advice-result-scale-label-max
          ${maxAnchorClass}
        "
        style="left: ${maxPosition}%"
      >
        ${escapeHtml(maxNames)}
      </div>

      <div
        class="
          advice-result-scale-label
          advice-result-scale-label-combined
          is-floating
        "
        data-target-position="${middlePosition}"
      >
        ${escapeHtml(combinedNames)}
      </div>
    </div>
  `;
}

function resolveAdviceScaleLabelCollisions(container) {
  const scales = container.querySelectorAll(
    ".advice-result-scale"
  );

  scales.forEach((scale) => {
    const minLabel = scale.querySelector(
      ".advice-result-scale-label-min"
    );

    const maxLabel = scale.querySelector(
      ".advice-result-scale-label-max"
    );

    const combinedLabel = scale.querySelector(
      ".advice-result-scale-label-combined.is-floating"
    );

    if (!minLabel || !maxLabel || !combinedLabel) {
      return;
    }

    /*
     * Спершу вмикаємо окремі підписи,
     * щоб виміряти їх у природному стані.
     */
    scale.classList.remove("uses-combined-label");

    const minRect =
      minLabel.getBoundingClientRect();

    const maxRect =
      maxLabel.getBoundingClientRect();

    const safetyGap = 8;

    const hasCollision =
      minRect.right + safetyGap > maxRect.left;

    scale.classList.toggle(
      "uses-combined-label",
      hasCollision
    );
  });
}

let adviceScaleResizeTimer = null;

window.addEventListener("resize", () => {
  clearTimeout(adviceScaleResizeTimer);

  adviceScaleResizeTimer = setTimeout(() => {
    document
      .querySelectorAll(".mykola-message-row")
      .forEach((row) => {
        resolveAdviceScaleLabelCollisions(row);
        positionFloatingAdviceLabels(row);
      });
  }, 120);
});

function getAdviceAgreementPhrase(recommendations) {
  const ratedItems = getRatedRecommendations(recommendations);

  if (ratedItems.length < 2) {
    return "Для дискусії замало голосів. Але картотека все одно все занотувала.";
  }

  const ratings = ratedItems.map((item) => item.numericRating);

  const minRating = Math.min(...ratings);
  const maxRating = Math.max(...ratings);
  const spread = maxRating - minRating;

  const seedBase = ratings
    .slice()
    .sort((a, b) => a - b)
    .join(":");

  if (spread <= 1.5) {
    return getSeededItem(
      [
        "Обійшлося без бійки. І це вже результат.",
        "Рідкісний випадок: кафедра майже одностайна.",
        "Дивовижно. Майже всі дивилися один і той самий фільм.",
      ],
      `${seedBase}:agreement:very-high`
    );
  }

  if (spread <= 4) {
    return getSeededItem(
      [
        "Погодилися в головному. Деталі традиційно стали проблемою.",
        "Загальний напрям зрозумілий. Розбіжності залишилися в межах пристойності.",
        "Кафедра загалом погодилася. Протокол можна не ховати.",
      ],
      `${seedBase}:agreement:high`
    );
  }

  if (spread <= 7) {
    return getSeededItem(
      [
        "Спільний висновок є. Але кожен прийшов до нього своєю дорогою.",
        "Погляди відрізняються, хоча барикади ще не будують.",
        "Дискусія була помітною. Консенсус — умовним.",
      ],
      `${seedBase}:agreement:medium`
    );
  }

  if (spread <= 11) {
    return getSeededItem(
      [
        "Думки суттєво розійшлися. Кафедра знову жива.",
        "Єдиного висновку немає. Зате дискусія вдалася.",
        "Погляди розійшлися настільки, що знадобиться окреме засідання.",
      ],
      `${seedBase}:agreement:low`
    );
  }

  return getSeededItem(
    [
      "Схоже, ви дивилися різні фільми.",
      "Кафедра розділилася на два табори. Олівці вже загострені.",
      "Єдності немає навіть у питанні, чи був це той самий сеанс.",
    ],
    `${seedBase}:agreement:very-low`
  );
}

function addMykolaArchiveSummaryBubble(
  recommendations,
  movieId = "",
  options = {}
) {
  
  const summaryTitle =
    options.title ||
    "Загальний настрій картотеки";
  
  const averageRating =
    getAverageRecommendationRating(recommendations);

  if (!averageRating) return null;

  const seedBase =
    `${movieId}:${averageRating}:${recommendations.length}`;

  const moodLabel =
    getMykolaArchiveMoodLabel(averageRating, seedBase);

  const summary =
    getMykolaArchiveSummary(averageRating, seedBase);

  const ratingScaleHtml =
    options.showRatingScale
      ? createAdviceRoomRatingScaleHtml(recommendations)
      : "";

  const row = addMykolaBubble(`
    <div class="mykola-archive-summary">
      <div class="mykola-archive-summary-label">
        ${escapeHtml(summaryTitle)}:
        <span>${escapeHtml(moodLabel)}</span>
      </div>

      <div class="mykola-archive-summary-text">
        ${escapeHtml(summary)}
      </div>

      ${ratingScaleHtml}
    </div>
  `);

  requestAnimationFrame(() => {
    resolveAdviceScaleLabelCollisions(row);
    positionFloatingAdviceLabels(row);
  });

  if (options.animate && row) {
    row.classList.add("mykola-result-reveal");

    setTimeout(() => {
      row.classList.add("visible");
    }, 80);
  }

  return row;
}

function createRatingSliderHtml(value = 10) {
  return `
    <div class="mykola-rating-block">
      <input
        type="range"
        class="mykola-rating-slider"
        min="1"
        max="20"
        step="0.5"
        value="${value}"
      >

      <div class="mykola-rating-labels">
        <span>Ну, таке…</span>
        <span class="rating-label-ok">Непогано</span>
        <span>Шедевр</span>
      </div>
    </div>
  `;
}

function wireRatingSlider(row) {
  const slider = row.querySelector(".mykola-rating-slider");

  if (!slider) return;

  function updateSliderProgress() {
    const min = Number(slider.min);
    const max = Number(slider.max);
    const value = Number(slider.value);

    const progress = ((value - min) / (max - min)) * 100;

    slider.style.setProperty("--rating-progress", `${progress}%`);
  }

  slider.addEventListener("input", updateSliderProgress);

  updateSliderProgress();
}

function getRatingValue(row) {
  const slider = row.querySelector(".mykola-rating-slider");
  return slider ? Number(slider.value) : null;
}

function showMykolaRecommendationCommentForm(movieId, button) {
  const row = document.createElement("div");
  row.className = "user-message-row user-input-row";
  row.id = "mykolaRecommendationCommentForm";

  row.innerHTML = `
    <div class="user-bubble user-comment-form-bubble">
      <textarea
        id="mykolaRecommendationCommentInput"
        placeholder="Додайте коментар, якщо хочете..."
      ></textarea>

      ${createRatingSliderHtml(10)}

      <div class="mykola-comment-form-actions user-comment-form-actions">
        <button id="mykolaSaveCommentButton" type="button">
          Зберегти
        </button>

        <button id="mykolaCancelCommentButton" type="button">
          Без коментаря
        </button>
      </div>
    </div>

    <div class="user-avatar">
      ${getUserAvatarLetter()}
    </div>
  `;

  const actions = document.getElementById("mykolaActions");
  mykolaChat.insertBefore(row, actions);

  scrollMykolaChatToBottom();

  wireRatingSlider(row);

  document
    .getElementById("mykolaSaveCommentButton")
    .addEventListener("click", async () => {
      const comment = document
        .getElementById("mykolaRecommendationCommentInput")
        .value
        .trim();

      if (!comment) {
        alert("Коментар не може бути порожнім.");
        return;
      }

      const ratingValue = getRatingValue(row);

      const success = await recommendMovie(movieId, button, comment, ratingValue);

      if (!success) return;

      row.remove();

      const roomResult = await finishActiveAdviceRoom();

      if (roomResult?.result_is_complete) {
        return;
      }

      const shouldWaitForRoom =
        roomResult?.result_participant_count > 1 &&
        !roomResult?.result_is_complete;

      runWithMykolaThinking(() => {
        addMykolaBubble(
          shouldWaitForRoom
            ? "Вашу пораду збережено. Чекаю, поки інші завершать голосування."
            : "Занотував. Тепер це вже не просто рекомендація, а майже джерело."
        );
      }, 900);
    });

  document
    .getElementById("mykolaCancelCommentButton")
    .addEventListener("click", async () => {
      const ratingValue = getRatingValue(row);
      const success = await recommendMovie(movieId, button, null, ratingValue);
      
      if (!success) return;

      row.remove();
      
      const roomResult = await finishActiveAdviceRoom();

      if (roomResult?.result_is_complete) {
        return;
      }

      const shouldWaitForRoom =
        roomResult?.result_participant_count > 1 &&
        !roomResult?.result_is_complete;

      runWithMykolaThinking(() => {
        addMykolaBubble(
          shouldWaitForRoom
            ? "Вашу пораду зафіксовано. Чекаю, поки інші завершать голосування."
            : "Зафіксовано. Можете повертатись до списку."
        );
      }, 900);
    });
}

function getMykolaArchiveIntro(count) {
  if (count === 0) {
    return "Переглядаю картотеку. Порожньо. Навіть пилюка розчарована.";
  }

  if (count === 1) {
    return getRandomItem([
      "У картотеці лише одна згадка про цей фільм.",
      "Знайшов один запис. Небагато, але вже не тиша.",
      "Є один запис у картотеці. Скромно, але офіційно.",
    ]);
  }

  if (count <= 3) {
    return getRandomItem([
      `Переглядаю картотеку. Знайдено ${count} ${formatAdviceCountWord(count)}.`,
      `Відкриваю шухляду. Тут ${count} ${formatAdviceCountWord(count)} щодо цього фільму.`,
      `У картотеці є ${count} ${formatAdviceCountWord(count)}. Уже можна робити вигляд, що це дослідження.`,
    ]);
  }

  return getRandomItem([
    `Картотека не мовчить. Знайдено ${count} ${formatAdviceCountWord(count)}.`,
    `Відкриваю шухляду. Тут уже ${count} ${formatAdviceCountWord(count)} щодо цього фільму.`,
    `Знайдено ${count} ${formatAdviceCountWord(count)}. Схоже, фільм залишив слід у колективній памʼяті.`,
  ]);
}

function openMykolaRecommendationContext(movieId) {
  const movie = movies.find((item) => {
    return item.movie_id === movieId;
  });

  if (!movie) {
    alert("Фільм не знайдено.");
    return;
  }

  const recommendations = movieRecommendationDetails[movieId] || [];

  openMykolaAdviceContextView();

  resetMykolaRecommendationFlow();

  addUserBubble(`Покажи всі поради: ${movie.title}`);

  runWithMykolaThinking(() => {
    addMykolaBubble(getMykolaArchiveIntro(recommendations.length));

      setTimeout(() => {
        addMykolaArchiveSummaryBubble(recommendations, movieId);

        setTimeout(() => {
          addMykolaMovieBubble(movie);

          setTimeout(() => {
            addMykolaRecommendationCards(recommendations);
          }, 450);
        }, 450);
      }, 450);
  }, 1000);
}

function rotateRecommendationStack(items, offset) {
  if (!items.length) return [];

  return items.map((_, index) => {
    return items[(index + offset) % items.length];
  });
}

const mykolaDailyRecommendationComments = [
  "Моя порада на сьогодні. Не гарантія геніальності, але дуже близько.",
  "Сьогодні картотека схиляється саме до цього варіанту.",
  "Микола радить. Архів погоджується мовчазним кивком.",
  "Добрий кандидат на вечір, коли хочеться не просто щось увімкнути.",
  "Не наполягаю. Просто залишаю це тут із дуже серйозним виглядом.",
];

function getMykolaDailyComment(item) {
  const seed = `${item.movie_id || ""}:${getTodayKey()}:mykola-comment`;
  const index = hashString(seed) % mykolaDailyRecommendationComments.length;

  return mykolaDailyRecommendationComments[index];
}

function createMykolaRecommendationCard(item, index, total) {
  const name =
    item.profiles?.display_name ||
    item.profiles?.email ||
    "Користувач";

  const groupName = item.groups?.name
    ? `${getGroupTypeNominativeLabel(item.groups.type)} ${item.groups.name}`
    : "Група не вказана";

  const comment =
    item.comment ||
    (item.is_mykola
      ? getMykolaDailyComment(item)
      : "Без коментаря. Лаконічно, але підозріло.");

  const archiveMark = getMykolaArchiveMark(item);

  const card = document.createElement("div");
  card.className = `mykola-recommendation-card mykola-stack-card mykola-stack-card-${index}`;

  card.innerHTML = `
    <div class="mykola-recommendation-card-header">
      <div>
        <div class="mykola-recommendation-card-name">
          ${escapeHtml(name)}
        </div>

        <div class="mykola-recommendation-card-group">
          ${escapeHtml(groupName)}
        </div>
      </div>

      <div class="mykola-recommendation-card-index">
        ${item.displayIndex}/${total}
      </div>
    </div>

    <div class="mykola-recommendation-card-divider"></div>

    <div class="mykola-recommendation-card-comment">
      ${escapeHtml(comment)}
    </div>
    ${archiveMark ? `
      <div class="mykola-archive-mark">
        <div class="mykola-archive-mark-label">
          <span class="icon">✎</span> М. для архіву:
        </div>

        <div class="mykola-archive-mark-text">
          ${escapeHtml(archiveMark)}
        </div>
      </div>
    ` : ""}
  `;

  return card;
}

function addMykolaRecommendationCards(recommendations) {
  if (!recommendations.length) {
    addMykolaBubble("Порожньо. Картотека мовчить.");
    return;
  }

  activeRecommendationStack = [...recommendations]
    .sort((a, b) => {
      const priorityDiff =
        getRecommendationPriority(a) - getRecommendationPriority(b);

      if (priorityDiff !== 0) return priorityDiff;

      const aDate = new Date(a.created_at || 0).getTime();
      const bDate = new Date(b.created_at || 0).getTime();

      return bDate - aDate;
    })
    .map((item, index) => ({
      ...item,
      originalIndex: index,
    }));

  activeRecommendationStackOffset = 0;

  renderMykolaRecommendationStack(true);
}

function renderMykolaRecommendationStack(shouldScroll = false) {
  const oldRow = document.querySelector(".mykola-card-stack-row");

  const previousTop = oldRow
    ? oldRow.getBoundingClientRect().top
    : null;

  if (oldRow) {
    oldRow.remove();
  }

  const visibleItems = rotateRecommendationStack(
    activeRecommendationStack,
    activeRecommendationStackOffset
  );

  const row = document.createElement("div");
  row.className = "mykola-message-row mykola-card-stack-row";

  const stack = document.createElement("div");
  stack.className = "mykola-card-stack";

  visibleItems.slice(0, 3).forEach((item, index) => {
    stack.appendChild(
      createMykolaRecommendationCard(
        {
          ...item,
          displayIndex: item.originalIndex + 1,
        },
        index,
        activeRecommendationStack.length
      )
    );
  });

  row.appendChild(stack);

  const actions = document.getElementById("mykolaActions");
  mykolaChat.insertBefore(row, actions);

  attachMykolaStackHandlers(stack);

  if (shouldScroll) {
    scrollMykolaChatToBottom();
    return;
  }

  requestAnimationFrame(() => {
    if (previousTop === null) return;

    const newTop = row.getBoundingClientRect().top;
    const delta = newTop - previousTop;

    window.scrollBy({
      top: delta,
      behavior: "auto",
    });
  });
}

function attachMykolaStackHandlers(stack) {
  if (!stack || activeRecommendationStack.length <= 1) return;

  const topCard = stack.querySelector(".mykola-stack-card:first-child");
  const secondCard = stack.querySelector(".mykola-stack-card:nth-child(2)");
  const thirdCard = stack.querySelector(".mykola-stack-card:nth-child(3)");
  
  if (!topCard) return;

  topCard.classList.add("is-clickable");

  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let currentY = 0;
  let isDragging = false;

  const threshold = 80;

  function lockHorizontalOverflow() {
    document.body.style.overflowX = "hidden";
    document.documentElement.style.overflowX = "hidden";
  }

  function unlockHorizontalOverflow() {
    document.body.style.overflowX = "";
    document.documentElement.style.overflowX = "";
  }

  function resetCard() {
    topCard.classList.remove("is-dragging");
    topCard.classList.add("is-settling");

    topCard.style.transform = "translateX(0) translateY(0) rotate(0deg) scale(1)";
    topCard.style.opacity = "1";

    unlockHorizontalOverflow();

    if (secondCard) {
      secondCard.style.transform = "";
      secondCard.style.opacity = "";
    }

    if (thirdCard) {
      thirdCard.style.transform = "";
      thirdCard.style.opacity = "";
    }

    setTimeout(() => {
      topCard.classList.remove("is-settling");
      topCard.style.transform = "";
      isRecommendationStackInteracting = false;
    }, 420);
  }

  function completeSwipe(direction) {
    topCard.classList.remove("is-dragging");
    topCard.classList.add("is-settling");

    const exitX = direction > 0 ? 360 : -360;
    const rotate = direction > 0 ? 10 : -10;

    topCard.style.transform = `
      translateX(${exitX}px)
      translateY(-26px)
      rotate(${rotate}deg)
      scale(0.96)
    `;
    topCard.style.opacity = "0";

    if (secondCard) {
      secondCard.classList.add("is-promoting");
      secondCard.style.transform = `
        translateX(0)
        translateY(0)
        scale(1)
      `;
      secondCard.style.opacity = "1";
    }

    if (thirdCard) {
      thirdCard.classList.add("is-promoting");
      thirdCard.style.transform = `
        translateX(14px)
        translateY(8px)
        scale(0.985)
      `;
      thirdCard.style.opacity = "0.92";
    }

      setTimeout(() => {
        topCard.style.visibility = "hidden";

        unlockHorizontalOverflow();

        activeRecommendationStackOffset =
          direction > 0
            ? (activeRecommendationStackOffset + 1) % activeRecommendationStack.length
            : (activeRecommendationStackOffset - 1 + activeRecommendationStack.length) %
                activeRecommendationStack.length;

        requestAnimationFrame(() => {
          renderMykolaRecommendationStack(false);

          setTimeout(() => {
            isRecommendationStackInteracting = false;
          }, 250);
        });
      }, 420);
  }

  topCard.addEventListener("pointerdown", (event) => {
    event.preventDefault();

    lockHorizontalOverflow();

    isRecommendationStackInteracting = true;
    isDragging = true;

    startX = event.clientX;
    startY = event.clientY;
    currentX = 0;
    currentY = 0;

    topCard.classList.add("is-dragging");

    try {
      topCard.setPointerCapture(event.pointerId);
    } catch (error) {}
  });

  topCard.addEventListener("pointermove", (event) => {
    if (!isDragging) return;

    event.preventDefault();

    currentX = event.clientX - startX;
    currentY = event.clientY - startY;

    const rotate = currentX * 0.035;

    topCard.style.transform = `
      translateX(${currentX}px)
      translateY(${currentY}px)
      rotate(${rotate}deg)
      scale(1.01)
    `;
    
    const progress = Math.min(Math.abs(currentX) / 160, 1);

    if (secondCard) {
      secondCard.style.transform = `
        translateX(${14 - progress * 14}px)
        translateY(${8 - progress * 8}px)
        scale(${0.985 + progress * 0.015})
      `;
      secondCard.style.opacity = `${0.92 + progress * 0.08}`;
    }

    if (thirdCard) {
      thirdCard.style.transform = `
        translateX(${28 - progress * 14}px)
        translateY(${16 - progress * 8}px)
        scale(${0.97 + progress * 0.015})
      `;
      thirdCard.style.opacity = `${0.78 + progress * 0.14}`;
    }
  });

  topCard.addEventListener("pointerup", () => {
    if (!isDragging) return;

    isDragging = false;

    if (Math.abs(currentX) >= threshold) {
      completeSwipe(currentX > 0 ? 1 : -1);
    } else {
      resetCard();
    }
  });

  topCard.addEventListener("pointercancel", () => {
    if (!isDragging) return;

    isDragging = false;
    resetCard();
  });
  
  topCard.addEventListener("lostpointercapture", () => {
    if (!isDragging) return;

    isDragging = false;
    resetCard();
  });
}

function renderImdbSearchResults(list) {
  isShowingImdbResults = true;

  movieCount.textContent = `(${list.length})`;
  moviesGrid.innerHTML = "";

  if (list.length === 0) {
    moviesGrid.innerHTML = "<p>На IMDb нічого не знайдено.</p>";
    return;
  }

  list.forEach((movie) => {
    const card = document.createElement("article");
    card.className = "card";

    const poster = movie.poster_url
      ? movie.poster_url
      : "https://via.placeholder.com/400x600?text=No+Poster";

    const existingMovie = findMovieByImdbId(movie.imdb_id);

    const actionHtml = !movie.imdb_id
      ? `
        <button type="button" disabled>
          IMDb ID відсутній
        </button>
      `
      : existingMovie
        ? `
          <div class="imdb-existing-movie">
            Є у списку «${formatStatusTitle(existingMovie.status)}»
          </div>
        `
        : `
          <button
            type="button"
            data-add-imdb-id="${escapeHtml(movie.imdb_id)}"
          >
            Додати
          </button>
        `;

    card.innerHTML = `
      <div class="poster-wrapper">
        <img src="${escapeHtml(poster)}" alt="${escapeHtml(movie.title)}" />
      </div>

      <div class="card-content">
        <h3>${escapeHtml(movie.title)}</h3>

        <div class="meta">
          ${movie.year || "Рік не вказано"}<br>
          IMDb ID: ${movie.imdb_id ? escapeHtml(movie.imdb_id) : "відсутній"}
        </div>

        ${actionHtml}
      </div>
    `;

    moviesGrid.appendChild(card);
  });
}

moviesGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add-imdb-id]");

  if (!button) return;

  const imdbId = button.dataset.addImdbId;

  const movie = imdbSearchResults.find((item) => {
    return item.imdb_id === imdbId;
  });

  if (!movie) {
    alert("Фільм не знайдено в результатах пошуку.");
    return;
  }

  resetFormMode();

  document.getElementById("imdb_url").value =
    `https://www.imdb.com/title/${movie.imdb_id}/`;

  document.getElementById("title").value = movie.title || "";
  document.getElementById("year").value = movie.year || "";

  getCurrentUserDisplayName().then((displayName) => {
    if (displayName) {
      setAddedByField(displayName, true);
    } else {
      setAddedByField("", false);
    }
  });

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

moviesGrid.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-recommend-movie-id]");

  if (!button) return;

  const movieId = button.dataset.recommendMovieId;

  if (hasCurrentUserRecommended(movieId)) {
    toggleMyAdviceCard(movieId, button);
    return;
  }

  openMykolaRecommendationFlow(movieId, button);
});

moviesGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-recommend-context-movie-id]");

  if (!button) return;

  event.stopPropagation();

  const movieId = button.dataset.recommendContextMovieId;
  const menu = document.querySelector(
    `[data-recommend-context-menu="${movieId}"]`
  );

  document
    .querySelectorAll(".recommend-context-menu")
    .forEach((dropdown) => {
      if (dropdown !== menu) {
        dropdown.style.display = "none";
      }
    });

  if (menu) {
    menu.style.display =
      menu.style.display === "block" ? "none" : "block";
  }

  const card = button.closest(".card");

  document.querySelectorAll(".card.has-open-context").forEach((c) => {
    c.classList.remove("has-open-context");
  });

  if (menu?.style.display === "block") {
    card?.classList.add("has-open-context");
  }
  
});

moviesGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open-mykola-context]");

  if (!button) return;

  event.stopPropagation();

  const movieId = button.dataset.openMykolaContext;

  openMykolaRecommendationContext(movieId);
});

moviesGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-my-advice]");

  if (!button) return;

  event.stopPropagation();

  const movieId = button.dataset.editMyAdvice;

  document.querySelectorAll(".my-advice-card").forEach((card) => {
    card.remove();
  });

  document.querySelectorAll(".card.has-open-advice").forEach((card) => {
    card.classList.remove("has-open-advice");
  });

  openMyAdviceEditFlow(movieId);
});

function attachPurchaseLinkHandlers() {

  document.querySelectorAll(".purchase-link").forEach((link) => {

    link.addEventListener("click", (event) => {

      event.preventDefault();

      const movie = movies.find(
        (item) => item.id === link.dataset.movieId
      );

      if (!movie || !canOpenMovieUrl(movie)) {

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

function formatStatusTitle(status) {
  const label = formatStatus(status);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatMovieCountWord(count) {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return "фільмів";
  }

  if (lastDigit === 1) {
    return "фільм";
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return "фільми";
  }

  return "фільмів";
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
    return (
      movie.imdb_id === imdbId ||
      normalizeImdbIdFromUrl(movie.imdb_url) === imdbId
    );
  });
}

async function findExistingMovieMetadataByImdbId(imdbId) {
  if (!imdbId) return null;

  const { data, error } = await supabaseClient
    .from("movies")
    .select("id, imdb_id")
    .eq("imdb_id", imdbId)
    .maybeSingle();

  if (error) {
    console.error("Existing movie metadata lookup error:", error);
    return null;
  }

  return data || null;
}

function resetSmartSearchState() {
  pendingImdbUrl = null;
  pendingImdbId = null;
  pendingSearchQuery = "";
  imdbSearchResults = [];
  isShowingImdbResults = false;

  searchHint.textContent = "";
  searchHint.className = "search-hint";

  showAddFormButton.textContent = "Додати";
  showAddFormButton.style.display = "block";
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
    poster_url: null,
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
    notes: null,
    added_by: document.getElementById("added_by").value.trim() || null,
  };
}

function getMovieGroupListData(movieData) {
  return {
    status: movieData.status,
    recommended_medium: movieData.recommended_medium,
    owned_medium: movieData.owned_medium,
    purchase_url: movieData.purchase_url,
    added_by: movieData.added_by,
    updated_at: new Date().toISOString(),
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
  document.getElementById("recommended_medium").value =
    movie.recommended_medium || "";
  document.getElementById("status").value =
    movie.status || "wishlist";
  document.getElementById("owned_medium").value =
    movie.owned_medium || "";
  document.getElementById("purchase_url").value =
    movie.purchase_url || "";
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
  document.getElementById("imdb_url").style.display = "block";
  lookupButton.style.display = "block";

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

  document.getElementById("imdb_url").style.display = "none";
  lookupButton.style.display = "none";

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

  if (editingMovieId) {
    console.log("Updating movie:", editingMovieId);

    const listData = getMovieGroupListData(movieData);

    const { error: listUpdateError } = await supabaseClient
      .from("movie_group_lists")
      .update(listData)
      .eq("id", editingMovieId);

    if (listUpdateError) {
      alert(
        "Помилка оновлення фільму у списку\n\n" +
        "Code: " + (listUpdateError.code || "N/A") + "\n" +
        "Message: " + listUpdateError.message + "\n" +
        "Details: " + (listUpdateError.details || "No details")
      );
      return;
    }

    alert("Зміни збережено");
    resetFormMode();
    loadMovies();
    return;
  }

  if (!movieData.title) {
    alert("Назва фільму обов'язкова.");
    return;
  }

  const imdbId = normalizeImdbIdFromUrl(movieData.imdb_url);

  if (!imdbId) {
    alert(
      "IMDb URL є обовʼязковим. Вставте посилання IMDb або IMDb ID у форматі tt1234567."
    );
    return;
  }

  movieData.imdb_id = imdbId;

  const duplicateMovie = movies.find((movie) => {
    return (
      (
        movie.imdb_id === imdbId ||
        normalizeImdbIdFromUrl(movie.imdb_url) === imdbId
      ) &&
      movie.id !== editingMovieId
    );
  });

  if (duplicateMovie) {
    alert("Такий фільм вже додано до списку.");
    return;
  }

  console.log("Creating new movie");

  let movieId = null;

  const existingMetadataMovie =
    await findExistingMovieMetadataByImdbId(imdbId);

  if (existingMetadataMovie) {
    movieId = existingMetadataMovie.id;
  } else {
    const lookupResponse = await fetch(
      `/.netlify/functions/movie-lookup?imdbId=${imdbId}`
    );

    const lookupData = await lookupResponse.json();

    if (!lookupResponse.ok) {
      alert("Помилка IMDb/TMDb пошуку: " + (lookupData.error || lookupResponse.status));
      return;
    }

    const movieInsertData = {
      title: lookupData.title || movieData.title || "Без назви",
      year: lookupData.year ? Number(lookupData.year) : movieData.year,
      imdb_id: imdbId,
      imdb_url: movieData.imdb_url,
      poster_url: lookupData.poster_url || null,
      notes: lookupData.overview || null,
    };

    const { data: createdMovies, error: movieInsertError } = await supabaseClient
      .from("movies")
      .insert([movieInsertData])
      .select();

    if (movieInsertError) {
      console.error("Movie insert error:", movieInsertError);

      alert(
        "Помилка додавання фільму\n\n" +
        "Code: " + (movieInsertError.code || "N/A") + "\n" +
        "Message: " + movieInsertError.message + "\n" +
        "Details: " + (movieInsertError.details || "No details")
      );

      return;
    }

    const createdMovie = createdMovies?.[0];

    if (!createdMovie) {
      alert("Фільм створено, але не отримано movie id.");
      return;
    }

    movieId = createdMovie.id;
  }

  const listInsertData = {
    ...getMovieGroupListData(movieData),
    movie_id: movieId,
    group_id: currentGroupId,
  };

  const { error: listInsertError } = await supabaseClient
    .from("movie_group_lists")
    .insert([listInsertData]);

  if (listInsertError) {
    if (listInsertError.code === "23505") {
      alert("Цей фільм вже є у поточному списку.");
      return;
    }

    alert(
      "Фільм створено, але не додано до списку\n\n" +
      "Code: " + (listInsertError.code || "N/A") + "\n" +
      "Message: " + listInsertError.message + "\n" +
      "Details: " + (listInsertError.details || "No details")
    );

    return;
  }

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
    .from("movie_group_lists")
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
  };

  if (
    !movie.owned_medium &&
    movie.recommended_medium &&
    movie.recommended_medium !== "Наразі недоступний"
  ) {
    updateData.owned_medium = movie.recommended_medium;
  }

  const { error } = await supabaseClient
    .from("movie_group_lists")
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

function sortMoviesForDisplay(list) {
  return [...list].sort((a, b) => {
    if (activeFilter === "all") {
      const aWatched = a.status === "watched";
      const bWatched = b.status === "watched";

      if (aWatched !== bWatched) {
        return aWatched ? 1 : -1;
      }
    }

    const aRecommendations =
      movieRecommendationCounts[a.movie_id] || 0;

    const bRecommendations =
      movieRecommendationCounts[b.movie_id] || 0;

    if (aRecommendations !== bRecommendations) {
      return bRecommendations - aRecommendations;
    }

    const aDate = new Date(a.updated_at || a.created_at || 0).getTime();
    const bDate = new Date(b.updated_at || b.created_at || 0).getTime();

    return bDate - aDate;
  });
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

  const globalMatches = movies.filter((movie) => {
  const searchableText = [
    movie.title,
    movie.year,
    movie.recommended_medium,
    movie.owned_medium,
    movie.status,
    movie.notes,
    movie.added_by,
    movie.imdb_id,
    movie.imdb_url,
  ]
    .join(" ")
    .toLowerCase();

  return searchableText.includes(query);
});

  const filtered = globalMatches.filter((movie) => {

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

    return matchesFilter;
  });

  if (query.length >= 2 && !imdbId) {
    pendingSearchQuery = searchInput.value.trim();
    showAddFormButton.textContent = "Шукати на IMDb";

    if (globalMatches.length === 0) {
      searchHint.textContent =
        "У ваших списках нічого не знайдено. Можна пошукати фільм на IMDb.";
      searchHint.className = "search-hint positive";
    } else if (activeFilter === "all" || filtered.length > 0) {
      const count = globalMatches.length;

      searchHint.textContent =
        `Знайдено ${count} ${formatMovieCountWord(count)} у ваших списках. Можна також пошукати на IMDb.`;
      searchHint.className = "search-hint positive";
    }
  }

  if (
    filtered.length === 0 &&
    globalMatches.length > 0 &&
    activeFilter !== "all"
  ) {
    if (globalMatches.length === 1) {
      searchHint.textContent =
        `Фільм знайдено у списку «${formatStatusTitle(globalMatches[0].status)}».`;
    } else {
      const count = globalMatches.length;

      searchHint.textContent =
        `Знайдено ${count} ${formatMovieCountWord(count)} в інших списках.`;
    }

    searchHint.className = "search-hint warning";
  }

  renderMovies(sortMoviesForDisplay(filtered));
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

  return row;
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
  document
    .querySelectorAll("#mykolaFollowUpActions")
    .forEach((item) => item.remove());

  const row = document.createElement("div");
  row.className = "mykola-actions";
  row.id = "mykolaFollowUpActions";

  row.innerHTML = `
    <button type="button" data-mykola-action="another">
      Порадь ще
    </button>

    <button type="button" data-mykola-action="thanks">
      Дякую, хороший смак
    </button>
  `;
  
  const actions = document.getElementById("mykolaActions");
  mykolaChat.insertBefore(row, actions);

  scrollMykolaChatToBottom();

  const anotherButton = row.querySelector('[data-mykola-action="another"]');
  const thanksButton = row.querySelector('[data-mykola-action="thanks"]');

  anotherButton.addEventListener("click", () => {
    row.remove();

    addUserBubble("Порадь ще");

    runWithMykolaThinking(() => {
      addMykolaBubble(getRandomItem(mykolaAnotherReplies));

      runWithMykolaThinking(() => {
        recommendMykolaMovie();
      }, 2200);
    }, 1600);
  });

  thanksButton.addEventListener("click", () => {
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
        addMykolaBubble(getRandomItem(mykolaThankYouReplies));
        finishMykolaConversation();
      }
    }, 1800);
  });
}

function resetMykolaChat() {
  mykolaMode = "main";
  savedMainMykolaChatHtml = null;
  
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

function saveMainMykolaContext() {
  if (mykolaMode !== "main") return;
  savedMainMykolaChatHtml = mykolaChat.innerHTML;
}

function openMykolaView() {
  mykolaMode = "main";
  mainView.classList.remove("active");
  groupSettingsView.classList.remove("active");
  groupFormView.classList.remove("active");

  if (savedMainMykolaChatHtml) {
    mykolaChat.innerHTML = savedMainMykolaChatHtml;

    if (document.getElementById("mykolaYesButton")) {
      wireMykolaActionButtons();
    }
  }

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

backFromMykolaButton.addEventListener("click", async () => {
  await leaveActiveAdviceRoom();

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

  if (!yesButton || !noButton || !actions) return;

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
  if (isRecommendationStackInteracting) return;

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

    if (pendingSearchQuery) {
    showAddFormButton.textContent = "Шукаю...";
    showAddFormButton.disabled = true;

    try {
      const response = await fetch(
        `/.netlify/functions/movie-search?query=${encodeURIComponent(pendingSearchQuery)}`
      );

      const data = await response.json();

      if (!response.ok) {
        alert("Помилка пошуку: " + (data.error || response.status));
        return;
      }

      imdbSearchResults = data.results || [];

      renderImdbSearchResults(imdbSearchResults);

      searchHint.textContent = "Знайдено на IMDb";
      searchHint.className = "search-hint positive";

      showAddFormButton.style.display = "none";
    } catch (error) {
      alert("Помилка запиту: " + error.message);
    } finally {
      showAddFormButton.disabled = false;
      showAddFormButton.textContent = "Додати";
    }

    return;
  }
  
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

      let movieId = null;

      const existingMetadataMovie =
        await findExistingMovieMetadataByImdbId(pendingImdbId);

      if (existingMetadataMovie) {
        movieId = existingMetadataMovie.id;
      } else {
        const movieInsertData = {
          title: data.title || "Без назви",
          year: data.year ? Number(data.year) : null,
          imdb_id: pendingImdbId,
          imdb_url: pendingImdbUrl,
          poster_url: data.poster_url || null,
          notes: data.overview || null,
        };

        const { data: createdMovies, error: movieInsertError } = await supabaseClient
          .from("movies")
          .insert([movieInsertData])
          .select();

        if (movieInsertError) {
          alert(
            "Помилка додавання фільму\n\n" +
            "Code: " + (movieInsertError.code || "N/A") + "\n" +
            "Message: " + movieInsertError.message + "\n" +
            "Details: " + (movieInsertError.details || "No details")
          );
          return;
        }

        const createdMovie = createdMovies?.[0];

        if (!createdMovie) {
          alert("Фільм створено, але не отримано movie id.");
          return;
        }

        movieId = createdMovie.id;
      }

      const listInsertData = {
        movie_id: movieId,
        group_id: currentGroupId,
        status: "wishlist",
        recommended_medium: null,
        owned_medium: null,
        purchase_url: null,
        added_by: addedBy,
        updated_at: new Date().toISOString(),
      };

      const { error: listInsertError } = await supabaseClient
        .from("movie_group_lists")
        .insert([listInsertData]);

      if (listInsertError) {
        if (listInsertError.code === "23505") {
          alert("Цей фільм вже є у поточному списку.");
          return;
        }

        alert(
          "Фільм створено, але не додано до списку\n\n" +
          "Code: " + (listInsertError.code || "N/A") + "\n" +
          "Message: " + listInsertError.message + "\n" +
          "Details: " + (listInsertError.details || "No details")
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

  const clickedInsideGroupSelector =
    event.target.closest(".group-selector-wrapper");

  if (!clickedInsideGroupSelector) {
    groupSelectorDropdown.style.display = "none";
  }

  const clickedInsideRecommendContext =
    event.target.closest(".recommend-count-wrapper");

  if (!clickedInsideRecommendContext) {
    document
      .querySelectorAll(".recommend-context-menu")
      .forEach((dropdown) => {
        dropdown.style.display = "none";
      });
    document.querySelectorAll(".card.has-open-context").forEach((card) => {
      card.classList.remove("has-open-context");
    });
  }

  groupInfoMenuDropdown.style.display = "none";
  document
  .querySelectorAll(".group-section-menu-dropdown")
  .forEach((dropdown) => {
    dropdown.style.display = "none";
  });

  document
  .querySelectorAll(".group-member-menu-dropdown")
  .forEach((dropdown) => {
    dropdown.style.display = "none";
  });

  const clickedInsideMyAdvice =
    event.target.closest(".my-advice-card") ||
    event.target.closest(".recommend-button");

  if (!clickedInsideMyAdvice) {
    document.querySelectorAll(".my-advice-card").forEach((card) => {
      card.remove();
    });

    document.querySelectorAll(".card.has-open-advice").forEach((card) => {
      card.classList.remove("has-open-advice");
    });
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
  showAppLoader();

  try {
    await updateAuthUI();
    await ensureUserMembership();
    
    if (!isAnonymous()) {
      await loadCurrentUserGroups();
    }
    
    await loadCurrentRole();

    if (!isAnonymous()) {
      await loadCurrentGroup();
      renderCurrentGroupInfo();
    }

    applyAccessLevel();

    if (!isAnonymous()) {
      await loadMovies();
    }
  } catch (error) {
    console.error("App initialization error:", error);
  } finally {
    appHasInitialized = true;
    hideAppLoader();
  }
}

wireMykolaActionButtons();

initApp();

supabaseClient.auth.onAuthStateChange(() => {
  if (appHasInitialized && !isLoggingOut) {
    initApp();
  }
});
