document.addEventListener('DOMContentLoaded', () => {

    // --- FORCE SCROLL TO TOP ON RELOAD ---
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
    
    lucide.createIcons();
    
    const nav = document.getElementById('navbar');
    const audio = document.getElementById('bg-audio');
    let lastScrollY = window.scrollY;
    let todayPrayerData = null;

    // --- URL Force Reset Logic ---
    if (window.location.search.includes('reset=true')) {
        localStorage.removeItem('dailyQuote');
        localStorage.removeItem('lastQuoteDate');
    }

    // 1. Robust Audio Persistence Logic
    const startGlobalAudio = () => {
        if (!audio) return;
        if (audio.paused) {
            audio.play().then(() => {
                window.removeEventListener('click', startGlobalAudio);
                window.removeEventListener('touchstart', startGlobalAudio);
                window.removeEventListener('scroll', startGlobalAudio);
            }).catch(e => console.log("Audio interaction pending..."));
        }
    };

    window.addEventListener('click', startGlobalAudio);
    window.addEventListener('touchstart', startGlobalAudio);
    window.addEventListener('scroll', startGlobalAudio, { once: true });

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

    // 5. Fetch Timetable for Homepage (Dual Times)
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
            
            // Indices: Start is usually N, Jamaat is N+1
            const fIdx = 3, sIdx = 5, dIdx = 7, aIdx = 9, mIdx = 11, iIdx = 12;
            const todayRow = lines.slice(1).map(parseRow).find(row => parseInt(row[dateColIndex]) === todayDay);

            if (todayRow) {
                todayPrayerData = {
                    'Fajr': { start: todayRow[fIdx], jamaat: todayRow[fIdx + 1] },
                    'Sunrise': { start: todayRow[sIdx], jamaat: null },
                    'Dhuhr': { start: todayRow[dIdx], jamaat: todayRow[dIdx + 1] },
                    'Asr': { start: todayRow[aIdx], jamaat: todayRow[aIdx + 1] },
                    'Maghrib': { start: todayRow[mIdx], jamaat: todayRow[mIdx] },
                    'Isha': { start: todayRow[iIdx], jamaat: todayRow[iIdx + 1] }
                };

                const prayers = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
                prayers.forEach(p => {
                    const dataKey = p.charAt(0).toUpperCase() + p.slice(1);
                    const startEl = document.getElementById(`${p}-start`);
                    const jamaatEl = document.getElementById(`${p}-jamaat`);
                    
                    if (startEl) startEl.innerText = todayPrayerData[dataKey].start;
                    if (jamaatEl && todayPrayerData[dataKey].jamaat) {
                        jamaatEl.innerText = todayPrayerData[dataKey].jamaat;
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

    // 7. UPDATED: Countdown Targets JAMAAT Time
    function highlightPrayer() {
        if (!todayPrayerData) return;

        const now = new Date();
        const totalMinsNow = now.getHours() * 60 + now.getMinutes();
        const names = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
        
        let currentLabel = 'Isha';
        let nextIndex = 0;

        // Determine current prayer based on START time
        for (let i = 0; i < names.length; i++) {
            const pTime = todayPrayerData[names[i]].start;
            if (!pTime) continue;
            
            const parts = pTime.replace('.', ':').split(':');
            let h = parseInt(parts[0]);
            let m = parseInt(parts[1]);

            if (h < 12 && i >= 2) h += 12; 
            const pMins = h * 60 + m;

            if (totalMinsNow >= pMins) {
                currentLabel = names[i];
                nextIndex = (i + 1) % names.length;
            }
        }

        // Target Next Jamaat (Fallback to Start if Jamaat is null)
        const nextName = names[nextIndex];
        const nextTimeStr = todayPrayerData[nextName].jamaat || todayPrayerData[nextName].start;
        const nParts = nextTimeStr.replace('.', ':').split(':');
        let nh = parseInt(nParts[0]);
        let nm = parseInt(nParts[1]);

        // Standard PM handling (Dhuhr onwards)
        if (nh < 12 && nextIndex >= 2) nh += 12;
        
        let targetDate = new Date(now);
        targetDate.setHours(nh, nm, 0, 0);

        // Date rollover logic
        if (nextIndex === 0 && totalMinsNow >= (nh < 12 ? (nh+12)*60 : nh*60)) {
            targetDate.setDate(targetDate.getDate() + 1);
        }
        if (nextIndex === 0 && totalMinsNow < (nh * 60 + nm)) {
             targetDate.setHours(nh, nm, 0, 0);
        }

        document.querySelectorAll('.prayer-card').forEach(card => {
            card.classList.toggle('active', card.dataset.prayer === currentLabel);
        });
        
        const nextEl = document.getElementById('next-prayer-name');
        if(nextEl) nextEl.innerText = nextName + " Jamaat";

        const countdownEl = document.getElementById('prayer-countdown');
        if (countdownEl) {
            const diff = targetDate - now;
            if (diff > 0) {
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const secs = Math.floor((diff % (1000 * 60)) / 1000);
                countdownEl.innerText = `in ${hours}h ${mins}m ${secs}s`;
            } else {
                countdownEl.innerText = "Jamaat in progress";
            }
        }
    }

    fetchDailyAyah();
    fetchDailyHadith();
    fetchTimetablePrayers();
    setInterval(highlightPrayer, 1000);

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

    // --- 9. Hidden Admin Access Logic ---
    const staffLink = document.getElementById('staff-portal-link');
    if (staffLink) {
        let portalClicks = 0;
        let portalTimer;

        staffLink.addEventListener('click', (e) => {
            portalClicks++;
            clearTimeout(portalTimer);
            if (portalClicks >= 5) {
                window.location.href = "login.html";
            }
            portalTimer = setTimeout(() => { portalClicks = 0; }, 2000);
        });

        let pressTimer;
        staffLink.addEventListener('touchstart', () => {
            pressTimer = setTimeout(() => { window.location.href = "login.html"; }, 3000); 
        });
        staffLink.addEventListener('touchend', () => { clearTimeout(pressTimer); });
    }
});