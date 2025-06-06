// API и WebSocket базовые URL
if (typeof window.window.API_BASE_URL === 'undefined') {
  window.window.API_BASE_URL = "/api"; // Use window object to avoid redeclaration
}
const WS_PROTOCOL = window.location.protocol === "https:" ? "wss" : "ws";
const WS_BASE_URL = `${WS_PROTOCOL}://${window.location.host}${window.window.API_BASE_URL}`; // Using window.API_BASE_URL for WebSocket URL


let userItems = [];
let allItems = [];
let selectedInventoryItemId = null;
let selectedActiveItemId = null;

// Загрузка данных при загрузке страницы
document.addEventListener('DOMContentLoaded', async function() {
  try {
    // Получаем токен из localStorage
    const token = localStorage.getItem('access_token');
    if (!token) {
      window.location.href = 'auth.html';
      return;
    }
    
    // Получаем все предметы и предметы пользователя
    await Promise.all([
      fetchAllItems(token),
      fetchUserItems(token)
    ]);
    
    // Отображаем инвентарь и активные бонусы пользователя
    renderInventory();
    renderActiveBonuses();
    
    // Добавляем обработчики для кнопок
    setupButtonHandlers();
    
  } catch (error) {
    console.error('Error initializing inventory:', error);
  }
});

// Настройка обработчиков кнопок
function setupButtonHandlers() {
  // Кнопка "Использовать"
  const useButton = document.querySelector('.block:first-child .btn');
  if (useButton) {
    useButton.addEventListener('click', useSelectedItem);
  }
  
  // Кнопка "Снять"
  const removeButton = document.querySelector('.block:nth-child(2) .btn');
  if (removeButton) {
    removeButton.addEventListener('click', removeSelectedItem);
  }
}

// Получение всех предметов
async function fetchAllItems(token) {
  try {
    const response = await fetch(`${window.API_BASE_URL}/items`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch items');
    }
    
    allItems = await response.json();
    console.log('All items loaded:', allItems.length);
    
  } catch (error) {
    console.error('Error fetching all items:', error);
    // Для демонстрации используем тестовые данные
    allItems = [
      {
        item_id: 1,
        name: "Лепестки исцеления",
        price: 100,
        type: "com",
        class_id: null,
        bonus_type: "health_restore",
        bonus_data: "0.25",
        information: "Восстанавливает часть здоровья."
      },
      {
        item_id: 2,
        name: "Восстанавливающий отвар",
        price: 120,
        type: "com",
        class_id: null,
        bonus_type: "health_restore_full",
        bonus_data: "1",
        information: "Полностью восстанавливает здоровье."
      },
      {
        item_id: 5,
        name: "Таинственная шкатулка",
        price: 500,
        type: "rare",
        class_id: null,
        bonus_type: "exp_multiplier",
        bonus_data: "1.05",
        information: "Реликвия, изготовленная опытным мастером."
      },
      {
        item_id: 9,
        name: "Амулет архимага",
        price: 1500,
        type: "rare",
        class_id: 1,
        bonus_type: "attack",
        bonus_data: "10",
        information: "Увеличивает атаку на 10 единиц."
      }
    ];
  }
}

// Получение предметов пользователя
async function fetchUserItems(token) {
  try {
    const response = await fetch(`${window.API_BASE_URL}/user-items`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch user items');
    }
    
    userItems = await response.json();
    console.log('User items loaded:', userItems.length);
    
  } catch (error) {
    console.error('Error fetching user items:', error);
    // Для демонстрации используем тестовые данные
    userItems = [
      {
        user_id: 1,
        item_id: 1,
        active: 'false',
        item: {
          item_id: 1,
          name: "Лепестки исцеления",
          price: 100,
          type: "com",
          class_id: null,
          bonus_type: "health_restore",
          bonus_data: "0.25",
          information: "Восстанавливает часть здоровья."
        }
      },
      {
        user_id: 1,
        item_id: 5,
        active: 'true',
        item: {
          item_id: 5,
          name: "Таинственная шкатулка",
          price: 500,
          type: "rare",
          class_id: null,
          bonus_type: "exp_multiplier",
          bonus_data: "1.05",
          information: "Реликвия, изготовленная опытным мастером."
        }
      },
      {
        user_id: 1,
        item_id: 9,
        active: 'false',
        item: {
          item_id: 9,
          name: "Амулет архимага",
          price: 1500,
          type: "rare",
          class_id: 1,
          bonus_type: "attack",
          bonus_data: "10",
          information: "Увеличивает атаку на 10 единиц."
        }
      }
    ];
  }
}

