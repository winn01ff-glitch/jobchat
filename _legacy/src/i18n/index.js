/* ============================================
   i18n - Internationalization Engine
   Translations loaded inline for reliability
   ============================================ */
const I18n = {
    currentLang: 'ja',
    translations: {},
    fallbackLang: 'en',
    _loaded: false,

    async init() {
        // Detect browser language
        const browserLang = (navigator.language || '').slice(0, 2);
        const supportedLangs = ['ja', 'vi', 'en', 'my', 'pt'];

        // Check localStorage first
        const savedLang = localStorage.getItem('jobchat_lang');
        if (savedLang && supportedLangs.includes(savedLang)) {
            this.currentLang = savedLang;
        } else if (supportedLangs.includes(browserLang)) {
            this.currentLang = browserLang;
        }

        // Load all languages
        await this.loadAllLanguages();
        this._loaded = true;

        // Update UI
        this.updateActiveLangBtn();
        this.translatePage();

        // Bind language switcher (dropdown)
        var langSelect = document.getElementById('lang-select');
        if (langSelect) {
            langSelect.value = this.currentLang;
            langSelect.addEventListener('change', () => {
                this.setLanguage(langSelect.value);
            });
        }
    },

    async loadAllLanguages() {
        const langs = ['ja', 'vi', 'en', 'my', 'pt'];
        const loadPromises = langs.map(async (lang) => {
            try {
                const response = await fetch('src/i18n/' + lang + '.json');
                if (response.ok) {
                    this.translations[lang] = await response.json();
                } else {
                    console.warn('Failed to load ' + lang + '.json: HTTP ' + response.status);
                }
            } catch (e) {
                console.warn('Failed to load ' + lang + '.json', e);
            }
        });
        await Promise.all(loadPromises);

        // Verify at least one language loaded
        if (Object.keys(this.translations).length === 0) {
            console.error('No translations loaded! Using fallback keys.');
        }
    },

    setLanguage(lang) {
        this.currentLang = lang;
        localStorage.setItem('jobchat_lang', lang);
        this.updateActiveLangBtn();
        this.translatePage();
        document.documentElement.lang = lang;
    },

    updateActiveLangBtn() {
        var langSelect = document.getElementById('lang-select');
        if (langSelect) langSelect.value = this.currentLang;
    },

    t(key, params) {
        params = params || {};
        var text = this.getNestedValue(this.translations[this.currentLang], key)
            || this.getNestedValue(this.translations[this.fallbackLang], key)
            || key;

        // Replace placeholders like {{name}}
        Object.keys(params).forEach(function(param) {
            text = text.replace(new RegExp('\\{\\{' + param + '\\}\\}', 'g'), params[param]);
        });

        return text;
    },

    getNestedValue(obj, path) {
        if (!obj) return null;
        var parts = path.split('.');
        var current = obj;
        for (var i = 0; i < parts.length; i++) {
            if (current == null) return null;
            current = current[parts[i]];
        }
        return current;
    },

    translatePage() {
        document.querySelectorAll('[data-i18n]').forEach(function(el) {
            var key = el.getAttribute('data-i18n');
            el.textContent = I18n.t(key);
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
            var key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = I18n.t(key);
        });

        document.querySelectorAll('[data-i18n-title]').forEach(function(el) {
            var key = el.getAttribute('data-i18n-title');
            el.title = I18n.t(key);
        });

        // Dispatch event for dynamic content
        window.dispatchEvent(new CustomEvent('languageChanged', {
            detail: { lang: I18n.currentLang }
        }));
    }
};
