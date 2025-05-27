   // Хранилище задач и каталогов
   let tasks = [];
   let catalogs = ['Мой календарь'];
   let currentEditingTaskId = null;
   let currentCatalogId = null;
   
   // Генерация ID
   function generateId() {
     return Date.now().toString(36) + Math.random().toString(36).substr(2);
   }
   
   // Отображение каталогов
   function renderCatalogs() {
     const container = document.getElementById('catalogs-container');
     
     // Очищаем все каталоги, кроме первого (Мой календарь)
     while (container.children.length > 1) {
       container.removeChild(container.lastChild);
     }
     
     // Добавляем пользовательские каталоги
     catalogs.slice(1).forEach((catalog, index) => {
       const catalogId = `catalog-${index+1}`;
       
       const catalogElement = document.createElement('div');
       catalogElement.className = 'catalog';
       catalogElement.id = catalogId;
       
       catalogElement.innerHTML = `
         <div class="catalog-header">
           <h2 class="catalog-title">${catalog}</h2>
           <div class="catalog-actions">
             <button class="btn-task add-task-btn" data-catalog="${catalogId}">+</button>
             <button class="delete-catalog-btn" data-catalog="${catalogId}">🗑️</button>
           </div>
         </div>
         <div class="catalog-content">
           <ul class="tasks-list" id="${catalogId}-tasks"></ul>
         </div>
       `;
       
       container.appendChild(catalogElement);
     });
     
     // Назначаем обработчики для кнопок добавления задач
     document.querySelectorAll('.add-task-btn').forEach(btn => {
       btn.addEventListener('click', function() {
         openNewTaskModal(this.dataset.catalog);
       });
     });
     
     // Назначаем обработчики для кнопок удаления каталогов
     document.querySelectorAll('.delete-catalog-btn').forEach(btn => {
       btn.addEventListener('click', function(e) {
         e.stopPropagation();
         deleteCatalog(this.dataset.catalog);
       });
     });
     
     renderTasks();
   }
   
   // Отображение задач
   function renderTasks() {
     const today = new Date();
     today.setHours(0, 0, 0, 0);
     
     // Очищаем все списки задач
     document.querySelectorAll('.tasks-list').forEach(list => {
       list.innerHTML = '';
     });
     
     // Очищаем календарь
     document.getElementById('calendar-content').innerHTML = '';
     
     // Группировка задач для календаря
     const calendarTasks = {};
     
     // Добавляем задачи в соответствующие каталоги
     tasks.forEach(task => {
       // Добавляем задачу в свой каталог (если есть)
       if (task.catalog) {
         addTaskToCatalog(task, `${task.catalog}-tasks`);
       }
       
       // Добавляем задачу в календарь (если есть дата или повторения)
       if (task.deadline || (task.repeatDays && task.repeatDays.length > 0)) {
         addTaskToCalendar(task, calendarTasks, today);
       }
     });
     
     // Сортируем и отображаем задачи в календаре
     renderCalendarTasks(calendarTasks);
   }
   
   // Добавление задачи в каталог
   function addTaskToCatalog(task, listId) {
     const tasksList = document.getElementById(listId);
     if (!tasksList) return;
     
     const taskItem = document.createElement('li');
     taskItem.className = 'task-item';
     taskItem.dataset.taskId = task.id;
     
     const checkbox = document.createElement('input');
     checkbox.type = 'checkbox';
     checkbox.className = 'task-checkbox';
     checkbox.checked = task.completed;
     
     const taskText = document.createElement('span');
     taskText.className = 'task-text' + (task.completed ? ' completed' : '');
     taskText.textContent = task.text;
     
     checkbox.addEventListener('change', function() {
       task.completed = this.checked;
       taskText.classList.toggle('completed', this.checked);
       saveDataToLocalStorage();
     });
     
     taskItem.appendChild(checkbox);
     taskItem.appendChild(taskText);
     tasksList.appendChild(taskItem);
     
     // Обработчик для редактирования задачи
     taskItem.addEventListener('click', (e) => {
       if (e.target !== checkbox) {
         editTask(task.id, task.catalog || 'calendar-catalog');
       }
     });
   }
   
   // Добавление задачи в календарь
   function addTaskToCalendar(task, calendarTasks, today) {
     // Задачи с дедлайном
     if (task.deadline) {
       const deadlineDate = new Date(task.deadline);
       deadlineDate.setHours(0, 0, 0, 0);
       const dateStr = deadlineDate.toLocaleDateString('ru-RU');
       
       if (!calendarTasks[dateStr]) {
         calendarTasks[dateStr] = [];
       }
       
       // Проверяем, нет ли уже этой задачи на эту дату
       if (!calendarTasks[dateStr].some(t => t.id === task.id)) {
         calendarTasks[dateStr].push(task);
       }
     }
     
     // Задачи с повторениями
     if (task.repeatDays && task.repeatDays.length > 0) {
       const nextDate = getNextRepeatDate(task.repeatDays, today);
       if (nextDate) {
         const dateStr = nextDate.toLocaleDateString('ru-RU');
         
         if (!calendarTasks[dateStr]) {
           calendarTasks[dateStr] = [];
         }
         
         // Проверяем, нет ли уже этой задачи на эту дату
         if (!calendarTasks[dateStr].some(t => t.id === task.id)) {
           calendarTasks[dateStr].push(task);
         }
       }
     }
   }
   
   // Получение следующей даты для повторяющейся задачи
   function getNextRepeatDate(repeatDays, fromDate) {
     const dayMap = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 };
     const todayDay = fromDate.getDay();
     
     // Находим ближайший день повторения
     let minDiff = 7;
     repeatDays.forEach(day => {
       const dayNumber = dayMap[day];
       let diff = dayNumber - todayDay;
       if (diff <= 0) diff += 7;
       if (diff < minDiff) minDiff = diff;
     });
     
     // Создаем дату следующего выполнения
     const nextDate = new Date(fromDate);
     nextDate.setDate(nextDate.getDate() + minDiff);
     return nextDate;
   }
   
   // Отображение задач в календаре
   function renderCalendarTasks(calendarTasks) {
     const calendarContent = document.getElementById('calendar-content');
     
     // Сортируем даты
     const sortedDates = Object.keys(calendarTasks).sort((a, b) => {
       return new Date(a) - new Date(b);
     });
     
     // Отображаем задачи по датам
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
         checkbox.checked = task.completed;
         checkbox.style.marginRight = '10px';
         
         const taskText = document.createElement('span');
         taskText.className = 'task-text' + (task.completed ? ' completed' : '');
         taskText.textContent = task.text;
         
         checkbox.addEventListener('change', function() {
           task.completed = this.checked;
           taskText.classList.toggle('completed', this.checked);
           saveDataToLocalStorage();
         });
         
         taskElement.addEventListener('click', (e) => {
           if (e.target !== checkbox) {
             editTask(task.id, 'calendar-catalog');
           }
         });
         
         taskElement.appendChild(checkbox);
         taskElement.appendChild(taskText);
         dayElement.appendChild(taskElement);
       });
       
       calendarContent.appendChild(dayElement);
     });
   }
   
   // Открытие модального окна для новой задачи
   function openNewTaskModal(catalogId = 'calendar-catalog') {
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
     
     // Сброс выбора дней недели
     document.querySelectorAll('.day-btn').forEach(btn => {
       btn.classList.remove('selected');
     });
     
     document.getElementById('delete-task-btn').style.display = 'none';
     document.getElementById('task-modal').style.display = 'flex';
     document.getElementById('task-input').focus();
   }
   
   // Открытие модального окна для редактирования задачи
   function editTask(taskId, catalogId) {
     const task = tasks.find(t => t.id === taskId);
     if (!task) return;
     
     currentEditingTaskId = taskId;
     currentCatalogId = catalogId;
     
     document.getElementById('task-modal-title').textContent = 'Редактировать задачу';
     document.getElementById('task-input').value = task.text;
     document.getElementById('deadline-input').value = task.deadline ? new Date(task.deadline).toISOString().substr(0, 10) : '';
     
     // Установка сложности
     document.querySelectorAll('.complexity-btn').forEach(btn => {
       btn.classList.remove('selected');
       if (btn.dataset.complexity === (task.complexity || 'normal')) {
         btn.classList.add('selected');
       }
     });
     
     // Установка дней повторения
     document.querySelectorAll('.day-btn').forEach(btn => {
       btn.classList.remove('selected');
       if (task.repeatDays && task.repeatDays.includes(btn.dataset.day)) {
         btn.classList.add('selected');
       }
     });
     
     document.getElementById('delete-task-btn').style.display = 'block';
     document.getElementById('task-modal').style.display = 'flex';
     document.getElementById('task-input').focus();
   }
   
   // Сохранение задачи
   function saveTask() {
     const text = document.getElementById('task-input').value.trim();
     if (!text) return;
     
     const deadline = document.getElementById('deadline-input').value || null;
     
     // Получаем выбранную сложность
     const complexityBtn = document.querySelector('.complexity-btn.selected');
     const complexity = complexityBtn ? complexityBtn.dataset.complexity : 'normal';
     
     // Получаем выбранные дни повторения
     const repeatDays = Array.from(document.querySelectorAll('.day-btn.selected'))
                          .map(btn => btn.dataset.day);
     
     // Проверка, что не выбраны одновременно дедлайн и повторения
     if (deadline && repeatDays.length > 0) {
       alert('Нельзя одновременно выбрать дедлайн и повторения!');
       return;
     }
     
     const taskData = {
       text,
       complexity,
       deadline: deadline ? new Date(deadline).toISOString() : null,
       repeatDays: repeatDays.length > 0 ? repeatDays : null,
       completed: false,
       catalog: currentCatalogId !== 'calendar-catalog' ? currentCatalogId : null
     };
     
     if (currentEditingTaskId) {
       // Редактирование существующей задачи
       const taskIndex = tasks.findIndex(t => t.id === currentEditingTaskId);
       if (taskIndex !== -1) {
         tasks[taskIndex] = { ...tasks[taskIndex], ...taskData };
       }
     } else {
       // Добавление новой задачи
       taskData.id = generateId();
       tasks.push(taskData);
     }
     
     saveDataToLocalStorage();
     renderTasks();
     document.getElementById('task-modal').style.display = 'none';
   }
   
   // Удаление задачи
   function deleteTask() {
     if (!currentEditingTaskId) return;
     
     tasks = tasks.filter(t => t.id !== currentEditingTaskId);
     saveDataToLocalStorage();
     renderTasks();
     document.getElementById('task-modal').style.display = 'none';
   }
   
   // Создание нового каталога
   function createCatalog() {
     const catalogName = document.getElementById('catalog-input').value.trim();
     if (!catalogName) return;
     
     if (catalogs.includes(catalogName)) {
       alert('Каталог с таким именем уже существует!');
       return;
     }
     
     catalogs.push(catalogName);
     saveDataToLocalStorage();
     renderCatalogs();
     document.getElementById('catalog-modal').style.display = 'none';
     document.getElementById('catalog-input').value = '';
   }
   
   // Удаление каталога
   function deleteCatalog(catalogId) {
     // Нельзя удалить каталог "Мой календарь"
     if (catalogId === 'calendar-catalog') return;
     
     // Удаляем задачи из этого каталога
     tasks = tasks.filter(task => task.catalog !== catalogId);
     
     // Удаляем каталог
     const catalogIndex = catalogs.findIndex((c, i) => `catalog-${i+1}` === catalogId);
     if (catalogIndex !== -1) {
       catalogs.splice(catalogIndex, 1);
     }
     
     saveDataToLocalStorage();
     renderCatalogs();
   }
   
   // Сохранение данных в localStorage
   function saveDataToLocalStorage() {
     localStorage.setItem('tasks', JSON.stringify(tasks));
     localStorage.setItem('catalogs', JSON.stringify(catalogs));
   }
   
   // Загрузка данных из localStorage
   function loadDataFromLocalStorage() {
     const savedTasks = localStorage.getItem('tasks');
     const savedCatalogs = localStorage.getItem('catalogs');
     
     if (savedTasks) {
       tasks = JSON.parse(savedTasks);
     }
     
     if (savedCatalogs) {
       catalogs = JSON.parse(savedCatalogs);
     } else {
       catalogs = ['Мой календарь'];
     }
     
     renderCatalogs();
   }
   
   // Инициализация
   document.addEventListener('DOMContentLoaded', function() {
     loadDataFromLocalStorage();
     
     // Обработчики для кнопок сложности
     document.querySelectorAll('.complexity-btn').forEach(btn => {
       btn.addEventListener('click', function() {
         document.querySelectorAll('.complexity-btn').forEach(b => b.classList.remove('selected'));
         this.classList.add('selected');
       });
     });
     
     // Обработчики для кнопок дней недели
     document.querySelectorAll('.day-btn').forEach(btn => {
       btn.addEventListener('click', function() {
         this.classList.toggle('selected');
         
         // Если выбраны дни, сбрасываем дедлайн
         if (document.querySelectorAll('.day-btn.selected').length > 0) {
           document.getElementById('deadline-input').value = '';
         }
       });
     });
     
     // Обработчик для поля дедлайна
     document.getElementById('deadline-input').addEventListener('change', function() {
       if (this.value) {
         // Если установлен дедлайн, сбрасываем выбор дней
         document.querySelectorAll('.day-btn.selected').forEach(btn => {
           btn.classList.remove('selected');
         });
       }
     });
     
     // Обработчики кнопок
     document.getElementById('add-task-calendar-btn').addEventListener('click', () => openNewTaskModal('calendar-catalog'));
     
     document.getElementById('cancel-task-btn').addEventListener('click', function() {
       document.getElementById('task-modal').style.display = 'none';
     });
     
     document.getElementById('save-task-btn').addEventListener('click', saveTask);
     document.getElementById('delete-task-btn').addEventListener('click', deleteTask);
     
     document.getElementById('create-catalog-btn').addEventListener('click', function() {
       document.getElementById('catalog-modal').style.display = 'flex';
       document.getElementById('catalog-input').focus();
     });
     
     document.getElementById('cancel-catalog-btn').addEventListener('click', function() {
       document.getElementById('catalog-modal').style.display = 'none';
       document.getElementById('catalog-input').value = '';
     });
     
     document.getElementById('save-catalog-btn').addEventListener('click', createCatalog);
     
     window.addEventListener('click', function(event) {
       if (event.target.className === 'modal') {
         event.target.style.display = 'none';
       }
     });
     
     // Примеры задач для демонстрации
     if (tasks.length === 0) {
       const today = new Date();
       const nextWeek = new Date(today);
       nextWeek.setDate(nextWeek.getDate() + 7);
       
       tasks = [
         {
           id: generateId(),
           text: 'Сделать диплом',
           complexity: 'hard',
           deadline: nextWeek.toISOString(),
           repeatDays: null,
           completed: false,
           catalog: null
         },
         {
           id: generateId(),
           text: 'Полить цветы',
           complexity: 'easy',
           deadline: null,
           repeatDays: ['mon', 'wed', 'fri'],
           completed: false,
           catalog: null
         },
         {
           id: generateId(),
           text: 'Дойти на почту на улице Седова и отправить посылку',
           complexity: 'normal',
           deadline: null,
           repeatDays: null,
           completed: false,
           catalog: null
         }
       ];
       
       saveDataToLocalStorage();
       renderTasks();
     }
   });