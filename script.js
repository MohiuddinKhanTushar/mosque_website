document.addEventListener('DOMContentLoaded', () => {
    
    // Initialize Lucide Icons
    lucide.createIcons();
    
    const nav = document.getElementById('navbar');
    const audio = document.getElementById('bg-audio');
    let lastScrollY = window.scrollY;

    // --- URL Force Reset Logic ---
    if (window.location.search.includes('reset=true')) {
        localStorage.removeItem('dailyQuote');
        localStorage.removeItem('lastQuoteDate');
    }

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

    // 3. CMS-Based Quran Quote Logic
    async function fetchDailyAyah() {
        const translationEl = document.getElementById('quran-translation');
        const arabicEl = document.getElementById('quran-arabic');
        if (!translationEl || !arabicEl) return;

        const today = new Date().toDateString();
        const cachedDate = localStorage.getItem('lastQuoteDate');
        const cachedQuote = localStorage.getItem('dailyQuote');

        // Use cached quote if it's the same day
        if (cachedDate === today && cachedQuote) {
            const data = JSON.parse(cachedQuote);
            updateQuoteUI(data.arabic, data.english, data.reference);
            return;
        }

        // Otherwise, fetch from CMS
        try {
            // Wait for Firebase to be ready (it's initialized in index.html)
            if (!window.db) {
                setTimeout(fetchDailyAyah, 500); 
                return;
            }

            const { getDocs, collection } = window.firestoreUtils;
            const querySnapshot = await getDocs(collection(window.db, "quotes"));
            const quotes = [];
            querySnapshot.forEach((doc) => quotes.push(doc.data()));

            if (quotes.length > 0) {
                // Randomly select one from the curated list
                const randomIndex = Math.floor(Math.random() * quotes.length);
                const selected = quotes[randomIndex];

                // Save to local storage for 24h consistency
                localStorage.setItem('lastQuoteDate', today);
                localStorage.setItem('dailyQuote', JSON.stringify(selected));

                updateQuoteUI(selected.arabic, selected.english, selected.reference);
            } else {
                throw new Error("Quotes collection is empty");
            }
        } catch (error) {
            console.error("CMS Quote Error:", error);
            // Secure Fallback
            updateQuoteUI("إِنَّ مَعَ الْعُسْرِ يُسْرًا", "Indeed, with hardship comes ease.", "Surah Al-Inshirah 94:6");
        }
    }

    function updateQuoteUI(arabic, english, ref) {
        const translationEl = document.getElementById('quran-translation');
        const arabicEl = document.getElementById('quran-arabic');
        if (!translationEl || !arabicEl) return;

        arabicEl.innerText = arabic;
        // Check for length to prevent hero overflow
        if(english.length > 180) {
            translationEl.style.fontSize = "clamp(1.1rem, 2vw, 1.3rem)";
        }

        translationEl.innerHTML = `"${english}" <span style="display: block; font-size: 0.9rem; font-style: normal; opacity: 0.6; margin-top: 15px; font-family: 'Inter', sans-serif;">— ${ref}</span>`;
    }

    // 4. Dynamic Hadith Logic
    async function fetchDailyHadith() {
        const hadithTextEl = document.querySelector('.reminder-text');
        const hadithSourceEl = document.querySelector('.reminder-source');
        if (!hadithTextEl || !hadithSourceEl) return;

        const cachedHadith = sessionStorage.getItem('dailyHadith');
        if (cachedHadith) {
            const data = JSON.parse(cachedHadith);
            hadithTextEl.innerText = `"${data.text}"`;
            hadithSourceEl.innerText = `— ${data.source}`;
            return;
        }

        try {
            const response = await fetch(`https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/eng-bukhari.json`);
            const res = await response.json();
            const randomIndex = Math.floor(Math.random() * res.hadiths.length);
            const randomHadith = res.hadiths[randomIndex];
            const text = randomHadith.text.replace(/<[^>]*>?/gm, '');
            const source = `Sahih Bukhari, Hadith ${randomHadith.hadithnumber}`;

            sessionStorage.setItem('dailyHadith', JSON.stringify({ text, source }));
            hadithTextEl.innerText = `"${text}"`;
            hadithSourceEl.innerText = `— ${source}`;
        } catch (error) {
            hadithTextEl.innerText = `"The best among you are those who have the best manners and character."`;
            hadithSourceEl.innerText = `— Sahih Bukhari`;
        }
    }

    // Initialize Fetches
    fetchDailyAyah();
    fetchDailyHadith();

    // 5. Intersection Observers
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

    const revealElements = document.querySelectorAll('.prayer-card, .next-prayer-status, .reveal, .reminder-card, .partners-grid, .footer');
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

// --- Burger Menu Logic ---
    const menuToggle = document.getElementById('menu-toggle');
    const navLinks = document.getElementById('nav-links');
    const menuIcon = menuToggle ? menuToggle.querySelector('i') : null;

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            nav.classList.toggle('mobile-active');

            // Toggle icon between 'menu' and 'x' (requires Lucide)
            const isOpened = navLinks.classList.contains('active');
            if (menuIcon) {
                menuIcon.setAttribute('data-lucide', isOpened ? 'x' : 'menu');
                lucide.createIcons(); // Refresh icons to show the X
            }
        });

        // Close menu when a link is clicked
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                nav.classList.remove('mobile-active');
                if (menuIcon) {
                    menuIcon.setAttribute('data-lucide', 'menu');
                    lucide.createIcons();
                }
            });
        });
    }