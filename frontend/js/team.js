// API и WebSocket базовые URL
if (typeof window.API_BASE_URL === 'undefined') {
  window.API_BASE_URL = "/api";
}
const WS_PROTOCOL = window.location.protocol === "https:" ? "wss" : "ws";
const WS_BASE_URL = `${WS_PROTOCOL}://${window.location.host}${window.API_BASE_URL}`;

// Глобальные переменные
let currentTeam = null;
let currentUser = null;
let chatWebSocket = null;
let memberToRemove = null;

// Инициализация страницы
document.addEventListener('DOMContentLoaded', async function() {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) {
      console.error('No access token found');
      window.location.href = 'auth.html';
      return;
    }
    
    console.log('Initializing team page...');
    
    // Получаем информацию о текущем пользователе
    await fetchCurrentUser();
    console.log('Current user:', currentUser);
    
    // Загружаем информацию о команде
    await loadTeamInfo();
    
    // Настраиваем обработчики событий
    setupEventListeners();
    
  } catch (error) {
    console.error('Error initializing team page:', error);
    showError('Ошибка загрузки страницы команды');
  }
});

// Получение информации о текущем пользователе
async function fetchCurrentUser() {
  try {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${window.API_BASE_URL}/users/me`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    if (response.ok) {
      currentUser = await response.json();
      console.log('User fetched successfully:', currentUser);
    } else {
      console.error('Failed to fetch user info:', response.status, response.statusText);
      throw new Error('Failed to fetch user info');
    }
  } catch (error) {
    console.error('Error fetching user info:', error);
    showError('Ошибка получения информации о пользователе');
    throw error;
  }
}

// Загрузка информации о команде
async function loadTeamInfo() {
  try {
    const token = localStorage.getItem('access_token');
    console.log('Fetching team info...');
    
    const response = await fetch(`${window.API_BASE_URL}/teams/my-team`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    console.log('Team info response status:', response.status);
    
    if (response.ok) {
      currentTeam = await response.json();
      console.log('Team info loaded:', currentTeam);
      displayTeamInfo();
      connectToChat();
    } else if (response.status === 404) {
      console.log('User is not in a team');
      // Пользователь не в команде
      showNoTeamMessage();
    } else {
      console.error('Failed to fetch team info:', response.status, response.statusText);
      const errorData = await response.text();
      console.error('Error response:', errorData);
      throw new Error('Failed to fetch team info');
    }
  } catch (error) {
    console.error('Error loading team info:', error);
    showNoTeamMessage();
  }
}

// Отображение информации об отсутствии команды
function showNoTeamMessage() {
  console.log('Showing no team message');
  const noTeamMessage = document.getElementById('no-team-message');
  const teamContent = document.getElementById('team-content');
  
  if (noTeamMessage && teamContent) {
    noTeamMessage.style.display = 'block';
    teamContent.style.display = 'none';
  } else {
    console.error('No team message or team content elements not found');
  }
}

// Отображение информации о команде
function displayTeamInfo() {
  console.log('Displaying team info:', currentTeam);
  
  const noTeamMessage = document.getElementById('no-team-message');
  const teamContent = document.getElementById('team-content');
  
  if (noTeamMessage && teamContent) {
    noTeamMessage.style.display = 'none';
    teamContent.style.display = 'block';
  }
  
  // Название команды
  const teamNameValue = document.getElementById('team-name-value');
  if (teamNameValue) {
    teamNameValue.textContent = currentTeam.name || 'Без названия';
  }
  
  // Информация о команде
  const teamInfoValue = document.getElementById('team-info-value');
  if (teamInfoValue) {
    teamInfoValue.textContent = currentTeam.information || 'Нет описания';
  }
  
  // Участники команды
  displayTeamMembers();
  
  // Информация о боссе
  displayBossInfo();
  
  // Показываем кнопки управления в зависимости от роли
  const ownerActions = document.getElementById('owner-actions');
  const memberActions = document.getElementById('member-actions');
  const addMemberBtn = document.getElementById('add-member-btn');
  const editTeamNameBtn = document.getElementById('edit-team-name-btn');
  const editTeamInfoBtn = document.getElementById('edit-team-info-btn');
  
  if (currentTeam.owner_id === currentUser.user_id) {
    // Пользователь - владелец
    if (ownerActions) ownerActions.style.display = 'block';
    if (memberActions) memberActions.style.display = 'none';
    if (addMemberBtn) addMemberBtn.style.display = 'block';
    if (editTeamNameBtn) editTeamNameBtn.style.display = 'inline';
    if (editTeamInfoBtn) editTeamInfoBtn.style.display = 'inline';
    console.log('User is team owner');
  } else {
    // Пользователь - обычный участник
    if (ownerActions) ownerActions.style.display = 'none';
    if (memberActions) memberActions.style.display = 'block';
    if (addMemberBtn) addMemberBtn.style.display = 'none';
    if (editTeamNameBtn) editTeamNameBtn.style.display = 'none';
    if (editTeamInfoBtn) editTeamInfoBtn.style.display = 'none';
    console.log('User is team member');
  }
  
  // Загружаем историю чата
  loadChatHistory();
}

// Отображение участников команды
function displayTeamMembers() {
  const membersList = document.getElementById('team-members-list');
  if (!membersList) {
    console.error('Team members list element not found');
    return;
  }
  
  membersList.innerHTML = '';
  
  if (!currentTeam.members || currentTeam.members.length === 0) {
    console.warn('No team members found');
    return;
  }
  
  currentTeam.members.forEach(member => {
    const li = document.createElement('li');
    li.className = member.user_id === currentTeam.owner_id ? 'owner' : '';
    
    const memberSpan = document.createElement('span');
    memberSpan.className = 'members' + (member.user_id === currentTeam.owner_id ? ' owner' : '');
    memberSpan.textContent = member.nickname + (member.user_id === currentTeam.owner_id ? ' (владелец)' : '');
    
    li.appendChild(memberSpan);
    
    // Кнопка удаления для владельца (кроме самого себя)
    if (currentTeam.owner_id === currentUser.user_id && member.user_id !== currentUser.user_id) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'delete-member-btn';
      removeBtn.textContent = '-';
      removeBtn.onclick = () => showRemoveMemberModal(member);
      li.appendChild(removeBtn);
    }
    
    membersList.appendChild(li);
  });
  
  console.log('Team members displayed:', currentTeam.members.length);
}

// Отображение информации о боссе
function displayBossInfo() {
  const bossSection = document.getElementById('boss-section');
  const noBossMessage = document.getElementById('no-boss-message');
  const bossInfo = document.getElementById('boss-info');
  
  if (!bossSection || !noBossMessage || !bossInfo) {
    console.error('Boss info elements not found');
    return;
  }
  
  if (!currentTeam.boss || !currentTeam.members || currentTeam.members.length < 2) {
    console.log('No boss or insufficient team members');
    noBossMessage.style.display = 'block';
    bossInfo.style.display = 'none';
  } else {
    noBossMessage.style.display = 'none';
    bossInfo.style.display = 'block';
    
    const boss = currentTeam.boss;
    
    // Название босса
    const bossName = document.getElementById('boss-name');
    if (bossName) bossName.textContent = boss.name || 'Неизвестный босс';
    
    // Уровень босса
    const bossLevel = document.getElementById('boss-level');
    if (bossLevel) bossLevel.textContent = `уровень ${boss.level || '?'}`;
    
    // Описание босса
    const bossDescription = document.getElementById('boss-description');
    if (bossDescription) bossDescription.textContent = `"${boss.information || 'Нет описания'}"`;
    
    // HP босса
    const currentHp = currentTeam.boss_lives || 0;
    const maxHp = boss.base_lives || 1;
    const hpPercentage = Math.max(0, (currentHp / maxHp) * 100);
    
    const bossHpText = document.getElementById('boss-hp-text');
    if (bossHpText) bossHpText.textContent = `${currentHp}/${maxHp}`;
    
    const bossHpBar = document.getElementById('boss-hp-bar');
    if (bossHpBar) bossHpBar.style.width = `${hpPercentage}%`;
    
    // Изображение босса
    const bossImage = document.getElementById('boss-image');
    if (bossImage) {
      if (boss.img_url) {
        bossImage.innerHTML = `<img src="${boss.img_url}" alt="${boss.name}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
      } else {
        bossImage.textContent = 'Изображение монстра';
      }
    }
    
    console.log('Boss info displayed:', boss.name);
  }
}

