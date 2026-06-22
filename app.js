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
let appHasInitialized = false;
let pendingInviteRole = null;
let isLoggingOut = false;

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

async function loadCurrentUserRecommendations() {
  if (!currentUser) {
    currentUserRecommendations = [];
    return;
  }

  const { data, error } = await supabaseClient
    .from("recommendations")
    .select("id, movie_id, comment")
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

      const commentIcon = item.comment
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
        Рекомендують
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
        Всі поради <span class="mykola-hint-arrow">→</span>
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
                  ? "Я рекомендую"
                  : "Рекомендувати"
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
                      (movieRecommendationDetails[movie.movie_id] || []).some((item) => item.comment)
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
  comment = null
) {
  if (!currentUser) {
    alert("Потрібно увійти в акаунт.");
    return;
  }

  if (!currentGroupId) {
    alert("Поточну групу не визначено.");
    return;
  }

  if (hasCurrentUserRecommended(movieId)) {
    return;
  }

  button.disabled = true;
  button.classList.add("recommended");
  // button.querySelector(".recommend-heart").textContent = "♥";
  button.querySelector(".recommend-text").textContent = "Я рекомендую";

button.classList.toggle("has-comment", !!comment);

  const { data, error } = await supabaseClient
    .from("recommendations")
    .insert({
      movie_id: movieId,
      user_id: currentUser.id,
      context_group_id: currentGroupId,
      comment,
    })
    .select("id, movie_id, comment")
    .single();

  if (error) {
    button.disabled = false;
    button.classList.remove("recommended");
    button.classList.remove("has-comment");
    // button.querySelector(".recommend-heart").textContent = "♡";
    button.querySelector(".recommend-text").textContent = "Рекомендувати";

    if (error.code === "23505") {
      await loadCurrentUserRecommendations();
      await loadMovieRecommendationCounts();
      await loadMovieRecommendationDetails();
      applyMykolaDailyRecommendation();
      applySearchAndFilters();
      return;
    }

    alert(
      "Помилка збереження рекомендації\n\n" +
      "Message: " + error.message
    );
    return;
  }

  currentUserRecommendations.push(data);

  button.querySelector(".recommend-text").textContent = "Я рекомендую";
  button.disabled = false;

  await loadMovieRecommendationCounts();
  await loadMovieRecommendationDetails();
  applyMykolaDailyRecommendation();
  applySearchAndFilters();
}

function resetMykolaRecommendationFlow() {
  mykolaChat.innerHTML = `
    <div class="mykola-actions" id="mykolaActions"></div>
  `;
}

function openMykolaContextView() {
  mainView.classList.remove("active");
  groupSettingsView.classList.remove("active");
  groupFormView.classList.remove("active");

  mykolaView.classList.add("active");

  window.scrollTo({
    top: mykolaView.offsetTop - 20,
    behavior: "smooth",
  });
}

function openMykolaRecommendationFlow(movieId, button) {
  const movie = movies.find((item) => item.movie_id === movieId);

  if (!movie) {
    alert("Фільм не знайдено.");
    return;
  }

  openMykolaContextView();

  resetMykolaRecommendationFlow();

  addUserBubble(`Рекомендую: ${movie.title}`);

  runWithMykolaThinking(() => {
    addMykolaBubble(getRandomItem(mykolaRecommendationAcceptReplies));
    addMykolaRecommendationActions(movieId, button);
  }, 1400);

}

const mykolaRecommendationAcceptReplies = [
  "Зрозуміло. Зафіксуємо вашу рекомендацію в картотеці. Додасте пару слів для інших?",
  "Прийнято. Рекомендацію внесемо до картотеки. Після погодження кафедрою, звичайно. Залишите короткий коментар для інших?",
  "Добре. Картотека поповнюється. Додасте кілька слів, щоб інші розуміли, чому фільм варто переглянути?",
  "Зафіксовано майже офіційно. Бракує лише вашого короткого пояснення. Додасте пару слів?",
];

function addMykolaRecommendationActions(movieId, button) {
  const row = document.createElement("div");
  row.className = "mykola-actions";
  row.id = "mykolaRecommendationActions";

  row.innerHTML = `
    <button id="mykolaAddCommentButton" type="button">
      Так
    </button>

    <button id="mykolaSkipCommentButton" type="button">
      Ні, пізніше
    </button>
  `;

  const actions = document.getElementById("mykolaActions");
  mykolaChat.insertBefore(row, actions);

  scrollMykolaChatToBottom();

  document
    .getElementById("mykolaSkipCommentButton")
    .addEventListener("click", async () => {
      row.remove();

      addUserBubble("Ні, пізніше");

      await recommendMovie(movieId, button);

      runWithMykolaThinking(() => {
        addMykolaBubble("Зафіксовано. Можете повертатись до списку.");
      }, 900);
    });

  document
    .getElementById("mykolaAddCommentButton")
    .addEventListener("click", () => {
      row.remove();

      addUserBubble("Так");

      showMykolaRecommendationCommentForm(movieId, button);
    });
}

