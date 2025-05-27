// API and WebSocket base URLs - using window object to avoid redeclaration
// Check if window.API_BASE_URL is already defined (from load-components-head.js)
if (typeof window.window.API_BASE_URL === 'undefined') {
  window.window.API_BASE_URL = "/api"; // Use window object to avoid redeclaration
}
const WS_PROTOCOL = window.location.protocol === "https:" ? "wss" : "ws";
const WS_BASE_URL = `${WS_PROTOCOL}://${window.location.host}${window.window.API_BASE_URL}`; // Using window.API_BASE_URL for WebSocket URL

// Store for tasks and catalogs
let tasks = [];
let catalogs = [];
let currentEditingTaskId = null;
let currentCatalogId = null;

// Fetch user's catalogs from API
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
      renderCatalogs();
    } else {
      console.error("Failed to fetch catalogs:", response.status);
      // Create default catalog if none exists
      createDefaultCatalog();
    }
  } catch (error) {
    console.error("Error fetching catalogs:", error);
    createDefaultCatalog();
  }
}

// Create a default catalog if user has none
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
        user_id: 0 // Will be replaced by server with current user's ID
      })
    });

    if (response.ok) {
      const newCatalog = await response.json();
      catalogs = [newCatalog];
      renderCatalogs();
    }
  } catch (error) {
    console.error("Error creating default catalog:", error);
  }
}

// Fetch tasks for a specific catalog
async function fetchCatalogTasks(catalogId) {
  try {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    const response = await fetch(`${window.API_BASE_URL}/catalogs/${catalogId}/tasks`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (response.ok) {
      const catalogTasks = await response.json();
      // Merge with existing tasks, replacing any with same ID
      tasks = tasks.filter(t => t.catalog_id !== catalogId);
      tasks = [...tasks, ...catalogTasks];
      renderTasks();
    }
  } catch (error) {
    console.error(`Error fetching tasks for catalog ${catalogId}:`, error);
  }
}

// Fetch all tasks for all catalogs
async function fetchAllTasks() {
  tasks = [];
  for (const catalog of catalogs) {
    await fetchCatalogTasks(catalog.catalog_id);
  }
}

// Render catalogs in the UI
function renderCatalogs() {
  const container = document.getElementById('catalogs-container');
  if (!container) return;
  
  // Clear container
  container.innerHTML = '';
  
  // Add each catalog
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
  
  // Add event listeners
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
  
  // Fetch tasks for each catalog
  fetchAllTasks();
}

// Render tasks in the UI
// Render tasks in the UI
function renderTasks() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Clear all task lists
  document.querySelectorAll('.tasks-list').forEach(list => {
    list.innerHTML = '';
  });
  
  // Clear calendar
  const calendarContent = document.getElementById('calendar-content');
  if (calendarContent) {
    calendarContent.innerHTML = '';
  }
  
  // Group tasks for calendar
  const calendarTasks = {};
  
  // Group tasks by catalog and date
  const catalogTasks = {};
  
  // Process all tasks
  tasks.forEach(task => {
    // Initialize catalog tasks object if not exists
    if (!catalogTasks[task.catalog_id]) {
      catalogTasks[task.catalog_id] = {
        withDate: {},
        withoutDate: []
      };
    }
    
    // Group by date for catalog display
    if (task.deadline) {
      const deadlineDate = new Date(task.deadline);
      deadlineDate.setHours(0, 0, 0, 0);
      const dateStr = deadlineDate.toLocaleDateString('ru-RU');
      
      if (!catalogTasks[task.catalog_id].withDate[dateStr]) {
        catalogTasks[task.catalog_id].withDate[dateStr] = [];
      }
      
      catalogTasks[task.catalog_id].withDate[dateStr].push(task);
    } else {
      catalogTasks[task.catalog_id].withoutDate.push(task);
    }
    
    // Add task to calendar if it has a deadline
    if (task.deadline) {
      addTaskToCalendar(task, calendarTasks, today);
    }
    
    // Add task to calendar if it has daily repetitions
    if (task.daily_tasks && task.daily_tasks.length > 0) {
      addTaskToCalendar(task, calendarTasks, today);
    }
  });
  
  // Render tasks in catalogs
  for (const catalogId in catalogTasks) {
    const catalogData = catalogTasks[catalogId];
    const tasksList = document.getElementById(`tasks-${catalogId}`);
    
  if (tasksList) {
    // Render tasks with dates first, sorted by date
    const sortedDates = Object.keys(catalogData.withDate).sort((a, b) => {
      // Преобразуем даты из формата DD.MM.YYYY в объекты Date для корректного сравнения
      const [dayA, monthA, yearA] = a.split('.');
      const [dayB, monthB, yearB] = b.split('.');
      
      const dateA = new Date(yearA, monthA - 1, dayA);
      const dateB = new Date(yearB, monthB - 1, dayB);
      
      return dateA - dateB;
    });
      
      sortedDates.forEach(dateStr => {
        // Create date header
        const dateHeader = document.createElement('div');
        dateHeader.className = 'date-header';
        dateHeader.textContent = dateStr;
        tasksList.appendChild(dateHeader);
        
        // Create task group container
        const taskGroup = document.createElement('div');
        taskGroup.className = 'task-group';
        tasksList.appendChild(taskGroup);
        
        // Add tasks for this date
        catalogData.withDate[dateStr].forEach(task => {
          addTaskToGroup(task, taskGroup);
        });
      });
      
      // Render tasks without date
      if (catalogData.withoutDate.length > 0) {
        // Create "No date" header
        const noDateHeader = document.createElement('div');
        noDateHeader.className = 'date-header no-date';
        noDateHeader.textContent = 'Без даты';
        tasksList.appendChild(noDateHeader);
        
        // Create task group container
        const taskGroup = document.createElement('div');
        taskGroup.className = 'task-group';
        tasksList.appendChild(taskGroup);
        
        // Add tasks without date
        catalogData.withoutDate.forEach(task => {
          addTaskToGroup(task, taskGroup);
        });
      }
    }
  }
  
  // Render calendar tasks
  renderCalendarTasks(calendarTasks);
}

