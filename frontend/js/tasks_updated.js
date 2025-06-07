// API и WebSocket базовые URL
if (typeof window.API_BASE_URL === 'undefined') {
  window.API_BASE_URL = "/api";
}
const WS_PROTOCOL = window.location.protocol === "https:" ? "wss" : "ws";
const WS_BASE_URL = `${WS_PROTOCOL}://${window.location.host}${window.API_BASE_URL}`;

// Глобальные переменные
let tasks = [];
let catalogs = [];
let currentEditingTaskId = null;
let currentCatalogId = null;
let damagedTaskIds = new Set(); // Хранилище для отслеживания задач, за которые уже был нанесен урон
let isInitialized = false; // Флаг для предотвращения повторной инициализации

// Функция получения каталогов пользователя из API
async function fetchCatalogs() {
  try {
    const token = localStorage.getItem("access_token");
    if (!token) {
      console.error("No authentication token found");
      return;
    }

    const response = await fetch(`${window.API_BASE_URL}/catalogs/`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      catalogs = data;
      console.log('Catalogs loaded:', catalogs.length);
      renderCatalogs();
    } else {
      console.error("Failed to fetch catalogs:", response.status);
      await createDefaultCatalog();
    }
  } catch (error) {
    console.error("Error fetching catalogs:", error);
    await createDefaultCatalog();
  }
}

// Создание каталога по умолчанию
async function createDefaultCatalog() {
  try {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    const response = await fetch(`${window.API_BASE_URL}/catalogs/`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "Входящие",
        user_id: 0 // Будет заменен сервером на ID текущего пользователя
      })
    });

    if (response.ok) {
      const newCatalog = await response.json();
      catalogs = [newCatalog];
      console.log('Default catalog created:', newCatalog);
      renderCatalogs();
    }
  } catch (error) {
    console.error("Error creating default catalog:", error);
  }
}

// Получение задач для конкретного каталога
async function fetchCatalogTasks(catalogId) {
  try {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    console.log(`Fetching tasks for catalog ${catalogId}...`);

    const response = await fetch(`${window.API_BASE_URL}/catalogs/${catalogId}/tasks`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (response.ok) {
      const catalogTasks = await response.json();
      console.log(`Raw tasks from API for catalog ${catalogId}:`, catalogTasks);
      
      // Удаляем старые задачи этого каталога и добавляем новые
      tasks = tasks.filter(t => t.catalog_id !== catalogId);
      tasks = [...tasks, ...catalogTasks];
      
      console.log(`Tasks loaded for catalog ${catalogId}:`, catalogTasks.length);
      console.log('All tasks after loading:', tasks);
      
      // Проверяем, есть ли задачи с daily_tasks
      const dailyTasks = catalogTasks.filter(t => t.daily_tasks && t.daily_tasks.length > 0);
      console.log('Daily tasks found:', dailyTasks);
      dailyTasks.forEach(task => {
        console.log(`Daily task "${task.name}" repeats on:`, task.daily_tasks.map(dt => dt.day_week));
      });
      
      renderTasks();
      await checkOverdueCompletedTasks();
    }
  } catch (error) {
    console.error(`Error fetching tasks for catalog ${catalogId}:`, error);
  }
}

// Загрузка всех задач для всех каталогов
async function fetchAllTasks() {
  tasks = [];
  for (const catalog of catalogs) {
    await fetchCatalogTasks(catalog.catalog_id);
  }
}

// Проверка просроченных задач и нанесение урона
async function checkOverdueCompletedTasks() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const overdueTasks = tasks.filter(task => {
    if (task.completed !== 'false') return false;
    if (!task.deadline) return false;
    
    const deadlineDate = new Date(task.deadline);
    deadlineDate.setHours(0, 0, 0, 0);
    
    return deadlineDate < today && !damagedTaskIds.has(task.task_id);
  });
  
  if (overdueTasks.length > 0) {
    for (const task of overdueTasks) {
      await applyDamageForTask(task);
    }
    renderTasks();
  }
}

// Нанесение урона за просроченную задачу
async function applyDamageForTask(task) {
  try {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    
    let damage = 4; // По умолчанию для 'normal'
    if (task.complexity === 'easy') {
      damage = 3;
    } else if (task.complexity === 'hard') {
      damage = 5;
    }
    
    // Получаем текущие данные пользователя
    const userResponse = await fetch(`${window.API_BASE_URL}/users/me`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    if (!userResponse.ok) {
      console.error(`Failed to get user info: ${userResponse.status}`);
      return;
    }
    
    const userData = await userResponse.json();
    
    if (userData.lives === undefined) {
      console.error("User data doesn't contain lives field");
      return;
    }
    
    // Учитываем класс жреца
    if (userData.class_id === 4) {
      damage = Math.max(1, damage - 1);
    }

    const currentLives = parseInt(userData.lives);
    const newLives = Math.max(0, currentLives - damage);
    
    // Обновляем жизни пользователя
    const updateResponse = await fetch(`${window.API_BASE_URL}/users/me`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        login: userData.login,
        nickname: userData.nickname,
        user_id: userData.user_id,
        lives: newLives
      })
    });
    
    if (updateResponse.ok) {
      console.log(`Damage applied for task ${task.task_id}: ${damage} lives. Lives: ${currentLives} -> ${newLives}`);
      damagedTaskIds.add(task.task_id);
      await deleteTask(task.task_id);
    } else {
      console.error(`Failed to apply damage for task ${task.task_id}:`, updateResponse.status);
    }
  } catch (error) {
    console.error(`Error applying damage for task ${task.task_id}:`, error);
  }
}