// Отображение инвентаря пользователя (неактивные предметы)
function renderInventory() {
  const inventoryGrid = document.querySelector('.inventory-grid1');
  if (!inventoryGrid) return;
  
  // Очищаем сетку
  inventoryGrid.innerHTML = '';
  
  // Фильтруем только неактивные предметы
  const inactiveItems = userItems.filter(item => item.active === 'false');
  
  // Если у пользователя нет неактивных предметов, показываем пустые слоты
  if (inactiveItems.length === 0) {
    for (let i = 0; i < 15; i++) {
      const emptySlot = document.createElement('div');
      emptySlot.className = 'item empty-slot';
      inventoryGrid.appendChild(emptySlot);
    }
    return;
  }
  
  // Добавляем неактивные предметы в сетку
  inactiveItems.forEach(userItem => {
    const itemElement = createItemElement(userItem, false);
    inventoryGrid.appendChild(itemElement);
  });
  
  // Добавляем пустые слоты, если предметов меньше 15
  const emptySlots = 15 - inactiveItems.length;
  for (let i = 0; i < emptySlots; i++) {
    const emptySlot = document.createElement('div');
    emptySlot.className = 'item empty-slot';
    inventoryGrid.appendChild(emptySlot);
  }
}

// Отображение активных бонусов пользователя
function renderActiveBonuses() {
  const bonusesGrid = document.querySelector('.inventory-grid2');
  if (!bonusesGrid) return;
  
  // Очищаем сетку
  bonusesGrid.innerHTML = '';
  
  // Фильтруем только активные предметы
  const activeItems = userItems.filter(item => item.active === 'true');
  
  // Если у пользователя нет активных предметов, показываем пустые слоты
  if (activeItems.length === 0) {
    for (let i = 0; i < 3; i++) {
      const emptySlot = document.createElement('div');
      emptySlot.className = 'item empty-slot';
      bonusesGrid.appendChild(emptySlot);
    }
    return;
  }
  
  // Добавляем активные предметы в сетку
  activeItems.forEach(userItem => {
    const itemElement = createItemElement(userItem, true);
    bonusesGrid.appendChild(itemElement);
  });
  
  // Добавляем пустые слоты, если предметов меньше 3
  const emptySlots = 3 - activeItems.length;
  for (let i = 0; i < emptySlots; i++) {
    const emptySlot = document.createElement('div');
    emptySlot.className = 'item empty-slot';
    bonusesGrid.appendChild(emptySlot);
  }
}

// Создание элемента предмета
function createItemElement(userItem, isActive) {
  const itemElement = document.createElement('div');
  itemElement.className = 'item';
  // Сохраняем уникальный идентификатор предмета в атрибуте data-item-id
  itemElement.dataset.itemId = userItem.item_id;
  
  // Добавляем класс для стилизации
  itemElement.classList.add('filled');
  
  // Создаем контейнер для содержимого предмета
  const itemContent = document.createElement('div');
  itemContent.className = 'item-content';
  
  // Добавляем изображение предмета
  const itemImg = document.createElement('img');
  itemImg.className = 'item-img';
  itemImg.src = `images/item_${userItem.item_id}.png`;
  itemImg.alt = userItem.item.name;
  itemImg.onerror = function() {
    this.src = 'images/default_item.png';
  };
  
  // Добавляем название предмета
  const itemName = document.createElement('div');
  itemName.className = 'item-name';
  itemName.textContent = userItem.item.name;
  
  // Создаем всплывающую подсказку в стиле магазина
  const tooltip = document.createElement('div');
  tooltip.className = 'item-tooltip';
  
  const tooltipTitle = document.createElement('div');
  tooltipTitle.className = 'tooltip-title';
  tooltipTitle.textContent = userItem.item.name;
  
  const tooltipBonus = document.createElement('div');
  tooltipBonus.className = 'tooltip-bonus';
  tooltipBonus.textContent = formatBonus(userItem.item.bonus_type, userItem.item.bonus_data);
  
  const tooltipDivider = document.createElement('div');
  tooltipDivider.className = 'tooltip-divider';
  
  const tooltipDescription = document.createElement('div');
  tooltipDescription.className = 'tooltip-description';
  tooltipDescription.textContent = userItem.item.information;
  
  // Собираем всплывающую подсказку
  tooltip.appendChild(tooltipTitle);
  tooltip.appendChild(tooltipBonus);
  tooltip.appendChild(tooltipDivider);
  tooltip.appendChild(tooltipDescription);
  
  // Добавляем обработчик клика для выбора предмета
  itemElement.addEventListener('click', () => {
    // Снимаем выделение со всех предметов в соответствующей сетке
    if (isActive) {
      document.querySelectorAll('.inventory-grid2 .item').forEach(el => {
        el.classList.remove('selected');
      });
      // Сбрасываем выбор в инвентаре
      selectedInventoryItemId = null;
      // Устанавливаем выбранный активный предмет
      selectedActiveItemId = userItem.item_id;
    } else {
      document.querySelectorAll('.inventory-grid1 .item').forEach(el => {
        el.classList.remove('selected');
      });
      // Сбрасываем выбор в активных бонусах
      selectedActiveItemId = null;
      // Устанавливаем выбранный предмет инвентаря
      selectedInventoryItemId = userItem.item_id;
    }
    
    // Выделяем текущий предмет
    itemElement.classList.add('selected');
    
    console.log(`Selected ${isActive ? 'active' : 'inventory'} item: ${userItem.item_id}`);
  });
  
  // Собираем элемент предмета
  itemContent.appendChild(itemImg);
  itemContent.appendChild(itemName);
  itemElement.appendChild(itemContent);
  itemElement.appendChild(tooltip);
  
  return itemElement;
}

