document.addEventListener('DOMContentLoaded', () => {
    
    // Initialize Lucide Icons
    lucide.createIcons();
    
    const nav = document.getElementById('navbar');
    const audio = document.getElementById('bg-audio');
    let lastScrollY = window.scrollY;
    let todayPrayerData = null; // Global storage for today's times

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

        if (cachedDate === today && cachedQuote) {
            const data = JSON.parse(cachedQuote);
            updateQuoteUI(data.arabic, data.english, data.reference);
            return;
        }

        try {
            if (!window.db) {
                setTimeout(fetchDailyAyah, 500); 
                return;
            }

            const { getDocs, collection } = window.firestoreUtils;
            const querySnapshot = await getDocs(collection(window.db, "quotes"));
            const quotes = [];
            querySnapshot.forEach((doc) => quotes.push(doc.data()));

            if (quotes.length > 0) {
                const randomIndex = Math.floor(Math.random() * quotes.length);
                const selected = quotes[randomIndex];
                localStorage.setItem('lastQuoteDate', today);
                localStorage.setItem('dailyQuote', JSON.stringify(selected));
                updateQuoteUI(selected.arabic, selected.english, selected.reference);
            } else {
                throw new Error("Quotes collection is empty");
            }
        } catch (error) {
            console.error("CMS Quote Error:", error);
            updateQuoteUI("إِنَّ مَعَ الْعُسْرِ يُسْرًا", "Indeed, with hardship comes ease.", "Surah Al-Inshirah 94:6");
        }
    }

    function updateQuoteUI(arabic, english, ref) {
        const translationEl = document.getElementById('quran-translation');
        const arabicEl = document.getElementById('quran-arabic');
        if (!translationEl || !arabicEl) return;
        arabicEl.innerText = arabic;
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

    // --- 5. NEW: Fetch Timetable for Homepage ---
    async function fetchTimetablePrayers() {
        try {
            if (!window.db) {
                setTimeout(fetchTimetablePrayers, 500);
                return;
            }

            const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            const snap = await getDoc(doc(window.db, "settings", "timetable"));
            
            if (!snap.exists()) return;
            const allMonths = snap.data().months;
            
            const now = new Date();
            const currentMonthName = now.toLocaleString('en-GB', { month: 'long' }).toUpperCase();
            const currentYear = now.getFullYear().toString();
            const todayDay = now.getDate();

            const monthData = allMonths.find(m => 
                m.name.toUpperCase().includes(currentMonthName) && 
                m.year.toString() === currentYear
            );

            if (!monthData) return;

            const lines = monthData.csv.split(/\r?\n/).filter(l => l.trim() !== '');
            const parseRow = (row) => (row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || row.split(',')).map(c => c.replace(/^"|"$/g, '').trim());
            
            const headers = parseRow(lines[0]);
            const dateColIndex = headers.findIndex(h => h.toUpperCase().includes('DATE'));
            
            // Map common column names to our UI labels
            const colMap = {
                'FAJR': headers.findIndex(h => h.toUpperCase() === 'START' || h.toUpperCase() === 'FAJR'),
                'SUNRISE': headers.findIndex(h => h.toUpperCase().includes('SUNRISE')),
                'DHUHR': headers.findIndex(h => h.toUpperCase() === 'ZAWAL' || h.toUpperCase() === 'DHUHR'),
                'ASR': headers.findIndex(h => h.toUpperCase() === 'START' && headers[headers.indexOf(h)+1]?.toUpperCase() === 'JUMMAH' ? false : h.toUpperCase() === 'ASR'), // Logic depends on your CSV order
                'MAGHRIB': headers.findIndex(h => h.toUpperCase().includes('MAGHRIB')),
                'ISHA': headers.findIndex(h => h.toUpperCase() === 'ISHA' || (h.toUpperCase() === 'START' && headers.indexOf(h) > 10))
            };

            // Manual index override based on your screenshot if headers are ambiguous:
            // Day=0, Shawwal=1, Date=2, FajrStart=3, FajrJam=4, Sunrise=5, DhuhrStart=6, ...
            const fajrIdx = 3, sunIdx = 5, dhuhrIdx = 6, asrIdx = 8, magIdx = 10, ishaIdx = 11;

            const todayRow = lines.slice(1).map(parseRow).find(row => parseInt(row[dateColIndex]) === todayDay);

            if (todayRow) {
                todayPrayerData = {
                    'Fajr': todayRow[fajrIdx],
                    'Sunrise': todayRow[sunIdx],
                    'Dhuhr': todayRow[dhuhrIdx],
                    'Asr': todayRow[asrIdx],
                    'Maghrib': todayRow[magIdx],
                    'Isha': todayRow[ishaIdx]
                };

                // Update UI
                document.querySelectorAll('.prayer-card').forEach(card => {
                    const pName = card.dataset.prayer;
                    if (todayPrayerData[pName]) {
                        const timeSpan = card.querySelector('.time');
                        // Format time to add AM/PM if missing (optional)
                        timeSpan.innerText = todayPrayerData[pName];
                    }
                });

                highlightPrayer();
            }
        } catch (e) {
            console.error("Home Timetable Error:", e);
        }
    }

    // 6. Intersection Observers
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

    // 7. Prayer Highlighting
    function highlightPrayer() {
        if (!todayPrayerData) return;

        const now = new Date();
        const totalMins = now.getHours() * 60 + now.getMinutes();
        
        const names = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
        
        // Helper to convert "5.06" or "05:06" to minutes
        const timeToMins = (tStr) => {
            const parts = tStr.replace('.', ':').split(':');
            let h = parseInt(parts[0]);
            let m = parseInt(parts[1]);
            // Simple PM adjustment logic if using 12h format without AM/PM markers in CSV
            if (h < 12 && (names.indexOf(currentLabel) > 2)) h += 12; 
            return h * 60 + m;
        };

        let currentLabel = 'Isha';
        let nextIndex = 0;

        // Compare current time to the fetched data
        for (let i = 0; i < names.length; i++) {
            const pTime = todayPrayerData[names[i]];
            if (!pTime) continue;
            
            const pMins = timeToMins(pTime);
            if (totalMins >= pMins) {
                currentLabel = names[i];
                nextIndex = (i + 1) % names.length;
            }
        }

        document.querySelectorAll('.prayer-card').forEach(card => {
            card.classList.toggle('active', card.dataset.prayer === currentLabel);
        });
        
        const nextEl = document.getElementById('next-prayer-name');
        if(nextEl) nextEl.innerText = names[nextIndex];
    }

    // Initialize logic
    fetchDailyAyah();
    fetchDailyHadith();
    fetchTimetablePrayers();
    setInterval(highlightPrayer, 60000);

    // --- 8. Burger Menu Logic ---
    const menuToggle = document.getElementById('menu-toggle');
    const navLinks = document.getElementById('nav-links');

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            const isOpened = navLinks.classList.toggle('active');
            nav.classList.toggle('mobile-active');
            const icon = menuToggle.querySelector('i') || menuToggle.querySelector('svg');
            if (icon) {
                icon.setAttribute('data-lucide', isOpened ? 'x' : 'menu');
                lucide.createIcons();
            }
        });

        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                nav.classList.remove('mobile-active');
                const icon = menuToggle.querySelector('i') || menuToggle.querySelector('svg');
                if (icon) {
                    icon.setAttribute('data-lucide', 'menu');
                    lucide.createIcons();
                }
            });
        });
    }
});

// --- 9. Hidden Admin Access Logic ---
    const staffLink = document.getElementById('staff-portal-link');
    if (staffLink) {
        let portalClicks = 0;
        let portalTimer;

        // Multi-click logic (5 clicks)
        staffLink.addEventListener('click', (e) => {
            // Prevent regular click from working immediately if you want it purely hidden
            // e.preventDefault(); 

            portalClicks++;
            clearTimeout(portalTimer);
            
            if (portalClicks >= 5) {
                window.location.href = "login.html";
            }

            // Reset counter if user stops clicking for 2 seconds
            portalTimer = setTimeout(() => {
                portalClicks = 0;
            }, 2000);
        });

        // Long press logic for Mobile
        let pressTimer;
        staffLink.addEventListener('touchstart', () => {
            pressTimer = setTimeout(() => {
                window.location.href = "login.html";
            }, 3000); // 3 second hold
        });

        staffLink.addEventListener('touchend', () => {
            clearTimeout(pressTimer);
        });
    }