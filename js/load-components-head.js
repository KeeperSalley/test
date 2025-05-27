const API_BASE_URL = "/api"; // Changed to relative path for API prefix

async function loadComponent(path, target) {
  try {
    let response = await fetch(path);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    let html = await response.text();
    
    const currentPage = window.location.pathname.split("/").pop() || "profile.html";
    html = html.replace(/href="([^"]+)"/g, (match, href) => {
      const page = href.split("/").pop();
      return currentPage === page ? `${match} class="active"` : match;
    });
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    while (doc.body.firstChild) {
        target.appendChild(doc.body.firstChild);
    }

  } catch (err) {
    console.error(`Error loading ${path}:`, err);
  }
}

async function fetchAndPopulateUserData() {
    const token = localStorage.getItem("access_token");
    const nonAuthPages = !["auth.html", "register.html"].includes(window.location.pathname.split("/").pop());

    if (!token && nonAuthPages) {
        console.log("No token found, redirecting to login.");
        window.location.href = "auth.html"; // Redirect to auth.html, not /auth.html
        return;
    }
    if (!token) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/users/me`, { // Uses updated API_BASE_URL
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            const userData = await response.json();
            console.log("User data received:", userData); // Debug log
            populateHeader(userData);
            if (window.location.pathname.endsWith("profile.html")) {
                populateProfilePage(userData);
            }
        } else {
            console.error("Failed to fetch user data:", response.status);
            localStorage.removeItem("access_token");
            if (nonAuthPages) {
                window.location.href = "auth.html"; // Redirect to auth.html
            }
        }
    } catch (error) {
        console.error("Error fetching user data:", error);
    }
}

function populateHeader(userData) {
    console.log("Populating header with user data:", userData);
    
    const userNameElement = document.querySelector(".header1 .user-name");
    const userLevelElement = document.querySelector(".header1 .user-level");
    const characterContainer = document.querySelector(".header1 .character-container1");
    
    const healthStatElement = document.querySelector(".invisible-table td[style*=\"FF9496\"]");
    const attackStatElement = document.querySelector(".invisible-table td[style*=\"86D7FF\"]");
    const experienceStatElement = document.querySelector(".invisible-table td[style*=\"A2FF86\"]");
    const goldStatElement = document.querySelector(".invisible-table td[style*=\"FFFCA2\"]");

    // Use nickname from userData
    if (userNameElement) {
        userNameElement.textContent = userData.nickname || "Игрок";
        console.log("Set nickname:", userData.nickname);
    }
    
    // Use level from userData
    const level = userData.level || 1;
    if (userLevelElement) {
        userLevelElement.textContent = `Уровень ${level}`;
        console.log("Set level:", level);
    }

    // Handle character image based on class_id and gender
    if (characterContainer) {
        characterContainer.innerHTML = ""; 
        
        // Get class_id from userData
        const classId = userData.class_id;
        console.log("Class ID:", classId);
        
        // Get gender directly from user data
        const imgine = userData.img;
        console.log("URL IMG", imgine)
        if (classId) {
            // Use gender-specific class image
            const photoUrl = `${imgine}`;
            console.log("Setting character photo:", photoUrl);
            
            const img = document.createElement("img");
            img.src = photoUrl;
            img.alt = `Class ${classId}`;
            img.style.width = "100%";
            img.style.height = "100%";
            img.style.objectFit = "cover"; 
            img.onerror = function() {
                console.error("Failed to load class image:", photoUrl);
                // Fallback to non-gendered image if available
                const fallbackUrl = `${img}`;
                console.log("Trying fallback image:", fallbackUrl);
                this.src = fallbackUrl;
                
                // If fallback also fails, show text
                this.onerror = function() {
                    console.error("Failed to load fallback image:", fallbackUrl);
                    this.parentNode.textContent = "Нет фото";
                };
            };
            characterContainer.appendChild(img);
        } else {
            console.log("No class_id available, using placeholder");
            characterContainer.textContent = "Выберите класс"; 
        }
    }

    // Update stats with new field names
    if (experienceStatElement) {
        experienceStatElement.innerHTML = `<img class="img-param" src="images/op.svg">Опыт: ${userData.points || 0}/${userData.max_points || 100}`;
        console.log("Set experience:", userData.points, "/", userData.max_points);
    }
    
    if (goldStatElement) {
        goldStatElement.innerHTML = `<img class="img-param" src="images/gl.svg">Золото: ${userData.gold || 0}`;
        console.log("Set gold:", userData.gold);
    }

    // Use direct health and attack values from new schema
    if (healthStatElement) {
        healthStatElement.innerHTML = `<img class="img-param" src="images/hp.svg">Здоровье: ${userData.lives || 0}/${userData.max_lives || 100}`;
        console.log("Set health:", userData.lives, "/", userData.max_lives);
    }
    
    if (attackStatElement) {
        attackStatElement.innerHTML = `<img class="img-param" src="images/at.svg">Атака: ${userData.attack || 10}`;
        console.log("Set attack:", userData.attack);
    }
}

function populateProfilePage(userData) {
    console.log("Populating profile page with user data:", userData);
    
    const userClassDisplay = document.getElementById("user-class-display"); 
    if (userClassDisplay) {
        let className = "Не выбран";
        
        // Try to get class name from class_info
        if (userData.class_info && userData.class_info.name) {
            className = userData.class_info.name;
        }
        
        userClassDisplay.textContent = `Класс: ${className}`;
        console.log("Set class name:", className);
    }
    
    // Add gender display if available
    const userGenderDisplay = document.getElementById("user-gender-display");
    if (userGenderDisplay) {
        const gender = userData.gender || 'male';
        const genderText = gender === 'male' ? 'Мужской' : 'Женский';
        userGenderDisplay.textContent = `Пол: ${genderText}`;
        console.log("Set gender:", genderText);
    }
}

async function initPage() {
  console.log("Initializing page components");
  const headerWrapper = document.getElementById("header-wrapper");
  
  if (!headerWrapper) {
    console.error("Header wrapper not found!");
    return;
  }

  await loadComponent("includes/header.html", headerWrapper);
  console.log("Header component loaded");
  
  await loadComponent("includes/desktop-menu.html", document.body);
  console.log("Desktop menu component loaded");
  
  await loadComponent("includes/mobile-menu.html", document.body);
  console.log("Mobile menu component loaded");
  
  await fetchAndPopulateUserData();
  console.log("User data fetched and populated");

  const script = document.createElement("script");
  script.src = "js/menu.js"; // This path should be relative to the HTML file or root
  document.body.appendChild(script);
  console.log("Menu script loaded");
}

if (document.readyState === "complete" || document.readyState === "interactive") {
  console.log("Document already loaded, initializing page");
  initPage();
} else {
  console.log("Document not yet loaded, adding DOMContentLoaded listener");
  document.addEventListener("DOMContentLoaded", initPage);
}