function showMykolaRecommendationCommentForm(movieId, button) {
  const row = document.createElement("div");
  row.className = "mykola-message-row";
  row.id = "mykolaRecommendationCommentForm";

  row.innerHTML = `
    <div class="mykola-avatar">М</div>

    <div class="mykola-bubble mykola-comment-form-bubble">
      <textarea
        id="mykolaRecommendationCommentInput"
        placeholder="Кілька слів для інших..."
      ></textarea>

      <div class="mykola-comment-form-actions">
        <button id="mykolaSaveCommentButton" type="button">
          Зберегти
        </button>

        <button id="mykolaCancelCommentButton" type="button">
          Без коментаря
        </button>
      </div>
    </div>
  `;

  const actions = document.getElementById("mykolaActions");
  mykolaChat.insertBefore(row, actions);

  scrollMykolaChatToBottom();

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

      await recommendMovie(movieId, button, comment);

      row.remove();

      runWithMykolaThinking(() => {
        addMykolaBubble("Занотував. Тепер це вже не просто рекомендація, а майже джерело.");
      }, 900);
    });

  document
    .getElementById("mykolaCancelCommentButton")
    .addEventListener("click", async () => {
      await recommendMovie(movieId, button);

      row.remove();

      runWithMykolaThinking(() => {
        addMykolaBubble("Добре. Зафіксуємо без додаткових приміток.");
      }, 900);
    });
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

  openMykolaContextView();

  resetMykolaRecommendationFlow();

  addUserBubble(`Покажи всі поради: ${movie.title}`);

  runWithMykolaThinking(() => {
    addMykolaBubble("Дістаю картку з картотеки. Тут є що почитати.");

    setTimeout(() => {
      addMykolaMovieBubble(movie);
      addMykolaRecommendationCards(recommendations);
    }, 350);
  }, 1000);

}

function addMykolaRecommendationCards(recommendations) {
  const humanRecommendations = recommendations.filter((item) => {
    return !item.is_mykola;
  });

  if (!humanRecommendations.length) {
    addMykolaBubble("Порожньо. Картотека мовчить.");
    return;
  }

  const sortedItems = [...humanRecommendations].sort((a, b) => {
    const aHasComment = !!a.comment;
    const bHasComment = !!b.comment;

    if (aHasComment !== bHasComment) {
      return aHasComment ? -1 : 1;
    }

    return getRecommendationPriority(a) - getRecommendationPriority(b);
  });

  sortedItems.forEach((item) => {
    addMykolaRecommendationCard(item);
  });

  runWithMykolaThinking(() => {
    addMykolaBubble("На цьому доказова база закінчується. Робіть висновки.");
  }, 900);
}

function addMykolaRecommendationCard(item) {
  const name =
    item.profiles?.display_name ||
    item.profiles?.email ||
    "Користувач";

  const groupName = item.groups?.name
    ? `${getGroupTypeNominativeLabel(item.groups.type)} ${item.groups.name}`
    : "Група не вказана";

  const comment =
    item.comment ||
    "Без коментаря. Лаконічно, але підозріло.";

  addMykolaBubble(`
    <strong>${escapeHtml(name)}</strong><br>
    <span style="color:#aaa;font-size:12px;">
      ${escapeHtml(groupName)}
    </span><br><br>
    ${escapeHtml(comment)}
  `);
}

async function unrecommendMovie(movieId, button) {
  if (!currentUser) {
    return;
  }

  const recommendation = currentUserRecommendations.find((item) => {
    return item.movie_id === movieId;
  });

  if (!recommendation) {
    return;
  }

  button.disabled = true;

  const { error } = await supabaseClient
    .from("recommendations")
    .delete()
    .eq("id", recommendation.id);

  if (error) {
    button.disabled = false;

    alert(
      "Помилка відкликання рекомендації\n\n" +
      "Message: " + error.message
    );

    return;
  }

  currentUserRecommendations =
    currentUserRecommendations.filter((item) => {
      return item.id !== recommendation.id;
    });

  button.classList.remove("recommended");
  button.classList.remove("has-comment");
  button.querySelector(".recommend-text").textContent = "Рекомендувати";

  button.disabled = false;

  await loadMovieRecommendationCounts();
  await loadMovieRecommendationDetails();
  applyMykolaDailyRecommendation();
  applySearchAndFilters();
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
    await unrecommendMovie(movieId, button);
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
});

moviesGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open-mykola-context]");

  if (!button) return;

  event.stopPropagation();

  const movieId = button.dataset.openMykolaContext;

  openMykolaRecommendationContext(movieId);
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
  groupSettingsView.classList.remove("active");
  groupFormView.classList.remove("active");

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
