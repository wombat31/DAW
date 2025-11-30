document.addEventListener("DOMContentLoaded", () => {
    
    // -------------------------
    // Tabs functionality
    // -------------------------
    const tabs = document.querySelectorAll(".tab");
    const contents = document.querySelectorAll(".tab-content");

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const target = tab.dataset.tab;

            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");

            contents.forEach(c => {
                if(c.id === target) {
                    c.classList.add("active");
                } else {
                    c.classList.remove("active");
                }
            });
        });
    });

    // --- CONSOLIDATED AND UPDATED BURGER MENU TOGGLE ---

    // Get the elements using the specific IDs defined in module_detail.html
    const burger = document.getElementById('burger-menu');
    const mobileMenu = document.getElementById('mobile-menu');

    if (burger && mobileMenu) {
        burger.addEventListener('click', () => {
            // Toggles the 'show' class on the mobile menu (ul.nav-links-mobile)
            mobileMenu.classList.toggle('show');
            
            // Toggles the 'open' class on the burger icon (div#burger-menu) for animation
            burger.classList.toggle('open');
        });
    }

    // -------------------------
    // Optional: close mobile menu on link click
    // -------------------------
    // Target links within the mobile menu container (ul#mobile-menu)
    const mobileNavLinks = document.querySelectorAll("#mobile-menu a");
    
    mobileNavLinks.forEach(link => {
        link.addEventListener("click", () => {
            // Check if the menu is open (burger has 'open' class)
            if (burger && burger.classList.contains("open")) {
                burger.classList.remove("open");
                mobileMenu.classList.remove("show");
            }
        });
    });
});