// Настройка обработчиков событий
function setupEventListeners() {
  // Enter в чате
  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
  }
  
  // Закрытие модальных окон при клике вне их
  window.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
      event.target.style.display = 'none';
    }
  });
}

// Подключение к чату через WebSocket
function connectToChat() {
  if (!currentTeam) {
    console.error('Cannot connect to chat: no current team');
    return;
  }
  
  const token = localStorage.getItem('access_token');
  const wsUrl = `${WS_BASE_URL}/ws/team-chat/${currentTeam.team_id}/${token}`;
  
  console.log('Connecting to chat WebSocket:', wsUrl);
  
  chatWebSocket = new WebSocket(wsUrl);
  
  chatWebSocket.onopen = function() {
    console.log('Connected to team chat');
  };
  
  chatWebSocket.onmessage = function(event) {
    addMessageToChat(event.data);
  };
  
  chatWebSocket.onclose = function() {
    console.log('Disconnected from team chat');
    // Попытка переподключения через 5 секунд
    setTimeout(() => {
      if (currentTeam) {
        connectToChat();
      }
    }, 5000);
  };
  
  chatWebSocket.onerror = function(error) {
    console.error('Chat WebSocket error:', error);
  };
}

// Загрузка истории чата
async function loadChatHistory() {
  if (!currentTeam) {
    console.error('Cannot load chat history: no current team');
    return;
  }
  
  try {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${window.API_BASE_URL}/teams/${currentTeam.team_id}/chat`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    if (response.ok) {
      const messages = await response.json();
      const chatBox = document.getElementById('chat-messages');
      if (chatBox) {
        chatBox.innerHTML = '';
        
        messages.forEach(message => {
          const messageText = `${message.user.nickname}: ${message.message}`;
          addMessageToChat(messageText);
        });
        
        console.log('Chat history loaded:', messages.length, 'messages');
      }
    } else {
      console.error('Failed to load chat history:', response.status);
    }
  } catch (error) {
    console.error('Error loading chat history:', error);
  }
}

// Добавление сообщения в чат
function addMessageToChat(message) {
  const chatBox = document.getElementById('chat-messages');
  if (chatBox) {
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    messageElement.style.marginBottom = '5px';
    messageElement.style.padding = '5px';
    messageElement.style.borderRadius = '4px';
    messageElement.style.backgroundColor = 'rgba(0,0,0,0.05)';
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
  }
}

// Отправка сообщения в чат
function sendMessage() {
  const input = document.getElementById('chat-input');
  if (!input) return;
  
  const message = input.value.trim();
  
  if (message && chatWebSocket && chatWebSocket.readyState === WebSocket.OPEN) {
    chatWebSocket.send(message);
    input.value = '';
  } else if (message) {
    console.error('Cannot send message: WebSocket not connected');
  }
}

// Атака босса
async function attackBoss() {
  if (!currentTeam) {
    showError('Ошибка: информация о команде не загружена');
    return;
  }
  
  try {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${window.API_BASE_URL}/teams/${currentTeam.team_id}/attack-boss`, {
      method: 'POST',
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    if (response.ok) {
      const result = await response.json();
      
      // Показываем результат атаки
      const attackLog = document.getElementById('attack-log');
      if (attackLog) {
        const logEntry = document.createElement('div');
        logEntry.textContent = result.message;
        logEntry.style.marginTop = '10px';
        logEntry.style.padding = '5px';
        logEntry.style.backgroundColor = 'rgba(255,255,255,0.1)';
        logEntry.style.borderRadius = '4px';
        
        attackLog.appendChild(logEntry);
      }
      
      // Обновляем информацию о команде
      await loadTeamInfo();
      
      // Если босс побежден, показываем награду
      if (result.boss_defeated && result.rewards_granted) {
        showSuccess(`Босс побежден! Все участники команды получили ${result.rewards_granted.gold} золота!`);
      }
      
    } else {
      const error = await response.json();
      showError(error.detail || 'Ошибка атаки босса');
    }
  } catch (error) {
    console.error('Error attacking boss:', error);
    showError('Ошибка при атаке босса');
  }
}

// Модальные окна
function showCreateTeamModal() {
  const modal = document.getElementById('createTeamModal');
  if (modal) {
    modal.style.display = 'flex';
    const nameInput = document.getElementById('create-team-name');
    if (nameInput) nameInput.focus();
  }
}

function showJoinTeamModal() {
  const modal = document.getElementById('joinTeamModal');
  if (modal) {
    modal.style.display = 'flex';
    const nameInput = document.getElementById('join-team-name');
    if (nameInput) nameInput.focus();
  }
}

function showAddMemberModal() {
  const modal = document.getElementById('addMemberModal');
  if (modal) {
    modal.style.display = 'flex';
    const nicknameInput = document.getElementById('add-member-nickname');
    if (nicknameInput) nicknameInput.focus();
  }
}

function showRemoveMemberModal(member) {
  memberToRemove = member;
  const modal = document.getElementById('removeMemberModal');
  const text = document.getElementById('remove-member-text');
  
  if (text) {
    text.textContent = `Вы уверены, что хотите удалить ${member.nickname} из команды?`;
  }
  
  if (modal) {
    modal.style.display = 'flex';
  }
}

function showDeleteTeamModal() {
  const modal = document.getElementById('deleteTeamModal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
  }
  
  // Очищаем поля ввода
  const inputs = document.querySelectorAll(`#${modalId} input, #${modalId} textarea`);
  inputs.forEach(input => input.value = '');
  
  // Сброс переменной для удаления участника
  if (modalId === 'removeMemberModal') {
    memberToRemove = null;
  }
}

// Создание команды
async function createTeam() {
  const nameInput = document.getElementById('create-team-name');
  const infoInput = document.getElementById('create-team-info');
  
  if (!nameInput) {
    showError('Элемент ввода названия команды не найден');
    return;
  }
  
  const name = nameInput.value.trim();
  const information = infoInput ? infoInput.value.trim() : '';
  
  if (!name) {
    showError('Введите название команды');
    return;
  }
  
  try {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${window.API_BASE_URL}/teams`, {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name, information: information || null })
    });
    
    if (response.ok) {
      closeModal('createTeamModal');
      showSuccess('Команда успешно создана!');
      await loadTeamInfo();
    } else {
      const error = await response.json();
      showError(error.detail || 'Ошибка создания команды');
    }
  } catch (error) {
    console.error('Error creating team:', error);
    showError('Ошибка при создании команды');
  }
}

// Присоединение к команде
async function joinTeam() {
  const nameInput = document.getElementById('join-team-name');
  
  if (!nameInput) {
    showError('Элемент ввода названия команды не найден');
    return;
  }
  
  const teamName = nameInput.value.trim();
  
  if (!teamName) {
    showError('Введите название команды');
    return;
  }
  
  try {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${window.API_BASE_URL}/teams/join`, {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ team_name: teamName })
    });
    
    if (response.ok) {
      closeModal('joinTeamModal');
      showSuccess('Вы успешно присоединились к команде!');
      await loadTeamInfo();
    } else {
      const error = await response.json();
      showError(error.detail || 'Ошибка присоединения к команде');
    }
  } catch (error) {
    console.error('Error joining team:', error);
    showError('Ошибка при присоединении к команде');
  }
}

