(function () {
    try {
        const mode = window.localStorage.getItem("nethack-color-mode");
        if (mode === "light" || mode === "dark") {
            document.documentElement.dataset.theme = mode;
        }
        const locale = window.localStorage.getItem("nethack-locale");
        if (locale) {
            document.documentElement.lang = locale;
        }
    } catch {
        document.documentElement.dataset.theme = "dark";
    }
})();