// Форматирование бонуса предмета
function formatBonus(bonusType, bonusData) {
  switch (bonusType) {
    case 'exp_multiplier':
      return `Бонус: +${(parseFloat(bonusData) - 1)}% к получаемому опыту.`;
    case 'health_restore':
      return `Восстанавливает ${parseFloat(bonusData)}% от максимального здоровья.`;
    case 'health_restore_full':
      return `Полностью исцеляет.`;
    case 'exp_boost':
      return `Даёт ${parseFloat(bonusData)}% опыта до следующего уровня.`;
    case 'max_health':
      return `+${bonusData} к максимальному здоровью.`;
    case 'attack':
      return `+${bonusData} к атаке.`;
    case 'gold_multiplier':
      return `+${(parseFloat(bonusData) - 1)}% к золоту за задачи.`;
    case 'health_regen':
      return `Ежедневно восстанавливает ${bonusData} здоровья.`;
    case 'boss_gold':
      return `Удваивает золото за босса.`;
    case 'exp_chance':
      return `${bonusData}% шанс получения двойного опыта.`;
    case 'damage_reduction':
      return `Уменьшает потерю здоровья на ${bonusData}.`;
    case 'gold_all':
      return `+${bonusData}% к золоту за задачи и победу над боссом.`;
    case 'boss_exp':
      return `Получение ${bonusData} опыта после победы над боссом.`;
    case 'ignore_damage':
      return `${bonusData}% шанс игнорирования потери здоровья при провале.`;
    case 'daily_gold':
      return `Ежедневное получение ${bonusData} золота.`;
    default:
      return `Бонус: ${bonusData}`;
  }
}

// Использование выбранного предмета (активация)
async function useSelectedItem() {
  if (!selectedInventoryItemId) {
    alert('Выберите предмет для использования');
    return;
  }
  
  try {
    const token = localStorage.getItem('access_token');
    if (!token) {
      window.location.href = 'login.html';
      return;
    }
    
    console.log(`Activating item: ${selectedInventoryItemId}`);
    
    // Отправляем запрос на активацию предмета
    const response = await fetch(`${window.API_BASE_URL}/user-items/${selectedInventoryItemId}/toggle-active`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        active: 'true'
      })
    });
    
    // Обновляем список предметов пользователя
    await fetchUserItems(token);
    
    // Обновляем отображение инвентаря и активных бонусов
    renderInventory();
    renderActiveBonuses();
    
    // Сбрасываем выбранные предметы
    selectedInventoryItemId = null;
    selectedActiveItemId = null;
    
  } catch (error) {
    console.error('Error activating item:', error);
    alert('Произошла ошибка при активации предмета');
  }
}

// Снятие выбранного предмета (деактивация)
async function removeSelectedItem() {
  if (!selectedActiveItemId) {
    alert('Выберите предмет для снятия');
    return;
  }
  
  try {
    const token = localStorage.getItem('access_token');
    if (!token) {
      window.location.href = 'login.html';
      return;
    }
    
    console.log(`Deactivating item: ${selectedActiveItemId}`);
    
    // Отправляем запрос на деактивацию предмета
    const response = await fetch(`${window.API_BASE_URL}/user-items/${selectedActiveItemId}/toggle-active`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        active: 'false'
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to deactivate item');
    }
    
    // Обновляем список предметов пользователя
    await fetchUserItems(token);
    
    // Обновляем отображение инвентаря и активных бонусов
    renderInventory();
    renderActiveBonuses();
    
    // Сбрасываем выбранные предметы
    selectedInventoryItemId = null;
    selectedActiveItemId = null;
    
  } catch (error) {
    console.error('Error deactivating item:', error);
    alert('Произошла ошибка при снятии предмета');
  }
}