// Покинуть команду
async function leaveTeam() {
  if (!confirm('Вы уверены, что хотите покинуть команду?')) {
    return;
  }
  
  if (!currentTeam) {
    showError('Ошибка: информация о команде не загружена');
    return;
  }
  
  try {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${window.API_BASE_URL}/teams/${currentTeam.team_id}/leave`, {
      method: 'POST',
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    if (response.ok) {
      showSuccess('Вы покинули команду');
      
      // Закрываем WebSocket соединение
      if (chatWebSocket) {
        chatWebSocket.close();
        chatWebSocket = null;
      }
      
      currentTeam = null;
      showNoTeamMessage();
    } else {
      const error = await response.json();
      showError(error.detail || 'Ошибка при выходе из команды');
    }
  } catch (error) {
    console.error('Error leaving team:', error);
    showError('Ошибка при выходе из команды');
  }
}

// Удаление команды
async function deleteTeam() {
  if (!currentTeam) {
    showError('Ошибка: информация о команде не загружена');
    return;
  }
  
  try {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${window.API_BASE_URL}/teams/${currentTeam.team_id}`, {
      method: 'DELETE',
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    if (response.ok) {
      closeModal('deleteTeamModal');
      showSuccess('Команда удалена');
      
      // Закрываем WebSocket соединение
      if (chatWebSocket) {
        chatWebSocket.close();
        chatWebSocket = null;
      }
      
      currentTeam = null;
      showNoTeamMessage();
    } else {
      const error = await response.json();
      showError(error.detail || 'Ошибка удаления команды');
    }
  } catch (error) {
    console.error('Error deleting team:', error);
    showError('Ошибка при удалении команды');
  }
}

// Добавление участника
async function addMember() {
  const nicknameInput = document.getElementById('add-member-nickname');
  
  if (!nicknameInput) {
    showError('Элемент ввода никнейма не найден');
    return;
  }
  
  const nickname = nicknameInput.value.trim();
  
  if (!nickname) {
    showError('Введите никнейм участника');
    return;
  }
  
  if (!currentTeam) {
    showError('Ошибка: информация о команде не загружена');
    return;
  }
  
  try {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${window.API_BASE_URL}/teams/${currentTeam.team_id}/add-member`, {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ nickname })
    });
    
    if (response.ok) {
      closeModal('addMemberModal');
      showSuccess(`Участник ${nickname} добавлен в команду!`);
      await loadTeamInfo();
    } else {
      const error = await response.json();
      showError(error.detail || 'Ошибка добавления участника');
    }
  } catch (error) {
    console.error('Error adding member:', error);
    showError('Ошибка при добавлении участника');
  }
}

// Подтверждение удаления участника
async function confirmRemoveMember() {
  if (!memberToRemove || !currentTeam) {
    showError('Ошибка: данные не загружены');
    return;
  }
  
  try {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${window.API_BASE_URL}/teams/${currentTeam.team_id}/remove-member`, {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ user_id: memberToRemove.user_id })
    });
    
    if (response.ok) {
      closeModal('removeMemberModal');
      showSuccess(`Участник ${memberToRemove.nickname} удален из команды`);
      await loadTeamInfo();
    } else {
      const error = await response.json();
      showError(error.detail || 'Ошибка удаления участника');
    }
  } catch (error) {
    console.error('Error removing member:', error);
    showError('Ошибка при удалении участника');
  }
}

