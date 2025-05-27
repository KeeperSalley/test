document.addEventListener('DOMContentLoaded', function() {
  // Редактирование "О себе"
  const setupEditModal = () => {
    const editBtn = document.getElementById('edit-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const saveBtn = document.getElementById('save-btn');
    const editModal = document.getElementById('edit-modal');
    const aboutMeText = document.getElementById('about-me-text');
    const editTextarea = document.getElementById('edit-textarea');

    if (!editBtn || !editModal) return;

    editBtn.addEventListener('click', function() {
      editTextarea.value = aboutMeText.textContent;
      editModal.style.display = 'flex';
    });

    cancelBtn.addEventListener('click', closeModal);
    
    saveBtn.addEventListener('click', function() {
      aboutMeText.textContent = editTextarea.value;
      closeModal();
    });
    
    editModal.addEventListener('click', function(e) {
      if (e.target === editModal) closeModal();
    });

    function closeModal() {
      editModal.style.display = 'none';
    }
  };

  // Редактирование никнейма
  const setupNicknameModal = () => {
    const editBtn = document.getElementById('edit_nickname-btn');
    const cancelBtn = document.getElementById('cancel-nickname-btn');
    const saveBtn = document.getElementById('save-nickname-btn');
    const nicknameModal = document.getElementById('nickname-modal');
    const nicknameInput = document.getElementById('nickname-input');
    const nicknameDisplay = document.getElementById('about-me-text'); 

    if (!editBtn || !nicknameModal) return;

    editBtn.addEventListener('click', function() {
      nicknameInput.value = nicknameDisplay.textContent;
      nicknameModal.style.display = 'flex';
      nicknameInput.focus();
    });

    cancelBtn.addEventListener('click', closeModal);
    
    saveBtn.addEventListener('click', function() {
      const newNickname = nicknameInput.value.trim();
      if (newNickname) {
        nicknameDisplay.textContent = newNickname;
        closeModal();
      }
    });
    
    nicknameModal.addEventListener('click', function(e) {
      if (e.target === nicknameModal) closeModal();
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && nicknameModal.style.display === 'flex') {
        closeModal();
      }
    });

    function closeModal() {
      nicknameModal.style.display = 'none';
    }
  };

  // Подтверждение удаления аккаунта
  const setupDeleteModal = () => {
    const deleteBtn = document.getElementById('delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const deleteModal = document.getElementById('delete-modal');

    if (!deleteBtn || !deleteModal) return;

    deleteBtn.addEventListener('click', function() {
      deleteModal.style.display = 'flex';
    });

    cancelDeleteBtn.addEventListener('click', closeModal);
    
    confirmDeleteBtn.addEventListener('click', function() {
      // Здесь должна быть логика удаления аккаунта
      alert('Аккаунт удален!'); // Временное уведомление
      closeModal();
      // Перенаправление на главную страницу или страницу входа
      // window.location.href = '/';
    });
    
    deleteModal.addEventListener('click', function(e) {
      if (e.target === deleteModal) closeModal();
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && deleteModal.style.display === 'flex') {
        closeModal();
      }
    });

    function closeModal() {
      deleteModal.style.display = 'none';
    }
  };

  // Инициализация всех модальных окон
  setupEditModal();
  setupNicknameModal();
  setupDeleteModal();
});