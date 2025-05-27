// API и WebSocket базовые URL
if (typeof window.window.API_BASE_URL === 'undefined') {
  window.window.API_BASE_URL = "/api"; // Use window object to avoid redeclaration
}
const WS_PROTOCOL = window.location.protocol === "https:" ? "wss" : "ws";
const WS_BASE_URL = `${WS_PROTOCOL}://${window.location.host}${window.window.API_BASE_URL}`; // Using window.API_BASE_URL for WebSocket URL

// Глобальные переменные
// Глобальные переменные
let items = [];
let userGold = 0;
let userId = null;
let userClassId = null;
let selectedItemId = null;
let selectedBlockType = null;

// Загрузка данных при загрузке страницы
document.addEventListener('DOMContentLoaded', async function() {
  try {
    // Получаем токен из localStorage
    const token = localStorage.getItem('access_token');
    if (!token) {
      window.location.href = 'login.html';
      return;
    }

    // Получаем данные пользователя
    await fetchUserData(token);
    
    // Получаем все предметы
    await fetchItems(token);
    
    // Отображаем предметы по категориям
    renderItems();
    
  } catch (error) {
    console.error('Error initializing shop:', error);
  }
});

// Получение данных пользователя
async function fetchUserData(token) {
  try {
    const response = await fetch(`${window.API_BASE_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch user data');
    }
    
    const userData = await response.json();
    userId = userData.user_id;
    userGold = userData.gold;
    userClassId = userData.class_id;
    
    console.log('User data loaded:', { userId, userGold, userClassId });
    
    // Обновляем отображение золота в шапке (если есть)
    const goldElement = document.getElementById('user-gold');
    if (goldElement) {
      goldElement.textContent = userGold;
    }
    
  } catch (error) {
    console.error('Error fetching user data:', error);
    // Для демонстрации
    userGold = 5000;
    userClassId = 1; // Демонстрационный класс
  }
}

// Получение всех предметов
async function fetchItems(token) {
  try {
    const response = await fetch(`${window.API_BASE_URL}/items`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch items');
    }
    
    items = await response.json();
    console.log('Items loaded:', items.length);
    
  } catch (error) {
    console.error('Error fetching items:', error);
    // Для демонстрации используем тестовые данные
    items = [
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
        item_id: 3,
        name: "Свиток древнего разума",
        price: 150,
        type: "com",
        class_id: null,
        bonus_type: "exp_boost",
        bonus_data: "0.25",
        information: "Дает 25% опыта до следующего уровня."
      },
      {
        item_id: 4,
        name: "Зелье просветления",
        price: 200,
        type: "com",
        class_id: null,
        bonus_type: "exp_boost",
        bonus_data: "1",
        information: "Дает столько опыта, сколько не хватает до следующего уровня."
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
        item_id: 6,
        name: "Драконий браслет",
        price: 600,
        type: "rare",
        class_id: null,
        bonus_type: "max_health",
        bonus_data: "3",
        information: "Увеличивает максимальное здоровье."
      },
      {
        item_id: 7,
        name: "Сумка торговца",
        price: 800,
        type: "rare",
        class_id: null,
        bonus_type: "gold_multiplier",
        bonus_data: "1.05",
        information: "Увеличивает получаемое золото за задачи."
      },
      {
        item_id: 8,
        name: "Талисман скрытой силы",
        price: 1000,
        type: "rare",
        class_id: null,
        bonus_type: "attack",
        bonus_data: "5",
        information: "Увеличивает атаку."
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
      },
      {
        item_id: 10,
        name: "Клинок жертвоприношений",
        price: 1500,
        type: "rare",
        class_id: 2,
        bonus_type: "attack",
        bonus_data: "20",
        information: "Увеличивает атаку на 20 единиц."
      },
      {
        item_id: 11,
        name: "Лира благосклонности",
        price: 1600,
        type: "rare",
        class_id: 3,
        bonus_type: "health_regen",
        bonus_data: "3",
        information: "Ежедневно восстанавливает 3 здоровья."
      },
      {
        item_id: 12,
        name: "Мантия благосклонности",
        price: 2000,
        type: "rare",
        class_id: 4,
        bonus_type: "boss_gold",
        bonus_data: "2",
        information: "Удваивает золото за босса."
      }
    ];
  }
}

// Отображение предметов по категориям
function renderItems() {
  const blocksContainer = document.querySelector('.blocks-container');
  blocksContainer.innerHTML = '';
  
  // Создаем блок для разовых предметов (com)
  const commonItems = items.filter(item => item.type === 'com');
  if (commonItems.length > 0) {
    const commonBlock = createItemBlock('Разовые вещи:', commonItems, 'com');
    blocksContainer.appendChild(commonBlock);
  }
  
  // Создаем блок для редких предметов (rare) без привязки к классу
  const rareItems = items.filter(item => item.type === 'rare' && item.class_id === null);
  if (rareItems.length > 0) {
    const rareBlock = createItemBlock('Редкие вещи:', rareItems, 'rare');
    blocksContainer.appendChild(rareBlock);
  }
  
  // Создаем блок для классовых предметов, соответствующих классу пользователя
  const classItems = items.filter(item => item.class_id !== null && item.class_id === userClassId);
  if (classItems.length > 0) {
    const classBlock = createItemBlock('Классовые вещи:', classItems, 'class');
    blocksContainer.appendChild(classBlock);
  } else if (userClassId) {
    // Если у пользователя есть класс, но нет предметов для него
    const emptyClassBlock = document.createElement('div');
    emptyClassBlock.className = 'shop-block';
    emptyClassBlock.dataset.blockType = 'class';
    
    const titleElement = document.createElement('div');
    titleElement.className = 'shop-title';
    titleElement.textContent = 'Классовые вещи:';
    
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-items-message';
    emptyMessage.textContent = 'Нет доступных предметов для вашего класса';
    
    emptyClassBlock.appendChild(titleElement);
    emptyClassBlock.appendChild(emptyMessage);
    blocksContainer.appendChild(emptyClassBlock);
  }
}

// Создание блока с предметами
function createItemBlock(title, itemsList, blockType) {
  const block = document.createElement('div');
  block.className = 'shop-block';
  block.dataset.blockType = blockType;
  
  const titleElement = document.createElement('div');
  titleElement.className = 'shop-title';
  titleElement.textContent = title;
  
  const grid = document.createElement('div');
  grid.className = 'items-grid';
  
  // Добавляем все доступные предметы в сетку, динамически адаптируя размер сетки
  itemsList.forEach(item => {
    const itemElement = createItemElement(item, blockType);
    grid.appendChild(itemElement);
  });
  
  // Если предметов меньше 4, добавляем пустые слоты для сохранения сетки 2x2
  const emptySlots = 4 - itemsList.length % 4;
  if (emptySlots < 4) {
    for (let i = 0; i < emptySlots; i++) {
      const emptySlot = document.createElement('div');
      emptySlot.className = 'item-card empty';
      
      const emptyItemSlot = document.createElement('div');
      emptyItemSlot.className = 'item-slot empty';
      
      emptySlot.appendChild(emptyItemSlot);
      grid.appendChild(emptySlot);
    }
  }
  
  // Создаем кнопку "Купить"
  const buyButton = document.createElement('button');
  buyButton.className = 'buy-button';
  buyButton.textContent = 'Купить';
  buyButton.addEventListener('click', () => {
    if (selectedItemId && selectedBlockType === blockType) {
      buyItem(selectedItemId);
    } else {
      alert('Выберите предмет для покупки');
    }
  });
  
  block.appendChild(titleElement);
  block.appendChild(grid);
  block.appendChild(buyButton);
  
  return block;
}

// Создание элемента предмета
function createItemElement(item, blockType) {
  const itemCard = document.createElement('div');
  itemCard.className = 'item-card';
  itemCard.dataset.itemId = item.item_id;
  
  // Создаем слот для предмета
  const itemSlot = document.createElement('div');
  itemSlot.className = 'item-slot';
  
  // Добавляем изображение предмета, если оно есть
  try {
    const itemImage = document.createElement('img');
    itemImage.src = `images/item_${item.item_id}.png`;
    itemImage.alt = item.name;
    itemImage.onerror = function() {
      this.src = 'images/default_item.png';
    };
    itemSlot.appendChild(itemImage);
  } catch (error) {
    console.warn(`Image for item ${item.item_id} not found`);
  }
  
  // Создаем всплывающую подсказку
  const tooltip = document.createElement('div');
  tooltip.className = 'item-tooltip';
  
  const tooltipTitle = document.createElement('div');
  tooltipTitle.className = 'tooltip-title';
  tooltipTitle.textContent = item.name;
  
  const tooltipBonus = document.createElement('div');
  tooltipBonus.className = 'tooltip-bonus';
  tooltipBonus.textContent = formatBonus(item.bonus_type, item.bonus_data);
  
  const divider = document.createElement('div');
  divider.className = 'tooltip-divider';
  
  const tooltipDescription = document.createElement('div');
  tooltipDescription.className = 'tooltip-description';
  tooltipDescription.textContent = item.information;
  
  tooltip.appendChild(tooltipTitle);
  tooltip.appendChild(tooltipBonus);
  tooltip.appendChild(divider);
  tooltip.appendChild(tooltipDescription);
  
  itemSlot.appendChild(tooltip);
  
  // Создаем элемент цены
  const priceElement = document.createElement('div');
  priceElement.className = 'item-price';
  priceElement.textContent = `${item.price} золота`;
  
  // Добавляем обработчик клика для выбора предмета
  itemSlot.addEventListener('click', function() {
    // Снимаем выделение со всех предметов
    document.querySelectorAll('.item-slot').forEach(el => {
      el.classList.remove('selected');
    });
    
    // Выделяем текущий предмет
    this.classList.add('selected');
    
    // Запоминаем ID выбранного предмета и тип блока
    selectedItemId = item.item_id;
    selectedBlockType = blockType;
  });
  
  itemCard.appendChild(itemSlot);
  itemCard.appendChild(priceElement);
  
  return itemCard;
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
    default:
      return `Бонус: ${bonusData}`;
  }
}

// Покупка предмета
async function buyItem(itemId) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) {
      window.location.href = 'login.html';
      return;
    }
    
    const item = items.find(i => i.item_id == itemId);
    if (!item) {
      alert('Предмет не найден');
      return;
    }
    
    // Проверяем, достаточно ли золота
    if (userGold < item.price) {
      alert('Недостаточно золота для покупки');
      return;
    }
    
    const response = await fetch(`${window.API_BASE_URL}/items/buy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        item_id: itemId
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to buy item');
    }
    
    // Обновляем золото пользователя
    userGold -= item.price;
    const goldElement = document.getElementById('user-gold');
    if (goldElement) {
      goldElement.textContent = userGold;
    }
    
    alert(`Вы успешно приобрели ${item.name}!`);
    
    // Снимаем выделение с предмета
    document.querySelectorAll('.item-slot').forEach(el => {
      el.classList.remove('selected');
    });
    
    // Сбрасываем выбранный предмет
    selectedItemId = null;
    selectedBlockType = null;
    
  } catch (error) {
    console.error('Error buying item:', error);
    alert('Произошла ошибка при покупке предмета');
  }
}