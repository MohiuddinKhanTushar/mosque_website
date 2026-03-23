document.addEventListener('DOMContentLoaded', () => {
    
    // Initialize Lucide Icons
    lucide.createIcons();
    
    const nav = document.getElementById('navbar');
    const audio = document.getElementById('bg-audio');
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
        const currentScrollY = window.scrollY;
        if (currentScrollY > 5) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }

        if (currentScrollY > lastScrollY && currentScrollY > 300) {
            nav.classList.add('hidden');
        } else {
            nav.classList.remove('hidden');
        }
        lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll);

    const startAudio = () => {
        audio.play().then(() => {
            window.removeEventListener('click', startAudio);
            window.removeEventListener('touchstart', startAudio);
        }).catch(() => {});
    };

    window.addEventListener('click', startAudio);
    window.addEventListener('touchstart', startAudio);

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('visible');
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal, .reveal-type').forEach(el => observer.observe(el));

    setTimeout(() => {
        document.querySelectorAll('.hero .reveal, .hero .reveal-type').forEach(el => el.classList.add('visible'));
    }, 300);

    function highlightPrayer() {
        const now = new Date();
        const totalMins = now.getHours() * 60 + now.getMinutes();

        // Fajr (5:15), Sunrise (6:38), Dhuhr (13:15), Asr (17:30), Maghrib (19:45), Isha (21:00)
        const times = [315, 398, 795, 1050, 1185, 1260]; 
        const names = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
        
        let current = 'Isha';
        for(let i=0; i < times.length; i++) {
            if(totalMins >= times[i]) current = names[i];
        }

        document.querySelectorAll('.prayer-card').forEach(card => {
            card.classList.toggle('active', card.dataset.prayer === current);
        });
        
        const nextEl = document.getElementById('next-prayer-name');
        if(nextEl) nextEl.innerText = current;
    }
    highlightPrayer();
    setInterval(highlightPrayer, 60000);
});