function addTaskToGroup(task, taskGroup) {
  const taskItem = document.createElement('div');
  taskItem.className = 'task-item';
  taskItem.dataset.taskId = task.task_id;
  
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'task-checkbox';
  checkbox.checked = task.completed === 'true';
  
  const taskText = document.createElement('span');
  taskText.className = 'task-text' + (task.completed === 'true' ? ' completed' : '');
  taskText.textContent = task.name;
  
  // Add complexity indicator
  const complexityIndicator = document.createElement('span');
  complexityIndicator.className = `complexity-indicator ${task.complexity}`;
  complexityIndicator.textContent = {
    'easy': '⚪',
    'normal': '🔵',
    'hard': '🔴'
  }[task.complexity] || '🔵';
  
  checkbox.addEventListener('change', function() {
    task.completed = this.checked;
    taskText.classList.toggle('completed', this.checked);
    updateTaskCompletion(task.task_id, this.checked);
  });
  
  taskItem.appendChild(checkbox);
  taskItem.appendChild(taskText);
  taskItem.appendChild(complexityIndicator);
  taskGroup.appendChild(taskItem);
  
  // Edit task on click
  taskItem.addEventListener('click', (e) => {
    if (e.target !== checkbox) {
      editTask(task.task_id);
    }
  });
}

// Add a task to its catalog in the UI
function addTaskToCatalog(task, listId) {
  const tasksList = document.getElementById(listId);
  if (!tasksList) return;
  
  const taskItem = document.createElement('li');
  taskItem.className = 'task-item';
  taskItem.dataset.taskId = task.task_id;
  
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'task-checkbox';
  checkbox.checked = task.completed === 'true';
  
  const taskText = document.createElement('span');
  taskText.className = 'task-text' + (task.completed === 'true' ? ' completed' : '');
  taskText.textContent = task.name;
  
  // Add complexity indicator
  const complexityIndicator = document.createElement('span');
  complexityIndicator.className = `complexity-indicator ${task.complexity}`;
  complexityIndicator.textContent = {
    'easy': '⚪',
    'normal': '🔵',
    'hard': '🔴'
  }[task.complexity] || '🔵';
  
  checkbox.addEventListener('change', function() {
    task.completed = this.checked;
    taskText.classList.toggle('completed', this.checked);
    updateTaskCompletion(task.task_id, this.checked);
  });
  
  taskItem.appendChild(checkbox);
  taskItem.appendChild(taskText);
  taskItem.appendChild(complexityIndicator);
  tasksList.appendChild(taskItem);
  
  // Edit task on click
  taskItem.addEventListener('click', (e) => {
    if (e.target !== checkbox) {
      editTask(task.task_id);
    }
  });
}

