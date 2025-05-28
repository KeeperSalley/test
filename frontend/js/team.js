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
      window.location.href = 'auth.html';
      return;
    }
    
    // Получаем информацию о текущем пользователе
    await fetchCurrentUser();
    
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
    } else {
      throw new Error('Failed to fetch user info');
    }
  } catch (error) {
    console.error('Error fetching user info:', error);
    showError('Ошибка получения информации о пользователе');
  }
}

// Загрузка информации о команде
async function loadTeamInfo() {
  try {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${window.API_BASE_URL}/teams/my-team`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    if (response.ok) {
      currentTeam = await response.json();
      displayTeamInfo();
      connectToChat();
    } else if (response.status === 404) {
      // Пользователь не в команде
      showNoTeamMessage();
    } else {
      throw new Error('Failed to fetch team info');
    }
  } catch (error) {
    console.error('Error loading team info:', error);
    showNoTeamMessage();
  }
}

// Отображение информации об отсутствии команды
function showNoTeamMessage() {
  document.getElementById('no-team-message').style.display = 'block';
  document.getElementById('team-content').style.display = 'none';
}

// Отображение информации о команде
function displayTeamInfo() {
  document.getElementById('no-team-message').style.display = 'none';
  document.getElementById('team-content').style.display = 'block';
  
  // Название команды
  document.getElementById('team-name-value').textContent = currentTeam.name;
  
  // Информация о команде
  document.getElementById('team-info-value').textContent = currentTeam.information || 'Нет описания';
  
  // Участники команды
  displayTeamMembers();
  
  // Информация о боссе
  displayBossInfo();
  
  // Показываем кнопки управления в зависимости от роли
  if (currentTeam.owner_id === currentUser.user_id) {
    // Пользователь - владелец
    document.getElementById('owner-actions').style.display = 'block';
    document.getElementById('member-actions').style.display = 'none';
    document.getElementById('add-member-btn').style.display = 'block';
    document.getElementById('edit-team-name-btn').style.display = 'inline';
    document.getElementById('edit-team-info-btn').style.display = 'inline';
  } else {
    // Пользователь - обычный участник
    document.getElementById('owner-actions').style.display = 'none';
    document.getElementById('member-actions').style.display = 'block';
    document.getElementById('add-member-btn').style.display = 'none';
    document.getElementById('edit-team-name-btn').style.display = 'none';
    document.getElementById('edit-team-info-btn').style.display = 'none';
  }
  
  // Загружаем историю чата
  loadChatHistory();
}

// Отображение участников команды
function displayTeamMembers() {
  const membersList = document.getElementById('team-members-list');
  membersList.innerHTML = '';
  
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
}

// Отображение информации о боссе
function displayBossInfo() {
  const bossSection = document.getElementById('boss-section');
  const noBossMessage = document.getElementById('no-boss-message');
  const bossInfo = document.getElementById('boss-info');
  
  if (!currentTeam.boss || currentTeam.members.length < 2) {
    noBossMessage.style.display = 'block';
    bossInfo.style.display = 'none';
  } else {
    noBossMessage.style.display = 'none';
    bossInfo.style.display = 'block';
    
    const boss = currentTeam.boss;
    document.getElementById('boss-name').textContent = boss.name;
    document.getElementById('boss-level').textContent = `уровень ${boss.level}`;
    document.getElementById('boss-description').textContent = `"${boss.information}"`;
    
    // HP босса
    const currentHp = currentTeam.boss_lives;
    const maxHp = boss.base_lives;
    const hpPercentage = Math.max(0, (currentHp / maxHp) * 100);
    
    document.getElementById('boss-hp-text').textContent = `${currentHp}/${maxHp}`;
    document.getElementById('boss-hp-bar').style.width = `${hpPercentage}%`;
    
    // Изображение босса
    const bossImage = document.getElementById('boss-image');
    if (boss.img_url) {
      bossImage.innerHTML = `<img src="${boss.img_url}" alt="${boss.name}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
    } else {
      bossImage.textContent = 'Изображение монстра';
    }
  }
}

