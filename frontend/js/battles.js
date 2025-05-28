// API базовый URL
if (typeof window.API_BASE_URL === 'undefined') {
  window.API_BASE_URL = "/api";
}

// Инициализация страницы
document.addEventListener('DOMContentLoaded', function() {
  setupEventListeners();
});

// Настройка обработчиков событий
function setupEventListeners() {
  // Кнопки открытия модальных окон
  document.getElementById('findTeamBtn').addEventListener('click', openFindTeamModal);
  document.getElementById('createTeamBtn').addEventListener('click', openCreateTeamModal);
  
  // Кнопки в модальных окнах
  document.getElementById('joinTeamBtn').addEventListener('click', joinTeam);
  document.getElementById('confirmCreateBtn').addEventListener('click', createTeam);
  
  // Enter в полях ввода
  document.getElementById('team-search-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      joinTeam();
    }
  });
  
  document.getElementById('team-name-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      createTeam();
    }
  });
  
  // Закрытие модальных окон при клике вне их
  window.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
      closeModal(event.target.id);
    }
  });
}

// Открытие модального окна поиска команды
function openFindTeamModal() {
  document.getElementById('findTeamModal').style.display = 'flex';
  document.getElementById('team-search-input').focus();
  clearMessage('search-message');
}

// Открытие модального окна создания команды
function openCreateTeamModal() {
  document.getElementById('createTeamModal').style.display = 'flex';
  document.getElementById('team-name-input').focus();
  clearMessage('create-message');
}

// Закрытие модального окна
function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
  
  // Очищаем поля ввода
  const inputs = document.querySelectorAll(`#${modalId} input, #${modalId} textarea`);
  inputs.forEach(input => input.value = '');
  
  // Очищаем сообщения
  const messages = document.querySelectorAll(`#${modalId} .modal-message`);
  messages.forEach(msg => {
    msg.textContent = '';
    msg.className = 'modal-message';
  });
}

// Присоединение к команде
async function joinTeam() {
  const teamName = document.getElementById('team-search-input').value.trim();
  const messageEl = document.getElementById('search-message');
  
  if (!teamName) {
    showMessage(messageEl, 'Введите название команды', 'error');
    return;
  }
  
  try {
    const token = localStorage.getItem('access_token');
    if (!token) {
      window.location.href = 'auth.html';
      return;
    }
    
    showMessage(messageEl, 'Присоединение к команде...', 'info');
    
    const response = await fetch(`${window.API_BASE_URL}/teams/join`, {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ team_name: teamName })
    });
    
    if (response.ok) {
      const result = await response.json();
      showMessage(messageEl, result.message || 'Вы успешно присоединились к команде!', 'success');
      
      // Через 2 секунды перенаправляем на страницу команды
      setTimeout(() => {
        closeModal('findTeamModal');
        goToTeamPage();
      }, 2000);
      
    } else {
      const error = await response.json();
      showMessage(messageEl, error.detail || 'Ошибка присоединения к команде', 'error');
    }
    
  } catch (error) {
    console.error('Error joining team:', error);
    showMessage(messageEl, 'Ошибка подключения к серверу', 'error');
  }
}

// Создание команды
async function createTeam() {
  const teamName = document.getElementById('team-name-input').value.trim();
  const teamInfo = document.getElementById('team-info-input').value.trim();
  const messageEl = document.getElementById('create-message');
  
  if (!teamName) {
    showMessage(messageEl, 'Введите название команды', 'error');
    return;
  }
  
  try {
    const token = localStorage.getItem('access_token');
    if (!token) {
      window.location.href = 'auth.html';
      return;
    }
    
    showMessage(messageEl, 'Создание команды...', 'info');
    
    const response = await fetch(`${window.API_BASE_URL}/teams`, {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ 
        name: teamName, 
        information: teamInfo || null 
      })
    });
    
    if (response.ok) {
      showMessage(messageEl, 'Команда успешно создана!', 'success');
      
      // Через 2 секунды перенаправляем на страницу команды
      setTimeout(() => {
        closeModal('createTeamModal');
        goToTeamPage();
      }, 2000);
      
    } else {
      const error = await response.json();
      showMessage(messageEl, error.detail || 'Ошибка создания команды', 'error');
    }
    
  } catch (error) {
    console.error('Error creating team:', error);
    showMessage(messageEl, 'Ошибка подключения к серверу', 'error');
  }
}

// Переход на страницу команды
function goToTeamPage() {
  window.location.href = 'team.html';
}

// Показ сообщения
function showMessage(element, message, type) {
  element.textContent = message;
  element.className = `modal-message ${type}`;
}

// Очистка сообщения
function clearMessage(elementId) {
  const element = document.getElementById(elementId);
  element.textContent = '';
  element.className = 'modal-message';
}