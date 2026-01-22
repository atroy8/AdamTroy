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
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
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
    }
    
    toggleMenu() {
        this.isOpen = !this.isOpen;
        this.toggle.classList.toggle('active');
        this.navLinks.classList.toggle('active');
        
        // Update mobile styles
        if (this.isOpen) {
            this.navLinks.style.display = 'flex';
            this.navLinks.style.flexDirection = 'column';
            this.navLinks.style.position = 'absolute';
            this.navLinks.style.top = '100%';
            this.navLinks.style.left = '0';
            this.navLinks.style.right = '0';
            this.navLinks.style.background = 'var(--nav-bg)';
            this.navLinks.style.padding = '1rem';
            this.navLinks.style.borderTop = '1px solid var(--border-color)';
        } else {
            this.navLinks.style.display = '';
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
        try {
            const response = await fetch('src/data/experience.json');
            const data = await response.json();
            this.renderTimeline(data.experience);
        } catch (error) {
            console.error('Error loading experience data:', error);
            this.renderError();
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
                    <p class="timeline-description">${exp.description}</p>
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
    
    renderError() {
        this.container.innerHTML = `
            <div class="timeline-error">
                <p>Unable to load experience data. Please check the console for details.</p>
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

// Form Handler
class ContactForm {
    constructor() {
        this.form = document.getElementById('contactForm');
        this.init();
    }
    
    init() {
        if (!this.form) return;
        
        this.form.addEventListener('submit', (e) => {
            // If using Formspree or similar, the default action will handle submission
            // Add custom validation or tracking here if needed
            console.log('Form submitted');
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
    new ContactForm();
    
    // Only add scroll animations if user doesn't prefer reduced motion
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        new ScrollAnimations();
    }
});