// Add a task to the calendar
function addTaskToCalendar(task, calendarTasks, today) {
  // Tasks with deadline
  if (task.deadline) {
    const deadlineDate = new Date(task.deadline);
    deadlineDate.setHours(0, 0, 0, 0);
    const dateStr = deadlineDate.toLocaleDateString('ru-RU');
    
    if (!calendarTasks[dateStr]) {
      calendarTasks[dateStr] = [];
    }
    
    // Check if task is already in this date
    if (!calendarTasks[dateStr].some(t => t.task_id === task.task_id)) {
      calendarTasks[dateStr].push(task);
    }
  }
  
  // Tasks with daily repetitions
  if (task.daily_tasks && task.daily_tasks.length > 0) {
    const nextDate = getNextRepeatDate(task.daily_tasks, today);
    if (nextDate) {
      const dateStr = nextDate.toLocaleDateString('ru-RU');
      
      if (!calendarTasks[dateStr]) {
        calendarTasks[dateStr] = [];
      }
      
      // Check if task is already in this date
      if (!calendarTasks[dateStr].some(t => t.task_id === task.task_id)) {
        calendarTasks[dateStr].push(task);
      }
    }
  }
}

// Get the next repeat date for a task
function getNextRepeatDate(dailyTasks, fromDate) {
  const dayMap = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 };
  const todayDay = fromDate.getDay();
  
  // Find the closest repeat day
  let minDiff = 7;
  dailyTasks.forEach(dailyTask => {
    const dayNumber = dayMap[dailyTask.day_week];
    let diff = dayNumber - todayDay;
    if (diff <= 0) diff += 7;
    if (diff < minDiff) minDiff = diff;
  });
  
  // Create next execution date
  const nextDate = new Date(fromDate);
  nextDate.setDate(nextDate.getDate() + minDiff);
  return nextDate;
}