// Отображение каталогов в UI
function renderCatalogs() {
  const container = document.getElementById('catalogs-container');
  if (!container) return;
  
  container.innerHTML = '';
  
  // Добавляем виртуальный каталог "Мой день"
  const myDayCatalog = document.createElement('div');
  myDayCatalog.className = 'catalog';
  myDayCatalog.id = 'my-day-catalog';
  myDayCatalog.innerHTML = `
    <div class="catalog-header">
      <h2 class="catalog-title">Мой день</h2>
      <div class="catalog-actions">
        <!-- Кнопка добавления задачи не нужна для "Мой день" -->
      </div>
    </div>
    <div class="catalog-content">
      <ul class="tasks-list" id="tasks-my-day"></ul>
    </div>
  `;
  container.appendChild(myDayCatalog);
  
  // Добавляем каталоги пользователя
  catalogs.forEach(catalog => {
    const catalogElement = document.createElement('div');
    catalogElement.className = 'catalog';
    catalogElement.id = `catalog-${catalog.catalog_id}`;
    
    catalogElement.innerHTML = `
      <div class="catalog-header">
        <h2 class="catalog-title">${catalog.name}</h2>
        <div class="catalog-actions">
          <button class="btn-task add-task-btn" data-catalog="${catalog.catalog_id}">+</button>
          <button class="delete-catalog-btn" data-catalog="${catalog.catalog_id}">🗑️</button>
        </div>
      </div>
      <div class="catalog-content">
        <ul class="tasks-list" id="tasks-${catalog.catalog_id}"></ul>
      </div>
    `;
    container.appendChild(catalogElement);
  });
  
  // Добавляем обработчики событий
  setupCatalogEventListeners();
  
  // Загружаем задачи для всех каталогов
  fetchAllTasks();
}

// Настройка обработчиков событий для каталогов
function setupCatalogEventListeners() {
  document.querySelectorAll('.add-task-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      openNewTaskModal(parseInt(this.dataset.catalog));
    });
  });
  
  document.querySelectorAll('.delete-catalog-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      deleteCatalog(parseInt(this.dataset.catalog));
    });
  });
}

// Отображение задач в UI
function renderTasks() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toLocaleDateString('ru-RU');
  
  console.log('=== RENDER TASKS DEBUG ===');
  console.log('Today:', todayStr);
  console.log('Day of week:', today.getDay(), ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][today.getDay()]);
  console.log('All tasks:', tasks);
  
  // Очищаем все списки задач
  document.querySelectorAll('.tasks-list').forEach(list => {
    list.innerHTML = '';
  });
  
  // Очищаем календарь
  const calendarContent = document.getElementById('calendar-content');
  if (calendarContent) {
    calendarContent.innerHTML = '';
  }
  
  // Группировка задач
  const catalogTasks = {};
  const todayTasksMap = new Map(); // Используем Map для исключения дубликатов
  const calendarTasks = {};
  
  // Обрабатываем все задачи
  tasks.forEach(task => {
    console.log('Processing task:', task.name, 'daily_tasks:', task.daily_tasks);
    
    // Инициализируем объект для каталога если его нет
    if (!catalogTasks[task.catalog_id]) {
      catalogTasks[task.catalog_id] = {
        withDate: {},
        withoutDate: []
      };
    }
    
    // Обрабатываем задачи с дедлайном
    if (task.deadline) {
      const deadlineDate = new Date(task.deadline);
      deadlineDate.setHours(0, 0, 0, 0);
      const dateStr = deadlineDate.toLocaleDateString('ru-RU');
      
      console.log('Task with deadline:', task.name, 'deadline:', dateStr, 'today:', todayStr);
      
      if (dateStr === todayStr) {
        // Задача на сегодня - добавляем в "Мой день"
        todayTasksMap.set(task.task_id, task);
        console.log('Added deadline task to today:', task.name);
      } else {
        // Задача на другую дату - группируем по датам в каталоге
        if (!catalogTasks[task.catalog_id].withDate[dateStr]) {
          catalogTasks[task.catalog_id].withDate[dateStr] = [];
        }
        catalogTasks[task.catalog_id].withDate[dateStr].push(task);
        
        // Добавляем в календарь
        if (!calendarTasks[dateStr]) {
          calendarTasks[dateStr] = [];
        }
        if (!calendarTasks[dateStr].some(t => t.task_id === task.task_id)) {
          calendarTasks[dateStr].push(task);
        }
      }
    } else {
      // Задачи без даты идут в основной каталог
      catalogTasks[task.catalog_id].withoutDate.push(task);
    }

    // Обрабатываем ежедневные задачи
    if (task.daily_tasks && task.daily_tasks.length > 0) {
      console.log('Processing daily task:', task.name);
      console.log('Daily tasks config:', task.daily_tasks);
      
      const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][today.getDay()];
      console.log('Current day of week:', dayOfWeek);
      
      const shouldRepeatToday = task.daily_tasks.some(dailyTask => {
        console.log('Checking daily task:', dailyTask.day_week, 'vs', dayOfWeek);
        return dailyTask.day_week === dayOfWeek;
      });
      
      console.log('Should repeat today?', shouldRepeatToday);
      
      if (shouldRepeatToday) {
        // Создаем уникальный экземпляр задачи для сегодняшнего дня
        const todayTaskInstance = createDailyTaskInstance(task, today);
        todayTasksMap.set(todayTaskInstance.task_id, todayTaskInstance);
        console.log('Added daily task instance to today:', todayTaskInstance.name, todayTaskInstance.task_id);
      }
      
      // Добавляем в календарь на будущие даты (следующие 7 дней)
      addDailyTaskToCalendar(task, calendarTasks, today);
    }
  });

  console.log('Today tasks map:', Array.from(todayTasksMap.values()));
  console.log('Calendar tasks:', calendarTasks);
  console.log('=== END RENDER TASKS DEBUG ===');

  // Отображаем задачи "Мой день"
  renderTodayTasks(Array.from(todayTasksMap.values()));
  
  // Отображаем задачи в каталогах
  renderCatalogTasks(catalogTasks);
  
  // Отображаем календарь
  renderCalendarTasks(calendarTasks);
}

