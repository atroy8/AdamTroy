/**
 * Interactive Network Hero Background
 * Creates a floating network visualization that responds to mouse movement
 * with respect for reduced motion preferences
 */

class NetworkHero {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.nodes = [];
        this.mouse = { x: null, y: null };
        this.animationId = null;
        
        // Configuration
        this.config = {
            nodeCount: 50,
            maxDistance: 150,
            nodeRadius: 2,
            nodeSpeed: 0.3,
            mouseInfluence: 80,
            parallaxStrength: 0.02
        };
        
        // Check for reduced motion preference
        this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        this.init();
    }
    
    init() {
        this.setCanvasSize();
        this.createNodes();
        
        if (!this.prefersReducedMotion) {
            this.attachEventListeners();
            this.animate();
        } else {
            // Static fallback for reduced motion
            this.renderStatic();
        }
    }
    
    setCanvasSize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    createNodes() {
        this.nodes = [];
        for (let i = 0; i < this.config.nodeCount; i++) {
            this.nodes.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * this.config.nodeSpeed,
                vy: (Math.random() - 0.5) * this.config.nodeSpeed,
                radius: this.config.nodeRadius
            });
        }
    }
    
    attachEventListeners() {
        window.addEventListener('resize', () => {
            this.setCanvasSize();
            this.createNodes();
        });
        
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        
        window.addEventListener('mouseleave', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });
    }
    
    updateNodes() {
        this.nodes.forEach(node => {
            // Mouse influence
            if (this.mouse.x !== null && this.mouse.y !== null) {
                const dx = this.mouse.x - node.x;
                const dy = this.mouse.y - node.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < this.config.mouseInfluence) {
                    const force = (this.config.mouseInfluence - distance) / this.config.mouseInfluence;
                    node.vx += dx * force * this.config.parallaxStrength;
                    node.vy += dy * force * this.config.parallaxStrength;
                }
            }
            
            // Update position
            node.x += node.vx;
            node.y += node.vy;
            
            // Boundary collision
            if (node.x < 0 || node.x > this.canvas.width) node.vx *= -1;
            if (node.y < 0 || node.y > this.canvas.height) node.vy *= -1;
            
            // Keep within bounds
            node.x = Math.max(0, Math.min(this.canvas.width, node.x));
            node.y = Math.max(0, Math.min(this.canvas.height, node.y));
            
            // Damping
            node.vx *= 0.99;
            node.vy *= 0.99;
        });
    }
    
    drawNodes() {
        const nodeColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--network-node').trim();
        
        this.ctx.fillStyle = nodeColor;
        this.nodes.forEach(node => {
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
    
    drawConnections() {
        const lineColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--network-line').trim();
        
        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                const dx = this.nodes[i].x - this.nodes[j].x;
                const dy = this.nodes[i].y - this.nodes[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < this.config.maxDistance) {
                    const opacity = 1 - (distance / this.config.maxDistance);
                    this.ctx.strokeStyle = lineColor.replace(/[\d.]+\)$/g, `${opacity * 0.3})`);
                    this.ctx.lineWidth = 1;
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.nodes[i].x, this.nodes[i].y);
                    this.ctx.lineTo(this.nodes[j].x, this.nodes[j].y);
                    this.ctx.stroke();
                }
            }
        }
    }
    
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawConnections();
        this.drawNodes();
    }
    
    renderStatic() {
        // Static render for reduced motion users
        this.render();
    }
    
    animate() {
        this.updateNodes();
        this.render();
        this.animationId = requestAnimationFrame(() => this.animate());
    }
    
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        window.removeEventListener('resize', this.setCanvasSize);
        window.removeEventListener('mousemove', () => {});
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const networkHero = new NetworkHero('networkCanvas');
});
