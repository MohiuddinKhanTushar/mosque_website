document.addEventListener('DOMContentLoaded', () => {
    
    // Initialize Lucide Icons
    lucide.createIcons();
    
    const nav = document.getElementById('navbar');
    const audio = document.getElementById('bg-audio');
    let lastScrollY = window.scrollY;

    // 1. Audio "Unlock" Logic
    const unlockAudio = () => {
        if (!audio) return;
        audio.play().then(() => {
            audio.pause(); 
            audio.currentTime = 0;
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('touchstart', unlockAudio);
        }).catch(e => console.log("Audio interaction pending"));
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);

    // 2. Navbar Scroll Logic
    const handleScroll = () => {
        const currentScrollY = window.scrollY;
        
        if (currentScrollY > 10) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }

        if (currentScrollY > lastScrollY && currentScrollY > 60) {
            nav.classList.add('hidden');
        } else {
            nav.classList.remove('hidden');
        }
        lastScrollY = currentScrollY;
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    // 3. Dynamic Quran Quote Logic (API Integration)
    async function fetchDailyAyah() {
        const translationEl = document.querySelector('.translation');
        const arabicEl = document.querySelector('.arabic');
        
        if (!translationEl || !arabicEl) return;

        // Try to get cached quote for this session to prevent flickering on refresh
        const cachedAyah = sessionStorage.getItem('dailyAyah');
        if (cachedAyah) {
            const data = JSON.parse(cachedAyah);
            updateQuoteUI(data.arabic, data.english, data.ref);
            return;
        }

        try {
            // Pick a random verse (Total 6236 verses in Quran)
            const randomVerse = Math.floor(Math.random() * 6236) + 1;
            const response = await fetch(`https://api.alquran.cloud/v1/ayah/${randomVerse}/editions/quran-simple,en.sahih`);
            const res = await response.json();

            if (res.code === 200) {
                const arabic = res.data[0].text;
                const english = res.data[1].text;
                const ref = `${res.data[0].surah.englishName} ${res.data[0].surah.number}:${res.data[0].numberInSurah}`;

                // Cache it for the current session
                sessionStorage.setItem('dailyAyah', JSON.stringify({ arabic, english, ref }));
                
                updateQuoteUI(arabic, english, ref);
            }
        } catch (error) {
            console.error("Quran API Error:", error);
            // Fallback if API fails
            updateQuoteUI("إِنَّ مَعَ الْعُسْرِ يُسْرًا", "Indeed, with hardship comes ease.", "Surah Al-Inshirah 94:6");
        }
    }

    function updateQuoteUI(arabic, english, ref) {
        const translationEl = document.querySelector('.translation');
        const arabicEl = document.querySelector('.arabic');
        
        arabicEl.innerText = arabic;
        translationEl.innerText = english;

        // Append the reference subtly
        const refSpan = document.createElement('span');
        refSpan.style = "display: block; font-size: 0.9rem; font-style: normal; opacity: 0.6; margin-top: 15px; font-family: 'Inter', sans-serif;";
        refSpan.innerText = `— ${ref}`;
        translationEl.appendChild(refSpan);
    }

    // Initialize Quote Fetch
    fetchDailyAyah();

    // 4. Quran Quote & Audio Observer
    const quranObserverOptions = { threshold: 0.1 };
    const quranObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                if (audio) audio.play().catch(() => {});
                entry.target.querySelectorAll('.reveal-type, .reveal').forEach(el => {
                    el.classList.add('visible');
                });
                quranObserver.unobserve(entry.target);
            }
        });
    }, quranObserverOptions);

    const quranContainer = document.querySelector('.hero-content');
    if (quranContainer) quranObserver.observe(quranContainer);

    // 5. General Content Observer
    const generalObserverOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };
    const generalObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                if (entry.target.classList.contains('prayer-card')) {
                    entry.target.classList.add('reveal-visible');
                } else {
                    entry.target.classList.add('visible');
                }
                generalObserver.unobserve(entry.target);
            }
        });
    }, generalObserverOptions);

    const revealElements = document.querySelectorAll('.prayer-card, .next-prayer-status, .reveal, .reminder-card, .partners-grid, .donate-item, .bank-card, .footer');
    revealElements.forEach(el => generalObserver.observe(el));

    // 6. Prayer Highlighting
    function highlightPrayer() {
        const now = new Date();
        const totalMins = now.getHours() * 60 + now.getMinutes();
        const times = [315, 398, 795, 1050, 1185, 1260]; 
        const names = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
        
        let current = 'Isha';
        let nextIndex = 0;

        for(let i=0; i < times.length; i++) {
            if(totalMins >= times[i]) {
                current = names[i];
                nextIndex = (i + 1) % names.length;
            }
        }

        document.querySelectorAll('.prayer-card').forEach(card => {
            card.classList.toggle('active', card.dataset.prayer === current);
        });
        
        const nextEl = document.getElementById('next-prayer-name');
        if(nextEl) nextEl.innerText = names[nextIndex];
    }

    highlightPrayer();
    setInterval(highlightPrayer, 60000);
});