// Отображение задач на сегодня
function renderTodayTasks(todayTasks) {
  const myDayTasksList = document.getElementById('tasks-my-day');
  if (!myDayTasksList) return;
  
  if (todayTasks.length > 0) {
    const taskGroup = document.createElement('div');
    taskGroup.className = 'task-group';
    myDayTasksList.appendChild(taskGroup);
    
    todayTasks.forEach(task => {
      addTaskToGroup(task, taskGroup);
    });
  } else {
    const noTasksMsg = document.createElement('div');
    noTasksMsg.className = 'no-tasks-message';
    noTasksMsg.textContent = 'Нет задач на сегодня';
    myDayTasksList.appendChild(noTasksMsg);
  }
}

// Отображение задач в каталогах
function renderCatalogTasks(catalogTasks) {
  for (const catalogId in catalogTasks) {
    const catalogData = catalogTasks[catalogId];
    const tasksList = document.getElementById(`tasks-${catalogId}`);
    
    if (tasksList) {
      // Отображаем задачи с датами, отсортированные по дате
      const sortedDates = Object.keys(catalogData.withDate).sort((a, b) => {
        const [dayA, monthA, yearA] = a.split('.');
        const [dayB, monthB, yearB] = b.split('.');
        const dateA = new Date(yearA, monthA - 1, dayA);
        const dateB = new Date(yearB, monthB - 1, dayB);
        return dateA - dateB;
      });
      
      sortedDates.forEach(dateStr => {
        const dateHeader = document.createElement('div');
        dateHeader.className = 'date-header';
        dateHeader.textContent = dateStr;
        tasksList.appendChild(dateHeader);
        
        const taskGroup = document.createElement('div');
        taskGroup.className = 'task-group';
        tasksList.appendChild(taskGroup);
        
        catalogData.withDate[dateStr].forEach(task => {
          addTaskToGroup(task, taskGroup);
        });
      });
      
      // Отображаем задачи без даты (исключаем ежедневные задачи)
      const tasksWithoutDate = catalogData.withoutDate.filter(task => {
        // Скрываем ежедневные задачи из каталогов
        return !(task.daily_tasks && task.daily_tasks.length > 0);
      });
      
      if (tasksWithoutDate.length > 0) {
        const noDateHeader = document.createElement('div');
        noDateHeader.className = 'date-header no-date';
        noDateHeader.textContent = 'Без даты';
        tasksList.appendChild(noDateHeader);
        
        const taskGroup = document.createElement('div');
        taskGroup.className = 'task-group';
        tasksList.appendChild(taskGroup);
        
        tasksWithoutDate.forEach(task => {
          addTaskToGroup(task, taskGroup);
        });
      }
    }
  }
}

// Создание экземпляра ежедневной задачи для конкретной даты
function createDailyTaskInstance(originalTask, targetDate) {
  const dateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD формат
  
  return {
    ...originalTask,
    task_id: `${originalTask.task_id}_${dateStr}`, // Уникальный ID для каждого дня
    completed: 'false', // ВСЕГДА начинается как невыполненная
    deadline: null, // У ежедневных задач нет дедлайна
    is_daily_instance: true, // Флаг что это экземпляр ежедневной задачи
    original_task_id: originalTask.task_id, // Ссылка на оригинальную задачу
    instance_date: dateStr // Дата для которой создан этот экземпляр
  };
}

