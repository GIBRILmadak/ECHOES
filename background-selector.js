
// background-selector.js — clean, single implementation
(function(){
    function init(){
        var backgroundContainer = document.getElementById('vanta-bg');
        var backgroundSelector = document.getElementById('background-selector');
        var html = document.documentElement;

        var darkBackgrounds = [
            'background/dark/dark-01.jpg','background/dark/dark-02.jpg','background/dark/dark-03.jpg',
            'background/dark/dark-04.jpg','background/dark/dark-05.jpg','background/dark/dark-06.jpg',
            'background/dark/dark-07.jpg','background/dark/dark-08.jpg','background/dark/dark-09.jpg'
        ];

        var lightBackgrounds = [
            'background/light/light-01.jpg','background/light/light-02.jpg','background/light/light-03.jpg',
            'background/light/light-04.jpg','background/light/light-05.jpg','background/light/light-06.jpg',
            'background/light/light-07.jpg','background/light/light-08.jpg','background/light/light-09.jpg'
        ];

        function createSelector(backgrounds, theme){
            var wrapper = document.createElement('div');
            wrapper.id = theme + '-backgrounds';
            wrapper.className = 'flex items-center space-x-2';

            var label = document.createElement('div');
            label.className = 'text-sm font-semibold mr-2 opacity-75';
            label.textContent = theme === 'dark' ? 'Sombres' : 'Clairs';
            label.setAttribute('aria-hidden','true');
            wrapper.appendChild(label);

            var rail = document.createElement('div');
            rail.className = 'flex';

            backgrounds.forEach(function(bg, idx){
                var btn = document.createElement('button');
                btn.className = 'min-w-[80px] h-16 rounded-md bg-cover bg-center border-2 border-transparent flex-shrink-0';
                btn.style.backgroundImage = "url('" + bg + "')";
                btn.title = bg;
                btn.setAttribute('aria-label', theme + ' background ' + (idx+1));
                btn.addEventListener('click', async function(){
                    var target = backgroundContainer || document.body;
                    try { target.style.backgroundImage = "url('" + bg + "')"; } catch(e){}
                    try { localStorage.setItem('selectedBg', bg); } catch(e){}

                    // Save to database if user is logged in
                    try {
                        if (window.getSupabase) {
                            const supabase = await window.getSupabase();
                            const { data: { user } } = await supabase.auth.getUser();
                            if (user) {
                                await supabase
                                    .from('profiles')
                                    .update({ background: bg, updated_at: new Date().toISOString() })
                                    .eq('id', user.id);
                            }
                        }
                    } catch (e) {
                        console.warn('Failed to save background to database:', e);
                    }
                });
                rail.appendChild(btn);
            });

            wrapper.appendChild(rail);
            return wrapper;
        }

        var darkSelector = createSelector(darkBackgrounds, 'dark');
        var lightSelector = createSelector(lightBackgrounds, 'light');

        if (backgroundSelector){
            backgroundSelector.appendChild(darkSelector);
            backgroundSelector.appendChild(lightSelector);
        }

        function updateBackgroundSelectors(){
            if (!backgroundSelector) return;
            if (html.classList.contains('dark')){ darkSelector.style.display='flex'; lightSelector.style.display='none'; }
            else { darkSelector.style.display='none'; lightSelector.style.display='flex'; }
        }

        document.addEventListener('themeChanged', updateBackgroundSelectors);

        var container = document.getElementById('background-selector-container');
        if (container){ container.style.position=''; container.style.zIndex=''; }

        var savedBg = null; try { savedBg = localStorage.getItem('selectedBg'); } catch(e){}
        var isDark = html.classList.contains('dark');
        var defaultBg = isDark ? darkBackgrounds[0] : lightBackgrounds[0];
        var initialBg = savedBg || defaultBg;

        if (backgroundContainer){ try { backgroundContainer.style.backgroundImage = "url('" + initialBg + "')"; } catch(e){} }
        if (!savedBg){ try { localStorage.setItem('selectedBg', initialBg); } catch(e){} }

        updateBackgroundSelectors();

        window.setBackgroundImage = function(url){ if(!url) return; var target = backgroundContainer || document.body; try{ target.style.backgroundImage = "url('" + url + "')"; }catch(e){} try{ localStorage.setItem('selectedBg', url);}catch(e){} };
        window.getAvailableBackgrounds = function(){ return darkBackgrounds.concat(lightBackgrounds); };
        window.getBackgroundsByTheme = function(theme){ return theme==='dark' ? darkBackgrounds.slice() : lightBackgrounds.slice(); };

        try{ window.backgroundsReady = true; }catch(e){}
        try{ document.dispatchEvent(new CustomEvent('backgroundsReady',{ detail:{ dark: darkBackgrounds.slice(), light: lightBackgrounds.slice() } })); }catch(e){}
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