// Render tasks in the calendar
function renderCalendarTasks(calendarTasks) {
  const calendarContent = document.getElementById('calendar-content');
  if (!calendarContent) return;
  
  // Sort dates
  const sortedDates = Object.keys(calendarTasks).sort((a, b) => {
    return new Date(a) - new Date(b);
  });
  
  // Display tasks by date
  sortedDates.forEach(date => {
    const dayElement = document.createElement('div');
    dayElement.className = 'calendar-day';
    
    const dateElement = document.createElement('div');
    dateElement.className = 'calendar-date';
    dateElement.textContent = date;
    dayElement.appendChild(dateElement);
    
    calendarTasks[date].forEach(task => {
      const taskElement = document.createElement('div');
      taskElement.className = 'task-item';
      taskElement.style.margin = '5px 0';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'task-checkbox';
      checkbox.checked = task.completed || false;
      checkbox.style.marginRight = '10px';
      
      const taskText = document.createElement('span');
      taskText.className = 'task-text' + (task.completed ? ' completed' : '');
      taskText.textContent = task.name;
      
      // Add complexity indicator
      const complexityIndicator = document.createElement('span');
      complexityIndicator.className = `complexity-indicator ${task.complexity}`;
      complexityIndicator.textContent = {
        'easy': '⚪',
        'normal': '🔵',
        'hard': '🔴'
      }[task.complexity] || '🔵';
      complexityIndicator.style.marginLeft = '10px';
      
      checkbox.addEventListener('change', function() {
        task.completed = this.checked;
        taskText.classList.toggle('completed', this.checked);
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

// Update task completion status
async function updateTaskCompletion(taskId, completed) {
  try {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    // In this implementation, we're not actually updating completion status
    // as it's not part of the task schema. This would need to be implemented
    // in a real application.
    console.log(`Task ${taskId} completion status: ${completed}`);
  } catch (error) {
    console.error(`Error updating task ${taskId} completion:`, error);
  }
}

// Open modal for new task
function openNewTaskModal(catalogId) {
  currentEditingTaskId = null;
  currentCatalogId = catalogId;
  
  document.getElementById('task-modal-title').textContent = 'Новая задача';
  document.getElementById('task-input').value = '';
  document.getElementById('deadline-input').value = '';
  
  // Reset complexity selection
  document.querySelectorAll('.complexity-btn').forEach(btn => {
    btn.classList.remove('selected');
  });
  document.querySelector('.complexity-btn[data-complexity="normal"]').classList.add('selected');
  
  // Reset day selection
  document.querySelectorAll('.day-btn').forEach(btn => {
    btn.classList.remove('selected');
  });
  
  document.getElementById('delete-task-btn').style.display = 'none';
  document.getElementById('task-modal').style.display = 'flex';
  document.getElementById('task-input').focus();
}

// Open modal for editing task
async function editTask(taskId) {
  const task = tasks.find(t => t.task_id === taskId);
  if (!task) return;
  
  currentEditingTaskId = taskId;
  currentCatalogId = task.catalog_id;
  
  document.getElementById('task-modal-title').textContent = 'Редактировать задачу';
  document.getElementById('task-input').value = task.name;
  document.getElementById('deadline-input').value = task.deadline ? new Date(task.deadline).toISOString().substr(0, 10) : '';
  
  // Set complexity
  document.querySelectorAll('.complexity-btn').forEach(btn => {
    btn.classList.remove('selected');
    if (btn.dataset.complexity === (task.complexity || 'normal')) {
      btn.classList.add('selected');
    }
  });
  
  // Set repeat days
  document.querySelectorAll('.day-btn').forEach(btn => {
    btn.classList.remove('selected');
    if (task.daily_tasks && task.daily_tasks.some(dt => dt.day_week === btn.dataset.day)) {
      btn.classList.add('selected');
    }
  });
  
  document.getElementById('delete-task-btn').style.display = 'block';
  document.getElementById('task-modal').style.display = 'flex';
  document.getElementById('task-input').focus();
}

// Save task
async function saveTask() {
  const name = document.getElementById('task-input').value.trim();
  if (!name) return;
  
  const deadline = document.getElementById('deadline-input').value || null;
  
  // Get selected complexity
  const complexityBtn = document.querySelector('.complexity-btn.selected');
  const complexity = complexityBtn ? complexityBtn.dataset.complexity : 'normal';
  
  // Get selected repeat days
  const repeatDays = Array.from(document.querySelectorAll('.day-btn.selected'))
                      .map(btn => btn.dataset.day);
  
  // Check that deadline and repeat days are not both selected
  if (deadline && repeatDays.length > 0) {
    alert('Нельзя одновременно выбрать дедлайн и повторения!');
    return;
  }
  
  try {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    
    if (currentEditingTaskId) {
      // Update existing task
      // Note: In a real implementation, you would update the task via API
      // For now, we'll just update it locally
      const taskIndex = tasks.findIndex(t => t.task_id === currentEditingTaskId);
      if (taskIndex !== -1) {
        tasks[taskIndex].name = name;
        tasks[taskIndex].complexity = complexity;
        tasks[taskIndex].deadline = deadline ? new Date(deadline).toISOString() : null;
        // Update daily tasks would be handled separately
      }
    } else {
      // Create new task
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
          // Поле experience_reward удалено, так как оно отсутствует в модели Task на бэкенде
        })
      });
      
      if (response.ok) {
        const newTask = await response.json();
        tasks.push(newTask);
        
        // Add daily tasks if selected
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
          
          // Refresh task to get daily_tasks
          await fetchCatalogTasks(currentCatalogId);
        }
      }
    }
    
    renderTasks();
    document.getElementById('task-modal').style.display = 'none';
  } catch (error) {
    console.error("Error saving task:", error);
    alert("Ошибка при сохранении задачи. Пожалуйста, попробуйте снова.");
  }
}

// Delete task
async function deleteTask() {
  if (!currentEditingTaskId) return;
  
  try {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    
    const response = await fetch(`${window.API_BASE_URL}/tasks/${currentEditingTaskId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    if (response.ok) {
      tasks = tasks.filter(t => t.task_id !== currentEditingTaskId);
      renderTasks();
      document.getElementById('task-modal').style.display = 'none';
    }
  } catch (error) {
    console.error("Error deleting task:", error);
    alert("Ошибка при удалении задачи. Пожалуйста, попробуйте снова.");
  }
}

// Create new catalog
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
        user_id: 0 // Will be replaced by server with current user's ID
      })
    });
    
    if (response.ok) {
      const newCatalog = await response.json();
      catalogs.push(newCatalog);
      renderCatalogs();
      document.getElementById('catalog-modal').style.display = 'none';
      document.getElementById('catalog-input').value = '';
    }
  } catch (error) {
    console.error("Error creating catalog:", error);
    alert("Ошибка при создании каталога. Пожалуйста, попробуйте снова.");
  }
}

// Delete catalog
async function deleteCatalog(catalogId) {
  // Confirm deletion
  if (!confirm("Вы уверены, что хотите удалить этот каталог и все его задачи?")) {
    return;
  }
  
  try {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    
    // Вызываем API для удаления каталога и всех его задач
    const response = await fetch(`${window.API_BASE_URL}/catalogs/${catalogId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    if (response.ok) {
      // Удаляем каталог и его задачи из локального хранилища
      catalogs = catalogs.filter(c => c.catalog_id !== catalogId);
      tasks = tasks.filter(t => t.catalog_id !== catalogId);
      
      // Обновляем UI
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

// Initialize
document.addEventListener('DOMContentLoaded', function() {
  // Fetch catalogs and tasks
  fetchCatalogs();
  
  // Set up complexity button handlers
  document.querySelectorAll('.complexity-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.complexity-btn').forEach(b => b.classList.remove('selected'));
      this.classList.add('selected');
    });
  });
  
  // Set up day button handlers
  document.querySelectorAll('.day-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      this.classList.toggle('selected');
      
      // If days are selected, reset deadline
      if (document.querySelectorAll('.day-btn.selected').length > 0) {
        document.getElementById('deadline-input').value = '';
      }
    });
  });
  
  // Set up deadline input handler
  document.getElementById('deadline-input').addEventListener('change', function() {
    if (this.value) {
      // If deadline is set, reset day selection
      document.querySelectorAll('.day-btn.selected').forEach(btn => {
        btn.classList.remove('selected');
      });
    }
  });
  
  // Set up button handlers
  document.getElementById('add-task-calendar-btn')?.addEventListener('click', () => {
    console.log('Кнопка "Добавить задачу" нажата');
    const taskModal = document.getElementById('task-modal');
    console.log('Модальное окно задачи:', taskModal);
    
    // Find first catalog or create one
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
  
  document.getElementById('cancel-task-btn')?.addEventListener('click', function() {
    document.getElementById('task-modal').style.display = 'none';
  });
  
  document.getElementById('save-task-btn')?.addEventListener('click', saveTask);
  document.getElementById('delete-task-btn')?.addEventListener('click', deleteTask);
  
  document.getElementById('create-catalog-btn')?.addEventListener('click', function() {
    document.getElementById('catalog-modal').style.display = 'flex';
    document.getElementById('catalog-input').focus();
  });
  
  // Добавляем обработчик для кнопки создания каталога с правильным ID
  document.getElementById('add-catalog-btn')?.addEventListener('click', function() {
    console.log('Кнопка "Создать каталог" нажата');
    const catalogModal = document.getElementById('catalog-modal');
    console.log('Модальное окно каталога:', catalogModal);
    catalogModal.style.display = 'flex';
    document.getElementById('catalog-input').focus();
  });
  
  document.getElementById('cancel-catalog-btn')?.addEventListener('click', function() {
    document.getElementById('catalog-modal').style.display = 'none';
  });
  
  document.getElementById('save-catalog-btn')?.addEventListener('click', createCatalog);
  
  // Close modals when clicking outside
  window.addEventListener('click', function(event) {
    const taskModal = document.getElementById('task-modal');
    const catalogModal = document.getElementById('catalog-modal');
    
    if (event.target === taskModal) {
      taskModal.style.display = 'none';
    }
    
    if (event.target === catalogModal) {
      catalogModal.style.display = 'none';
    }
  });
});


// Update task completion status
async function updateTaskCompletion(taskId, completed) {
  try {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    // Отправляем PATCH-запрос для обновления статуса выполнения задачи
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
      // Обновляем задачу в локальном массиве
      const taskIndex = tasks.findIndex(t => t.task_id === taskId);
      if (taskIndex !== -1) {
        tasks[taskIndex].completed = updatedTask.completed;
      }
      console.log(`Task ${taskId} completion status updated to: ${completed ? 'true' : 'false'}`);
    } else {
      console.error(`Failed to update task ${taskId} completion status:`, response.status);
      // Откатываем изменения в UI, если запрос не удался
      const taskElements = document.querySelectorAll(`[data-task-id="${taskId}"]`);
      taskElements.forEach(element => {
        const checkbox = element.querySelector('.task-checkbox');
        const taskText = element.querySelector('.task-text');
        if (checkbox) {
          checkbox.checked = !completed; // Возвращаем предыдущее состояние
        }
        if (taskText) {
          taskText.classList.toggle('completed', !completed);
        }
      });
    }
  } catch (error) {
    console.error(`Error updating task ${taskId} completion:`, error);
    // Откатываем изменения в UI в случае ошибки
    const taskElements = document.querySelectorAll(`[data-task-id="${taskId}"]`);
    taskElements.forEach(element => {
      const checkbox = element.querySelector('.task-checkbox');
      const taskText = element.querySelector('.task-text');
      if (checkbox) {
        checkbox.checked = !completed; // Возвращаем предыдущее состояние
      }
      if (taskText) {
        taskText.classList.toggle('completed', !completed);
      }
    });
  }
}