// Добавление ежедневной задачи в календарь
function addDailyTaskToCalendar(task, calendarTasks, today) {
  console.log('Adding daily task to calendar:', task.name);
  
  // Добавляем задачи только на следующие 7 дней (исключая сегодня)
  for (let i = 1; i <= 7; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() + i);
    
    const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][checkDate.getDay()];
    const shouldRepeatOnThisDay = task.daily_tasks.some(dailyTask => {
      console.log(`Checking day ${i}: ${dayOfWeek} vs ${dailyTask.day_week}`);
      return dailyTask.day_week === dayOfWeek;
    });
    
    console.log(`Day ${i} (${dayOfWeek}): should repeat = ${shouldRepeatOnThisDay}`);
    
    if (shouldRepeatOnThisDay) {
      const dateStr = checkDate.toLocaleDateString('ru-RU');
      
      if (!calendarTasks[dateStr]) {
        calendarTasks[dateStr] = [];
      }
      
      // Создаем экземпляр задачи для этого дня
      const dailyInstance = createDailyTaskInstance(task, checkDate);
      
      // Проверяем по уникальному ID экземпляра
      if (!calendarTasks[dateStr].some(t => t.task_id === dailyInstance.task_id)) {
        calendarTasks[dateStr].push(dailyInstance);
        console.log(`Added daily instance to calendar for ${dateStr}:`, dailyInstance.name);
      }
    }
  }
}

// Отображение календарных задач
function renderCalendarTasks(calendarTasks) {
  const calendarContent = document.getElementById('calendar-content');
  if (!calendarContent) return;
  
  const sortedDates = Object.keys(calendarTasks).sort((a, b) => {
    const [dayA, monthA, yearA] = a.split('.');
    const [dayB, monthB, yearB] = b.split('.');
    const dateA = new Date(yearA, monthA - 1, dayA);
    const dateB = new Date(yearB, monthB - 1, dayB);
    return dateA - dateB;
  });
  
  sortedDates.forEach(date => {
    const dayElement = document.createElement('div');
    dayElement.className = 'calendar-day';
    
    const dateElement = document.createElement('div');
    dateElement.className = 'calendar-date';
    dateElement.textContent = date;
    dayElement.appendChild(dateElement);
    
    // Используем Map для исключения дубликатов
    const tasksMap = new Map();
    calendarTasks[date].forEach(task => {
      tasksMap.set(task.task_id, task);
    });
    
    Array.from(tasksMap.values()).forEach(task => {
      const taskElement = document.createElement('div');
      taskElement.className = 'task-item';
      taskElement.style.margin = '5px 0';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'task-checkbox';
      
      // Для ежедневных экземпляров всегда false
      if (task.is_daily_instance) {
        checkbox.checked = false;
      } else {
        checkbox.checked = task.completed === 'true';
      }
      
      checkbox.style.marginRight = '10px';
      
      const taskText = document.createElement('span');
      taskText.className = 'task-text';
      
      // Для ежедневных экземпляров никогда не показываем как выполненную
      if (task.is_daily_instance) {
        taskText.classList.remove('completed');
      } else {
        if (task.completed === 'true') {
          taskText.classList.add('completed');
        }
      }
      
      taskText.textContent = task.name;
      
      const complexityIndicator = document.createElement('span');
      complexityIndicator.className = `complexity-indicator ${task.complexity}`;
      complexityIndicator.textContent = {
        'easy': '⚪',
        'normal': '🔵',
        'hard': '🔴'
      }[task.complexity] || '🔵';
      complexityIndicator.style.marginLeft = '10px';
      
      checkbox.addEventListener('change', function() {
        updateTaskCompletion(task.task_id, this.checked);
      });
      
      taskElement.addEventListener('click', (e) => {
        if (e.target !== checkbox) {
          editTask(task.task_id);
        }
      });
      
      taskElement.appendChild(checkbox);
      taskElement.appendChild(taskText);
      taskElement.appendChild(complexityIndicator);
      dayElement.appendChild(taskElement);
    });
    
    calendarContent.appendChild(dayElement);
  });
}

// Добавление задачи в группу
function addTaskToGroup(task, taskGroup) {
  const taskItem = document.createElement('div');
  taskItem.className = 'task-item';
  taskItem.dataset.taskId = task.task_id;
  
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'task-checkbox';
  
  // Для ежедневных экземпляров всегда используем статус 'false'
  if (task.is_daily_instance) {
    checkbox.checked = false;
  } else {
    checkbox.checked = task.completed === 'true';
  }
  
  const taskText = document.createElement('span');
  taskText.className = 'task-text';
  
  // Для ежедневных экземпляров никогда не показываем как выполненную
  if (task.is_daily_instance) {
    taskText.classList.remove('completed');
  } else {
    if (task.completed === 'true') {
      taskText.classList.add('completed');
    }
  }
  
  taskText.textContent = task.name;
  
  const complexityIndicator = document.createElement('span');
  complexityIndicator.className = `complexity-indicator ${task.complexity}`;
  complexityIndicator.textContent = {
    'easy': '⚪',
    'normal': '🔵',
    'hard': '🔴'
  }[task.complexity] || '🔵';
  
  checkbox.addEventListener('change', function() {
    updateTaskCompletion(task.task_id, this.checked);
  });
  
  taskItem.appendChild(checkbox);
  taskItem.appendChild(taskText);
  taskItem.appendChild(complexityIndicator);
  taskGroup.appendChild(taskItem);
  
  taskItem.addEventListener('click', (e) => {
    if (e.target !== checkbox) {
      editTask(task.task_id);
    }
  });
}

