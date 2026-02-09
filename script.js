/**
 * Main JavaScript for Adam Troy's Business Card Website
 * Handles theme toggling, navigation, form submission, and experience timeline
 */

// Theme Management
class ThemeManager {
    constructor() {
        this.theme = localStorage.getItem('theme') || 'light';
        this.themeToggle = document.getElementById('themeToggle');
        this.init();
    }
    
    init() {
        this.applyTheme();
        if (this.themeToggle) {
            this.themeToggle.addEventListener('click', () => this.toggleTheme());
        }
    }
    
    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
    }
    
    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', this.theme);
        this.applyTheme();
    }
}

// Mobile Navigation
class MobileNav {
    constructor() {
        this.toggle = document.getElementById('mobileMenuToggle');
        this.navLinks = document.querySelector('.nav-links');
        this.isOpen = false;
        this.init();
    }
    
    init() {
        if (!this.toggle) return;
        
        this.toggle.addEventListener('click', () => this.toggleMenu());
        
        // Close menu when clicking a link
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', () => {
                if (this.isOpen) this.toggleMenu();
            });
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isOpen && !this.toggle.contains(e.target) && !this.navLinks.contains(e.target)) {
                this.toggleMenu();
            }
        });
    }
    
    toggleMenu() {
        this.isOpen = !this.isOpen;
        this.toggle.classList.toggle('active');
        this.navLinks.classList.toggle('active');
        
        // Update mobile styles with proper CSS
        if (this.isOpen) {
            this.navLinks.style.cssText = `
                display: flex;
                flex-direction: column;
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: var(--nav-bg);
                padding: 1rem;
                border-top: 1px solid var(--border-color);
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            `;
        } else {
            this.navLinks.style.cssText = '';
        }
    }
}

// Experience Timeline Loader
class ExperienceTimeline {
    constructor() {
        this.container = document.getElementById('timeline');
        this.init();
    }
    
    async init() {
        if (!this.container) return;
        
        // Show loading state
        this.container.innerHTML = '<div class="timeline-loading" style="text-align: center; padding: 2rem; color: var(--text-secondary);">Loading experience...</div>';
        
        try {
            const response = await fetch('src/data/experience.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            this.renderTimeline(data.experience);
        } catch (error) {
            console.error('Error loading experience data:', error);
            this.renderError(error.message);
        }
    }
    
    renderTimeline(experiences) {
        const html = experiences.map(exp => `
            <div class="timeline-item">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                    <div class="timeline-header">
                        <h3 class="timeline-title">${exp.title}</h3>
                        <div class="timeline-org">${exp.organization}</div>
                        <div class="timeline-meta">
                            <span>${exp.startDate} - ${exp.endDate}</span>
                            <span>•</span>
                            <span>${exp.location}</span>
                        </div>
                    </div>
${exp.description ? `                    <p class="timeline-description">${exp.description}</p>` : ''}
                    ${exp.highlights && exp.highlights.length > 0 ? `
                        <ul class="timeline-highlights">
                            ${exp.highlights.map(h => `<li>${h}</li>`).join('')}
                        </ul>
                    ` : ''}
                </div>
            </div>
        `).join('');
        
        this.container.innerHTML = html;
    }
    
    renderError(message) {
        this.container.innerHTML = `
            <div class="timeline-error" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                <p>Unable to load experience data.</p>
                <p style="font-size: 0.875rem; margin-top: 0.5rem; opacity: 0.7;">Error: ${message}</p>
            </div>
        `;
    }
}

// Smooth Scroll Enhancement
class SmoothScroll {
    constructor() {
        this.init();
    }
    
    init() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(anchor.getAttribute('href'));
                if (target) {
                    const offset = 80; // Account for fixed nav
                    const targetPosition = target.offsetTop - offset;
                    
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }
}

// Scroll Progress Indicator
class ScrollProgress {
    constructor() {
        this.progressBar = document.getElementById('scrollProgress');
        this.init();
    }
    
    init() {
        if (!this.progressBar) return;
        
        window.addEventListener('scroll', () => {
            const winScroll = document.documentElement.scrollTop;
            const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const scrolled = (winScroll / height) * 100;
            this.progressBar.style.width = scrolled + '%';
        });
    }
}

// Active Navigation State
class ActiveNav {
    constructor() {
        this.sections = document.querySelectorAll('section[id]');
        this.navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
        this.init();
    }
    
    init() {
        if (this.sections.length === 0 || this.navLinks.length === 0) return;
        
        window.addEventListener('scroll', () => {
            let current = '';
            
            this.sections.forEach(section => {
                const sectionTop = section.offsetTop;
                const sectionHeight = section.clientHeight;
                if (window.scrollY >= (sectionTop - 100)) {
                    current = section.getAttribute('id');
                }
            });

            this.navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${current}`) {
                    link.classList.add('active');
                }
            });
        });
    }
}

// Form Handler
class ContactForm {
    constructor() {
        this.form = document.getElementById('contactForm');
        this.init();
    }
    
    init() {
        if (!this.form) return;
        
        this.form.addEventListener('submit', (e) => {
            // Netlify Forms will handle submission automatically
            // Add custom validation or tracking here if needed
            console.log('Form submitted');
            
            // Show success message (optional)
            // You can add a success message div in your HTML and show it here
        });
    }
}

// Intersection Observer for Animations
class ScrollAnimations {
    constructor() {
        this.init();
    }
    
    init() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, observerOptions);
        
        // Observe cards and timeline items
        document.querySelectorAll('.expertise-card, .press-card, .game-card, .timeline-item').forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(el);
        });
    }
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ThemeManager();
    new MobileNav();
    new ExperienceTimeline();
    new SmoothScroll();
    new ScrollProgress();
    new ActiveNav();
    new ContactForm();
    
    // Only add scroll animations if user doesn't prefer reduced motion
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        new ScrollAnimations();
    }
});