// Настройка обработчиков событий
function setupEventListeners() {
  // Enter в чате
  document.getElementById('chat-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });
  
  // Закрытие модальных окон при клике вне их
  window.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
      event.target.style.display = 'none';
    }
  });
}

// Подключение к чату через WebSocket
function connectToChat() {
  if (!currentTeam) return;
  
  const token = localStorage.getItem('access_token');
  const wsUrl = `${WS_BASE_URL}/ws/team-chat/${currentTeam.team_id}/${token}`;
  
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
  try {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${window.API_BASE_URL}/teams/${currentTeam.team_id}/chat`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    if (response.ok) {
      const messages = await response.json();
      const chatBox = document.getElementById('chat-messages');
      chatBox.innerHTML = '';
      
      messages.forEach(message => {
        const messageText = `${message.user.nickname}: ${message.message}`;
        addMessageToChat(messageText);
      });
    }
  } catch (error) {
    console.error('Error loading chat history:', error);
  }
}

// Добавление сообщения в чат
function addMessageToChat(message) {
  const chatBox = document.getElementById('chat-messages');
  const messageElement = document.createElement('div');
  messageElement.textContent = message;
  chatBox.appendChild(messageElement);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Отправка сообщения в чат
function sendMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  
  if (message && chatWebSocket && chatWebSocket.readyState === WebSocket.OPEN) {
    chatWebSocket.send(message);
    input.value = '';
  }
}

// Атака босса
async function attackBoss() {
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
      const logEntry = document.createElement('div');
      logEntry.textContent = result.message;
      logEntry.style.marginTop = '10px';
      logEntry.style.padding = '5px';
      logEntry.style.backgroundColor = 'rgba(255,255,255,0.1)';
      logEntry.style.borderRadius = '4px';
      
      attackLog.appendChild(logEntry);
      
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
  document.getElementById('createTeamModal').style.display = 'flex';
  document.getElementById('create-team-name').focus();
}

function showJoinTeamModal() {
  document.getElementById('joinTeamModal').style.display = 'flex';
  document.getElementById('join-team-name').focus();
}

function showAddMemberModal() {
  document.getElementById('addMemberModal').style.display = 'flex';
  document.getElementById('add-member-nickname').focus();
}

function showRemoveMemberModal(member) {
  memberToRemove = member;
  document.getElementById('remove-member-text').textContent = 
    `Вы уверены, что хотите удалить ${member.nickname} из команды?`;
  document.getElementById('removeMemberModal').style.display = 'flex';
}

function showDeleteTeamModal() {
  document.getElementById('deleteTeamModal').style.display = 'flex';
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
  
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
  const name = document.getElementById('create-team-name').value.trim();
  const information = document.getElementById('create-team-info').value.trim();
  
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
  const teamName = document.getElementById('join-team-name').value.trim();
  
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
  const nickname = document.getElementById('add-member-nickname').value.trim();
  
  if (!nickname) {
    showError('Введите никнейм участника');
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
  if (!memberToRemove) return;
  
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
  document.getElementById('edit-team-name-input').value = currentTeam.name;
  document.getElementById('editTeamNameModal').style.display = 'flex';
  document.getElementById('edit-team-name-input').focus();
}

async function saveTeamName() {
  const newName = document.getElementById('edit-team-name-input').value.trim();
  
  if (!newName) {
    showError('Введите название команды');
    return;
  }
  
  if (newName === currentTeam.name) {
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
  document.getElementById('edit-team-info-input').value = currentTeam.information || '';
  document.getElementById('editTeamInfoModal').style.display = 'flex';
  document.getElementById('edit-team-info-input').focus();
}

async function saveTeamInfo() {
  const newInfo = document.getElementById('edit-team-info-input').value.trim();
  
  if (newInfo === (currentTeam.information || '')) {
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
  alert('Ошибка: ' + message);
}

function showSuccess(message) {
  alert(message);
}

// Очистка при выходе со страницы
window.addEventListener('beforeunload', function() {
  if (chatWebSocket) {
    chatWebSocket.close();
  }
});