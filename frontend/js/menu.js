function initMenu() {
    console.log('Initializing menu...');
    
    const menuBtn = document.getElementById('menuBtn');
    const closeMenuBtn = document.getElementById('closeMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
  
    if (!menuBtn || !closeMenuBtn || !mobileMenu) {
      console.error('Menu elements not found!');
      return false;
    }
  
    // Открытие меню
    menuBtn.addEventListener('click', function() {
      console.log('Opening menu');
      mobileMenu.style.display = 'block';
      setTimeout(() => {
        mobileMenu.classList.add('active');
      }, 10);
    });
  
    // Закрытие меню
    function closeMenu() {
      mobileMenu.classList.remove('active');
      setTimeout(() => {
        mobileMenu.style.display = 'none';
      }, 300);
    }
  
    closeMenuBtn.addEventListener('click', closeMenu);
  
    // Закрытие при клике на ссылку
    document.querySelectorAll('.mobile-nav-link').forEach(link => {
      link.addEventListener('click', closeMenu);
    });
  
    // Закрытие при клике вне меню
    mobileMenu.addEventListener('click', function(e) {
      if (e.target === mobileMenu) {
        closeMenu();
      }
    });
  
    return true;
  }
  
  // Инициализация после полной загрузки
  if (document.readyState === 'complete') {
    initMenu();
  } else {
    document.addEventListener('DOMContentLoaded', initMenu);
  }