// Обновление статуса выполнения задачи
async function updateTaskCompletion(taskId, completed) {
  try {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    // Проверяем, является ли это экземпляром ежедневной задачи
    if (taskId.includes('_')) {
      // Это экземпляр ежедневной задачи, обрабатываем локально
      console.log(`Daily task instance ${taskId} completion status updated to: ${completed ? 'true' : 'false'}`);
      
      // Обновляем UI для всех элементов этой задачи
      const taskElements = document.querySelectorAll(`[data-task-id="${taskId}"]`);
      taskElements.forEach(element => {
        const checkbox = element.querySelector('.task-checkbox');
        const taskText = element.querySelector('.task-text');
        if (checkbox) checkbox.checked = completed;
        if (taskText) {
          if (completed) {
            taskText.classList.add('completed');
          } else {
            taskText.classList.remove('completed');
          }
        }
      });
      
      // Если задача выполнена, даем награду
      if (completed) {
        const originalTaskId = taskId.split('_')[0];
        const originalTask = tasks.find(t => t.task_id == originalTaskId);
        if (originalTask) {
          await giveTaskReward(originalTask);
        }
      }
      
      return;
    }

    // Обычная задача - отправляем на сервер
    const response = await fetch(`${window.API_BASE_URL}/tasks/${taskId}/completion`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        completed: completed ? 'true' : 'false'
      })
    });
    
    if (response.ok) {
      const updatedTask = await response.json();
      const taskIndex = tasks.findIndex(t => t.task_id === taskId);
      if (taskIndex !== -1) {
        tasks[taskIndex].completed = updatedTask.completed;
      }
      console.log(`Task ${taskId} completion status updated to: ${completed ? 'true' : 'false'}`);
      
      // Обновляем UI для всех элементов этой задачи
      const taskElements = document.querySelectorAll(`[data-task-id="${taskId}"]`);
      taskElements.forEach(element => {
        const checkbox = element.querySelector('.task-checkbox');
        const taskText = element.querySelector('.task-text');
        if (checkbox) checkbox.checked = completed;
        if (taskText) {
          if (completed) {
            taskText.classList.add('completed');
          } else {
            taskText.classList.remove('completed');
          }
        }
      });
    } else {
      console.error(`Failed to update task ${taskId} completion status:`, response.status);
      // Откатываем изменения в UI
      rollbackTaskUI(taskId, !completed);
    }
  } catch (error) {
    console.error(`Error updating task ${taskId} completion:`, error);
    rollbackTaskUI(taskId, !completed);
  }
}

// Выдача награды за выполнение задачи
async function giveTaskReward(task) {
  try {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    const rewards = {
      "easy": [10, 20],
      "normal": [30, 40], 
      "hard": [50, 80]
    };
    
    const [goldReward, expReward] = rewards[task.complexity] || [30, 40];
    
    console.log(`Giving reward for task completion: ${goldReward} gold, ${expReward} exp`);
    
    // Здесь можно добавить вызов API для начисления награды
    // Пока что просто логируем
    
  } catch (error) {
    console.error("Error giving task reward:", error);
  }
}

// Откат изменений в UI
function rollbackTaskUI(taskId, previousState) {
  const taskElements = document.querySelectorAll(`[data-task-id="${taskId}"]`);
  taskElements.forEach(element => {
    const checkbox = element.querySelector('.task-checkbox');
    const taskText = element.querySelector('.task-text');
    if (checkbox) checkbox.checked = previousState;
    if (taskText) taskText.classList.toggle('completed', previousState);
  });
}

// Открытие модального окна для новой задачи
function openNewTaskModal(catalogId) {
  currentEditingTaskId = null;
  currentCatalogId = catalogId;
  
  document.getElementById('task-modal-title').textContent = 'Новая задача';
  document.getElementById('task-input').value = '';
  document.getElementById('deadline-input').value = '';
  
  // Сброс выбора сложности
  document.querySelectorAll('.complexity-btn').forEach(btn => {
    btn.classList.remove('selected');
  });
  document.querySelector('.complexity-btn[data-complexity="normal"]').classList.add('selected');
  
  // Сброс выбора дней
  document.querySelectorAll('.day-btn').forEach(btn => {
    btn.classList.remove('selected');
  });
  
  document.getElementById('delete-task-btn').style.display = 'none';
  document.getElementById('task-modal').style.display = 'flex';
  document.getElementById('task-input').focus();
}

