    // Функции для работы с модальными окнами
    function openModal(modalId) {
        document.getElementById(modalId).style.display = 'flex';
      }
      
      function closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
      }
      
      function openDeleteTeamModal() {
        openModal('deleteTeamModal');
      }
      
      function openAddMemberModal() {
        openModal('addMemberModal');
      }
      
      function openDeleteMemberModal() {
        openModal('deleteMemberModal');
      }
      
      // Функции для действий
      function deleteTeam() {
        alert('Команда удалена');
        closeModal('deleteTeamModal');
      }
      
      function addMember() {
        const nickname = document.querySelector('#addMemberModal .modal-input').value;
        if (nickname.trim()) {
          alert(`Участник ${nickname} добавлен`);
          closeModal('addMemberModal');
          document.querySelector('#addMemberModal .modal-input').value = '';
        }
      }
      
      function deleteMember() {
        alert('Участник удален');
        closeModal('deleteMemberModal');
      }
      
      function sendMessage() {
        const input = document.querySelector('.chat-input');
        const message = input.value.trim();
        if (message) {
          const chatBox = document.querySelector('.chat-box');
          const messageElement = document.createElement('div');
          messageElement.textContent = `Вы: ${message}`;
          chatBox.appendChild(messageElement);
          input.value = '';
          chatBox.scrollTop = chatBox.scrollHeight;
        }
      }
      
      // Отправка сообщения по нажатию Enter
      document.querySelector('.chat-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          sendMessage();
        }
      });