
document.addEventListener('DOMContentLoaded', () => {
    const backgroundContainer = document.getElementById('vanta-bg');
    const backgroundSelector = document.getElementById('background-selector');
    const html = document.documentElement;

    const darkBackgrounds = [
        'background/dark/dark-01.jpg',
        'background/dark/dark-02.jpg',
        'background/dark/dark-03.jpg',
        'background/dark/dark-04.jpg',
        'background/dark/dark-05.jpg',
        'background/dark/dark-06.jpg',
        'background/dark/dark-07.jpg',
        'background/dark/dark-08.jpg',
        'background/dark/dark-09.jpg'
    ];

    const lightBackgrounds = [
        'background/light/light-01.jpg',
        'background/light/light-02.jpg',
        'background/light/light-03.jpg',
        'background/light/light-04.jpg',
        'background/light/light-05.jpg',
        'background/light/light-06.jpg',
        'background/light/light-07.jpg',
        'background/light/light-08.jpg',
        'background/light/light-09.jpg'
    ];

    function createSelector(backgrounds, theme) {
        const container = document.createElement('div');
        container.id = `${theme}-backgrounds`;
        container.className = 'flex space-x-2';

        backgrounds.forEach(bg => {
            const button = document.createElement('button');
            button.className = 'w-10 h-10 rounded-full bg-cover bg-center border-2 border-transparent focus:border-dark-accent dark:focus:border-dark-accent';
            button.style.backgroundImage = `url('${bg}')`;
            button.addEventListener('click', () => {
                backgroundContainer.style.backgroundImage = `url('${bg}')`;
                localStorage.setItem('selectedBg', bg);
            });
            container.appendChild(button);
        });

        return container;
    }

    const darkSelector = createSelector(darkBackgrounds, 'dark');
    const lightSelector = createSelector(lightBackgrounds, 'light');

    if (backgroundSelector) {
        backgroundSelector.appendChild(darkSelector);
        backgroundSelector.appendChild(lightSelector);
    }

    function updateBackgroundSelectors() {
        if (!backgroundSelector) return;
        if (html.classList.contains('dark')) {
            darkSelector.style.display = 'flex';
            lightSelector.style.display = 'none';
        } else {
            darkSelector.style.display = 'none';
            lightSelector.style.display = 'flex';
        }
    }

    // Met à jour les sélecteurs lors d'un changement de thème global
    document.addEventListener('themeChanged', updateBackgroundSelectors);

    // Initial setup: appliquer un fond par défaut selon le thème si aucun n'est sauvegardé
    const savedBg = localStorage.getItem('selectedBg');
    const isDark = html.classList.contains('dark');
    const defaultBg = isDark ? darkBackgrounds[0] : lightBackgrounds[0];
    const initialBg = savedBg || defaultBg;

    if (backgroundContainer) {
        backgroundContainer.style.backgroundImage = `url('${initialBg}')`;
    }
    if (!savedBg) {
        localStorage.setItem('selectedBg', initialBg);
    }

    updateBackgroundSelectors();
});