// Открытие модального окна для редактирования задачи
async function editTask(taskId) {
  console.log('=== EDIT TASK DEBUG ===');
  console.log('editTask called with taskId:', taskId);
  
  let task;
  
  // Проверяем, является ли это экземпляром ежедневной задачи
  if (taskId.includes('_')) {
    console.log('This is a daily task instance');
    const originalTaskId = taskId.split('_')[0];
    task = tasks.find(t => t.task_id == originalTaskId);
    if (!task) {
      console.error('Original task not found for daily instance');
      return;
    }
    
    // Для ежедневных задач показываем предупреждение
    alert('Это ежедневная задача. Изменения применятся ко всем будущим повторениям.');
    currentEditingTaskId = originalTaskId;
  } else {
    console.log('This is a regular task');
    task = tasks.find(t => t.task_id == taskId);
    if (!task) {
      console.error('Task not found:', taskId);
      return;
    }
    currentEditingTaskId = taskId;
  }
  
  console.log('Task found:', task);
  console.log('currentEditingTaskId set to:', currentEditingTaskId);
  
  currentCatalogId = task.catalog_id;
  console.log('currentCatalogId set to:', currentCatalogId);
  
  // Заполняем форму
  document.getElementById('task-modal-title').textContent = 'Редактировать задачу';
  document.getElementById('task-input').value = task.name;
  document.getElementById('deadline-input').value = task.deadline ? new Date(task.deadline).toISOString().substr(0, 10) : '';
  
  console.log('Form filled with:', {
    name: task.name,
    deadline: task.deadline
  });
  
  // Установка сложности
  document.querySelectorAll('.complexity-btn').forEach(btn => {
    btn.classList.remove('selected');
    if (btn.dataset.complexity === (task.complexity || 'normal')) {
      btn.classList.add('selected');
      console.log('Selected complexity:', btn.dataset.complexity);
    }
  });
  
  // Установка дней повторения
  document.querySelectorAll('.day-btn').forEach(btn => {
    btn.classList.remove('selected');
    if (task.daily_tasks && task.daily_tasks.some(dt => dt.day_week === btn.dataset.day)) {
      btn.classList.add('selected');
      console.log('Selected day:', btn.dataset.day);
    }
  });
  
  console.log('Daily tasks:', task.daily_tasks);
  
  document.getElementById('delete-task-btn').style.display = 'block';
  document.getElementById('task-modal').style.display = 'flex';
  document.getElementById('task-input').focus();
  
  console.log('Modal opened');
  console.log('=== END EDIT TASK DEBUG ===');
}

// Сохранение задачи
async function saveTask() {
  const name = document.getElementById('task-input').value.trim();
  if (!name) return;
  
  const deadline = document.getElementById('deadline-input').value || null;
  
  const complexityBtn = document.querySelector('.complexity-btn.selected');
  const complexity = complexityBtn ? complexityBtn.dataset.complexity : 'normal';
  
  const repeatDays = Array.from(document.querySelectorAll('.day-btn.selected'))
                      .map(btn => btn.dataset.day);
  
  if (deadline && repeatDays.length > 0) {
    alert('Нельзя одновременно выбрать дедлайн и повторения!');
    return;
  }
  
  try {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    
    console.log('=== SAVE TASK DEBUG ===');
    console.log('currentEditingTaskId:', currentEditingTaskId);
    console.log('Task data:', { name, complexity, deadline, repeatDays });
    
    if (currentEditingTaskId) {
      // Обновление существующей задачи
      console.log('Updating existing task via PUT...');
      
      const updateData = {
        name: name,
        complexity: complexity,
        deadline: deadline
      };
      
      console.log('Sending PUT request to:', `${window.API_BASE_URL}/tasks/${currentEditingTaskId}`);
      console.log('Update data:', updateData);
      
      const response = await fetch(`${window.API_BASE_URL}/tasks/${currentEditingTaskId}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(updateData)
      });
      
      console.log('PUT response status:', response.status);
      console.log('PUT response ok:', response.ok);
      
      if (response.ok) {
        const updatedTask = await response.json();
        console.log('Task updated successfully:', updatedTask);
        
        // Обновляем локальную копию
        const taskIndex = tasks.findIndex(t => t.task_id == currentEditingTaskId);
        console.log('Task index in local array:', taskIndex);
        
        if (taskIndex !== -1) {
          console.log('Old task:', tasks[taskIndex]);
          tasks[taskIndex] = { ...tasks[taskIndex], ...updatedTask };
          console.log('New task:', tasks[taskIndex]);
        }
        
        // Обновляем ежедневные задачи если изменились
        if (repeatDays.length > 0) {
          console.log('Updating daily tasks...');
          
          // Получаем текущие ежедневные задачи
          const oldDailyResponse = await fetch(`${window.API_BASE_URL}/tasks/${currentEditingTaskId}/daily-tasks`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          
          if (oldDailyResponse.ok) {
            const dailyTasksData = await oldDailyResponse.json();
            console.log('Current daily tasks:', dailyTasksData);
            
            // Удаляем старые
            for (const dailyTask of dailyTasksData) {
              console.log('Deleting daily task:', dailyTask.daily_task_id);
              const deleteResponse = await fetch(`${window.API_BASE_URL}/daily-tasks/${dailyTask.daily_task_id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
              });
              console.log('Delete daily task response:', deleteResponse.status);
            }
          }
          
          // Создаем новые
          for (const day of repeatDays) {
            console.log('Creating daily task for day:', day);
            const createResponse = await fetch(`${window.API_BASE_URL}/daily-tasks/`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                task_id: parseInt(currentEditingTaskId),
                day_week: day
              })
            });
            console.log('Create daily task response:', createResponse.status);
          }
          
          // Перезагружаем задачи каталога
          console.log('Reloading catalog tasks...');
          await fetchCatalogTasks(currentCatalogId);
        }
      } else {
        const errorText = await response.text();
        console.error('Failed to update task. Status:', response.status);
        console.error('Error response:', errorText);
        alert(`Ошибка при обновлении задачи: ${response.status} - ${errorText}`);
        return;
      }
    } else {
      // Создание новой задачи
      console.log('Creating new task...');
      
      const response = await fetch(`${window.API_BASE_URL}/tasks/`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          catalog_id: currentCatalogId,
          name: name,
          complexity: complexity,
          deadline: deadline ? new Date(deadline).toISOString().split('T')[0] : null
        })
      });
      
      console.log('POST response status:', response.status);
      
      if (response.ok) {
        const newTask = await response.json();
        tasks.push(newTask);
        console.log('New task created:', newTask);
        
        // Добавляем ежедневные задачи если выбраны
        if (repeatDays.length > 0) {
          for (const day of repeatDays) {
            await fetch(`${window.API_BASE_URL}/daily-tasks/`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                task_id: newTask.task_id,
                day_week: day
              })
            });
          }
          
          // Обновляем задачу чтобы получить daily_tasks
          await fetchCatalogTasks(currentCatalogId);
        }
      } else {
        const errorText = await response.text();
        console.error('Failed to create task. Status:', response.status);
        console.error('Error response:', errorText);
        alert(`Ошибка при создании задачи: ${response.status} - ${errorText}`);
        return;
      }
    }
    
    console.log('=== END SAVE TASK DEBUG ===');
    
    renderTasks();
    document.getElementById('task-modal').style.display = 'none';
  } catch (error) {
    console.error("Error saving task:", error);
    alert("Ошибка при сохранении задачи. Пожалуйста, попробуйте снова.");
  }
}