// Редактирование названия команды
function editTeamName() {
  if (!currentTeam) {
    showError('Ошибка: информация о команде не загружена');
    return;
  }
  
  const input = document.getElementById('edit-team-name-input');
  const modal = document.getElementById('editTeamNameModal');
  
  if (input && modal) {
    input.value = currentTeam.name;
    modal.style.display = 'flex';
    input.focus();
  }
}

async function saveTeamName() {
  const input = document.getElementById('edit-team-name-input');
  
  if (!input) {
    showError('Элемент ввода названия не найден');
    return;
  }
  
  const newName = input.value.trim();
  
  if (!newName) {
    showError('Введите название команды');
    return;
  }
  
  if (!currentTeam || newName === currentTeam.name) {
    closeModal('editTeamNameModal');
    return;
  }
  
  try {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${window.API_BASE_URL}/teams/${currentTeam.team_id}`, {
      method: 'PUT',
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: newName })
    });
    
    if (response.ok) {
      closeModal('editTeamNameModal');
      showSuccess('Название команды изменено');
      await loadTeamInfo();
    } else {
      const error = await response.json();
      showError(error.detail || 'Ошибка изменения названия');
    }
  } catch (error) {
    console.error('Error updating team name:', error);
    showError('Ошибка при изменении названия');
  }
}

// Редактирование информации о команде
function editTeamInfo() {
  if (!currentTeam) {
    showError('Ошибка: информация о команде не загружена');
    return;
  }
  
  const input = document.getElementById('edit-team-info-input');
  const modal = document.getElementById('editTeamInfoModal');
  
  if (input && modal) {
    input.value = currentTeam.information || '';
    modal.style.display = 'flex';
    input.focus();
  }
}

async function saveTeamInfo() {
  const input = document.getElementById('edit-team-info-input');
  
  if (!input) {
    showError('Элемент ввода информации не найден');
    return;
  }
  
  const newInfo = input.value.trim();
  
  if (!currentTeam || newInfo === (currentTeam.information || '')) {
    closeModal('editTeamInfoModal');
    return;
  }
  
  try {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${window.API_BASE_URL}/teams/${currentTeam.team_id}`, {
      method: 'PUT',
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ information: newInfo || null })
    });
    
    if (response.ok) {
      closeModal('editTeamInfoModal');
      showSuccess('Информация о команде изменена');
      await loadTeamInfo();
    } else {
      const error = await response.json();
      showError(error.detail || 'Ошибка изменения информации');
    }
  } catch (error) {
    console.error('Error updating team info:', error);
    showError('Ошибка при изменении информации');
  }
}

// Утилиты для показа сообщений
function showError(message) {
  console.error('Error:', message);
  alert('Ошибка: ' + message);
}

function showSuccess(message) {
  console.log('Success:', message);
  alert(message);
}

// Очистка при выходе со страницы
window.addEventListener('beforeunload', function() {
  if (chatWebSocket) {
    chatWebSocket.close();
  }
});