// Удаление задачи
async function deleteTask(taskId) {
  if (!taskId) taskId = currentEditingTaskId;
  if (!taskId) return;
  
  try {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    
    const response = await fetch(`${window.API_BASE_URL}/tasks/${taskId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    if (response.ok) {
      tasks = tasks.filter(t => t.task_id !== taskId);
      renderTasks();
      if (document.getElementById('task-modal').style.display === 'flex') {
        document.getElementById('task-modal').style.display = 'none';
      }
    }
  } catch (error) {
    console.error("Error deleting task:", error);
    alert("Ошибка при удалении задачи. Пожалуйста, попробуйте снова.");
  }
}

// Создание нового каталога
async function createCatalog() {
  const catalogName = document.getElementById('catalog-input').value.trim();
  if (!catalogName) return;
  
  if (catalogs.some(c => c.name === catalogName)) {
    alert('Каталог с таким именем уже существует!');
    return;
  }
  
  try {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    
    const response = await fetch(`${window.API_BASE_URL}/catalogs/`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: catalogName,
        user_id: 0 // Будет заменен сервером на ID текущего пользователя
      })
    });
    
    if (response.ok) {
      const newCatalog = await response.json();
      catalogs.push(newCatalog);
      console.log('New catalog created:', newCatalog);
      renderCatalogs();
      document.getElementById('catalog-modal').style.display = 'none';
      document.getElementById('catalog-input').value = '';
    }
  } catch (error) {
    console.error("Error creating catalog:", error);
    alert("Ошибка при создании каталога. Пожалуйста, попробуйте снова.");
  }
}

// Удаление каталога
async function deleteCatalog(catalogId) {
  if (!confirm("Вы уверены, что хотите удалить этот каталог и все его задачи?")) {
    return;
  }
  
  try {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    
    const response = await fetch(`${window.API_BASE_URL}/catalogs/${catalogId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    if (response.ok) {
      catalogs = catalogs.filter(c => c.catalog_id !== catalogId);
      tasks = tasks.filter(t => t.catalog_id !== catalogId);
      console.log(`Catalog ${catalogId} deleted`);
      renderCatalogs();
    } else {
      console.error("Failed to delete catalog:", response.status);
      alert("Ошибка при удалении каталога. Пожалуйста, попробуйте снова.");
    }
  } catch (error) {
    console.error("Error deleting catalog:", error);
    alert("Ошибка при удалении каталога. Пожалуйста, попробуйте снова.");
  }
}

// Настройка обработчиков для кнопок сложности
function setupComplexityButtons() {
  document.querySelectorAll('.complexity-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.complexity-btn').forEach(b => b.classList.remove('selected'));
      this.classList.add('selected');
    });
  });
}

// Настройка обработчиков для кнопок дней недели
function setupDayButtons() {
  document.querySelectorAll('.day-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      this.classList.toggle('selected');
      
      // Если выбраны дни, сбрасываем дедлайн
      if (document.querySelectorAll('.day-btn.selected').length > 0) {
        document.getElementById('deadline-input').value = '';
      }
    });
  });
}

// Настройка обработчика для поля дедлайна
function setupDeadlineInput() {
  document.getElementById('deadline-input')?.addEventListener('change', function() {
    if (this.value) {
      // Если установлен дедлайн, сбрасываем выбор дней
      document.querySelectorAll('.day-btn.selected').forEach(btn => {
        btn.classList.remove('selected');
      });
    }
  });
}

// Настройка основных обработчиков событий
function setupMainEventListeners() {
  // Кнопка добавления задачи в календарь
  const addTaskCalendarBtn = document.getElementById('add-task-calendar-btn');
  if (addTaskCalendarBtn) {
    addTaskCalendarBtn.addEventListener('click', () => {
      console.log('Кнопка "Добавить задачу" нажата');
      
      if (catalogs.length > 0) {
        console.log('Каталоги найдены:', catalogs);
        openNewTaskModal(catalogs[0].catalog_id);
      } else {
        console.log('Каталоги не найдены, создаю дефолтный каталог');
        createDefaultCatalog().then(() => {
          if (catalogs.length > 0) {
            openNewTaskModal(catalogs[0].catalog_id);
          }
        });
      }
    });
  }
  
  // Кнопки модального окна задачи
  const cancelTaskBtn = document.getElementById('cancel-task-btn');
  if (cancelTaskBtn) {
    cancelTaskBtn.addEventListener('click', function() {
      document.getElementById('task-modal').style.display = 'none';
    });
  }
  
  const saveTaskBtn = document.getElementById('save-task-btn');
  if (saveTaskBtn) {
    saveTaskBtn.addEventListener('click', saveTask);
  }
  
  const deleteTaskBtn = document.getElementById('delete-task-btn');
  if (deleteTaskBtn) {
    deleteTaskBtn.addEventListener('click', () => deleteTask());
  }
  
  // Кнопка создания каталога
  const createCatalogBtn = document.getElementById('create-catalog-btn');
  if (createCatalogBtn) {
    createCatalogBtn.addEventListener('click', function() {
      document.getElementById('catalog-modal').style.display = 'flex';
      document.getElementById('catalog-input').focus();
    });
  }
  
  // Кнопка добавления каталога (альтернативная)
  const addCatalogBtn = document.getElementById('add-catalog-btn');
  if (addCatalogBtn) {
    addCatalogBtn.addEventListener('click', function() {
      console.log('Кнопка "Создать каталог" нажата');
      const catalogModal = document.getElementById('catalog-modal');
      console.log('Модальное окно каталога:', catalogModal);
      catalogModal.style.display = 'flex';
      document.getElementById('catalog-input').focus();
    });
  }
  
  // Кнопки модального окна каталога
  const cancelCatalogBtn = document.getElementById('cancel-catalog-btn');
  if (cancelCatalogBtn) {
    cancelCatalogBtn.addEventListener('click', function() {
      document.getElementById('catalog-modal').style.display = 'none';
      document.getElementById('catalog-input').value = '';
    });
  }
  
  const saveCatalogBtn = document.getElementById('save-catalog-btn');
  if (saveCatalogBtn) {
    saveCatalogBtn.addEventListener('click', createCatalog);
  }
  
  // Закрытие модальных окон при клике вне их
  window.addEventListener('click', function(event) {
    const taskModal = document.getElementById('task-modal');
    const catalogModal = document.getElementById('catalog-modal');
    
    if (event.target === taskModal) {
      taskModal.style.display = 'none';
    }
    
    if (event.target === catalogModal) {
      catalogModal.style.display = 'none';
      document.getElementById('catalog-input').value = '';
    }
  });
  
  // Enter в полях ввода
  const taskInput = document.getElementById('task-input');
  if (taskInput) {
    taskInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        saveTask();
      }
    });
  }
  
  const catalogInput = document.getElementById('catalog-input');
  if (catalogInput) {
    catalogInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        createCatalog();
      }
    });
  }
}

// Инициализация приложения
function initializeApp() {
  if (isInitialized) {
    console.log('App already initialized');
    return;
  }
  
  console.log('Initializing tasks app...');
  isInitialized = true;
  
  // Настраиваем все обработчики событий
  setupComplexityButtons();
  setupDayButtons();
  setupDeadlineInput();
  setupMainEventListeners();
  
  // Загружаем данные
  fetchCatalogs();
  
  console.log('Tasks app initialized successfully');
}

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, initializing tasks app...');
  
  // Небольшая задержка чтобы убедиться что все элементы загружены
  setTimeout(() => {
    initializeApp();
  }, 100);
});

// Обработка ошибок
window.addEventListener('error', function(e) {
  console.error('JavaScript error in tasks app:', e.error);
});

// Обработка необработанных промисов
window.addEventListener('unhandledrejection', function(e) {
  console.error('Unhandled promise rejection in tasks app:', e.reason);
});

// Экспорт функций для глобального доступа (если нужно)
window.tasksApp = {
  fetchCatalogs,
  renderTasks,
  openNewTaskModal,
  saveTask,
  deleteTask,
  createCatalog,
  deleteCatalog
};

console.log('Tasks script loaded successfully');